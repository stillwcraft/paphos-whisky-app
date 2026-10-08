"""Authenticated, privacy-scoped user-created Cyprus map events."""
from __future__ import annotations
import io
import logging
import os
import re
from datetime import datetime, time, timedelta, timezone
from urllib.parse import quote, urlsplit
from uuid import uuid4
from zoneinfo import ZoneInfo

import requests
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import and_, exists, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from typing import Literal, Optional

import models as m
from database import get_db
from social_storage import storage_config

log = logging.getLogger(__name__)
OPAQUE_MEDIA_KEY = re.compile(r"^(event|avatar)/[0-9a-f]{32}\.jpg$")
MAX_SOCIAL_IMAGE_BYTES = 1024 * 1024
MAP_TESTER_TELEGRAM_ID = 369764930


def auth():
    # Deferred import avoids a main/router import cycle; FastAPI resolves the dependency at import time.
    from main import get_authenticated_telegram_user
    return get_authenticated_telegram_user


def admin():
    from main import require_admin
    return require_admin


def is_admin(user):
    admin_id = os.getenv("ADMIN_TELEGRAM_ID")
    if admin_id:
        try:
            return user.telegram_id == int(admin_id)
        except ValueError:
            pass
    return False


def require_social_access(response: Response, user=Depends(auth())):
    if (is_admin(user) or user.telegram_id == MAP_TESTER_TELEGRAM_ID
            or os.getenv("SOCIAL_EVENTS_ENABLED", "").strip().lower() in {"1", "true", "yes", "on"}):
        response.headers["Cache-Control"] = "private, no-store"
        return user
    raise HTTPException(status_code=403, detail="Social events are not enabled")


router = APIRouter(
    prefix="/api/social", tags=["social"], dependencies=[Depends(require_social_access)]
)


def now():
    return datetime.now(timezone.utc)


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def uid(user):
    return user.telegram_id


def fail(code, message):
    raise HTTPException(code, message)


def commit(db):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        fail(409, "Conflicting request")


def profile(db, user):
    p = db.get(m.SocialProfile, uid(user))
    if p is None:
        name = user.user.get("first_name") or user.user.get("username") or "Member"
        p = m.SocialProfile(telegram_id=uid(user), display_name=str(name)[:100])
        db.add(p)
        commit(db)
    return p


def adults(db, user):
    if is_admin(user):
        return
    if (profile(db, user).age or 0) < 18:
        fail(403, "Enter an age of at least 18 in your social profile")


def blocked(db, a, b):
    return db.query(m.SocialBlock).filter(or_(
        and_(m.SocialBlock.blocker_id == a, m.SocialBlock.blocked_id == b),
        and_(m.SocialBlock.blocker_id == b, m.SocialBlock.blocked_id == a),
    )).first() is not None


def friends(db, a, b):
    return db.query(m.SocialFriendRequest).filter(
        m.SocialFriendRequest.status == "accepted",
        or_(and_(m.SocialFriendRequest.sender_id == a, m.SocialFriendRequest.recipient_id == b),
            and_(m.SocialFriendRequest.sender_id == b, m.SocialFriendRequest.recipient_id == a)),
    ).first() is not None and not blocked(db, a, b)


def block_pair(db, blocker_id, blocked_id):
    # Match the event lock used by accept_join so an acceptance cannot race the revocation.
    if db.bind.dialect.name == "postgresql":
        db.query(m.SocialEvent.id).filter(
            m.SocialEvent.owner_id.in_((blocker_id, blocked_id))
        ).order_by(m.SocialEvent.id).with_for_update().all()
    if not db.query(m.SocialBlock).filter_by(blocker_id=blocker_id, blocked_id=blocked_id).first():
        db.add(m.SocialBlock(blocker_id=blocker_id, blocked_id=blocked_id))
    db.query(m.SocialFriendRequest).filter(or_(
        and_(m.SocialFriendRequest.sender_id == blocker_id,
             m.SocialFriendRequest.recipient_id == blocked_id),
        and_(m.SocialFriendRequest.recipient_id == blocker_id,
             m.SocialFriendRequest.sender_id == blocked_id),
    )).delete(synchronize_session=False)
    db.query(m.SocialJoinRequest).filter(or_(
        and_(m.SocialJoinRequest.telegram_id == blocked_id,
             m.SocialJoinRequest.event_id.in_(
                 db.query(m.SocialEvent.id).filter_by(owner_id=blocker_id))),
        and_(m.SocialJoinRequest.telegram_id == blocker_id,
             m.SocialJoinRequest.event_id.in_(
                 db.query(m.SocialEvent.id).filter_by(owner_id=blocked_id))),
    )).delete(synchronize_session=False)
    db.query(m.SocialTag).filter(or_(
        and_(m.SocialTag.telegram_id == blocked_id,
             m.SocialTag.event_id.in_(
                 db.query(m.SocialEvent.id).filter_by(owner_id=blocker_id))),
        and_(m.SocialTag.telegram_id == blocker_id,
             m.SocialTag.event_id.in_(
                 db.query(m.SocialEvent.id).filter_by(owner_id=blocked_id))),
    )).delete(synchronize_session=False)
    commit(db)


def signed(key, lifetime=300):
    if not key:
        return None
    if not OPAQUE_MEDIA_KEY.fullmatch(key):
        return None
    url, secret, bucket = storage_config()
    try:
        r = requests.post(
            f"{url}/storage/v1/object/sign/{quote(bucket, safe='')}/{quote(key, safe='/')}",
            headers={"Authorization": f"Bearer {secret}", "apikey": secret},
            json={"expiresIn": lifetime}, timeout=5, allow_redirects=False,
        )
        r.raise_for_status()
        if not r.ok:
            raise ValueError("Unexpected storage response")
        path = r.json()["signedURL"]
        if not isinstance(path, str) or not path.startswith(("/object/sign/", "/storage/v1/object/sign/")):
            raise ValueError("Invalid signed path")
        return f"{url}/storage/v1{path}" if path.startswith("/object/") else f"{url}{path}"
    except (requests.RequestException, KeyError, ValueError) as exc:
        log.warning("Social media signing failed: %s", type(exc).__name__)
        fail(503, "Media temporarily unavailable")


def mini(db, person_id):
    p = db.get(m.SocialProfile, person_id)
    return {"telegram_id": person_id, "display_name": p.display_name if p else "Member",
            "verified": p.verified if p else False,
            "age": None,
            "avatar_url": signed(p.avatar_key) if p and p.avatar_key else None}


def notify(person_id, message):
    token = os.getenv("BOT_TOKEN")
    if not token:
        return "not_configured"
    try:
        r = requests.post(f"https://api.telegram.org/bot{token}/sendMessage",
                          json={"chat_id": person_id, "text": message}, timeout=5)
        if r.ok and r.json().get("ok"):
            return "sent"
    except (requests.RequestException, ValueError):
        pass
    log.info("Social notification not delivered to user %s (bot may not have been started)", person_id)
    return "not_delivered"


def visible(db, event, viewer):
    if not event or event.hidden or utc(event.expires_at) <= now():
        return False
    if event.owner_id == viewer:
        return True
    if blocked(db, viewer, event.owner_id):
        return False
    return event.visibility != "friends" or friends(db, viewer, event.owner_id)


def event_for(db, event_id, viewer):
    e = db.get(m.SocialEvent, event_id)
    if not visible(db, e, viewer):
        fail(404, "Event not found")
    return e


def event_photo_url(e, moderator=False):
    if e.event_type == "global":
        return (e.image_urls or [None])[0]
    return signed(
        e.photo_key, 300 if moderator else
        min(300, max(1, int((utc(e.expires_at) - now()).total_seconds())))
    )


def event_json(db, e, viewer, moderator=False):
    owner_visible = e.visibility != "anonymous" or e.owner_id == viewer or moderator
    joins = db.query(m.SocialJoinRequest).filter_by(event_id=e.id, status="accepted").all()
    tags = db.query(m.SocialTag).filter_by(event_id=e.id, status="accepted").all()
    cheers = db.query(m.SocialCheer).filter_by(event_id=e.id).count()
    # Anonymous event participants cannot infer the organizer through tags or attendee lists.
    return {
        "id": e.id, "description": e.description, "drink": e.drink,
        "event_type": e.event_type, "image_urls": e.image_urls or [],
        "visibility": e.visibility, "latitude": e.latitude, "longitude": e.longitude,
        "location": e.location, "photo_url": event_photo_url(e, moderator),
        "starts_at": utc(e.starts_at).isoformat(), "expires_at": utc(e.expires_at).isoformat(),
        "capacity": e.capacity, "attendee_count": 0 if e.event_type == "global" else len(joins) + 1,
        "owner": mini(db, e.owner_id) if owner_visible else None,
        "is_owner": e.owner_id == viewer,
        "tagged_friends": [mini(db, t.telegram_id) for t in tags if
                           t.telegram_id != e.owner_id
                           and (moderator or (friends(db, e.owner_id, t.telegram_id)
                                              and not blocked(db, viewer, t.telegram_id)
                                              and (viewer in (e.owner_id, t.telegram_id)
                                                   or friends(db, viewer, t.telegram_id))))],
        "attendees": [] if e.event_type == "global" else ([mini(db, j.telegram_id) for j in joins
                       if moderator or not blocked(db, viewer, j.telegram_id)] +
                      ([mini(db, e.owner_id)] if owner_visible else [])),
        "cheers": cheers,
        "cheered": db.get(m.SocialCheer, (e.id, viewer)) is not None,
        "join_status": None if e.event_type == "global" else "host" if e.owner_id == viewer else
                       (db.query(m.SocialJoinRequest).filter_by(event_id=e.id, telegram_id=viewer).first().status
                        if db.query(m.SocialJoinRequest).filter_by(event_id=e.id, telegram_id=viewer).first()
                        else None),
    }


class ProfileUpdate(BaseModel):
    display_name: str = Field(min_length=1, max_length=100)
    age: Optional[int] = Field(ge=18, le=120)
    avatar_key: Optional[str] = None


class FriendInvite(BaseModel):
    telegram_id: int = Field(gt=0)


class EventCreate(BaseModel):
    description: str = Field(min_length=1, max_length=400)
    drink: Literal["beer", "wine", "spirits", "cocktails", "coffee"]
    visibility: Literal["public", "friends", "anonymous"]
    latitude: float = Field(ge=34, le=36)
    longitude: float = Field(ge=32, le=35)
    location: str = Field(min_length=1, max_length=150)
    photo_key: str = Field(min_length=1, max_length=256)
    capacity: Optional[int] = Field(default=None, ge=2, le=100)
    start: Literal["now", "20m"]
    ttl: Literal["1h", "3h", "today"]
    tagged_friend_ids: list[int] = Field(default_factory=list, max_length=30)


class GlobalEventCreate(BaseModel):
    location: str = Field(min_length=1, max_length=150)
    description: str = Field(min_length=1, max_length=5000)
    latitude: float = Field(ge=34, le=36)
    longitude: float = Field(ge=32, le=35)
    drink: Literal["beer", "wine", "spirits", "cocktails", "coffee"]
    visibility: Literal["public", "friends", "anonymous"]
    image_urls: list[str] = Field(min_length=1, max_length=5)
    starts_at: datetime
    expires_at: datetime

    @field_validator("image_urls")
    @classmethod
    def validate_image_urls(cls, urls):
        for url in urls:
            if len(url) > 2048 or any(c.isspace() or ord(c) < 32 or c == "\\" for c in url):
                raise ValueError("Images must be valid HTTPS URLs")
            try:
                parsed = urlsplit(url)
                valid = (parsed.scheme == "https" and bool(parsed.hostname)
                         and "%" not in parsed.netloc
                         and parsed.username is None and parsed.password is None)
                _ = parsed.port
            except ValueError:
                valid = False
            if not valid:
                raise ValueError("Images must be valid HTTPS URLs")
        return urls

    @field_validator("starts_at", "expires_at", mode="before")
    @classmethod
    def iso_datetime_required(cls, value):
        if not isinstance(value, str) or not re.fullmatch(
            r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})",
            value,
        ):
            raise ValueError("An ISO datetime string with a timezone is required")
        return value

    @field_validator("starts_at", "expires_at")
    @classmethod
    def timezone_required(cls, value):
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("A timezone offset is required")
        return value


class Message(BaseModel):
    body: str = Field(min_length=1, max_length=1000)


class Report(BaseModel):
    category: Literal["spam", "inappropriate", "false_location"]


class Verify(BaseModel):
    verified: bool


@router.get("/profile")
def get_profile(user=Depends(auth()), db: Session = Depends(get_db)):
    p = profile(db, user)
    return {**mini(db, uid(user)), "age": p.age}


@router.put("/profile")
def put_profile(data: ProfileUpdate, user=Depends(auth()), db: Session = Depends(get_db)):
    if data.age is None and not is_admin(user):
        fail(422, "Enter an age of at least 18 in your social profile")
    p = profile(db, user)
    avatar_key = data.avatar_key if "avatar_key" in data.model_fields_set else p.avatar_key
    if "avatar_key" in data.model_fields_set and avatar_key is not None:
        media = db.query(m.SocialMedia).filter_by(key=data.avatar_key).with_for_update().first()
        if (not OPAQUE_MEDIA_KEY.fullmatch(data.avatar_key)
                or not media or media.owner_id != uid(user) or media.kind != "avatar"):
            fail(422, "Upload your avatar first")
    name = data.display_name.strip()
    if not name:
        fail(422, "Display name cannot be blank")
    if (p.display_name, p.age, p.avatar_key) != (name, data.age, avatar_key):
        p.verified = False
    p.display_name, p.age, p.avatar_key = name, data.age, avatar_key
    commit(db)
    return get_profile(user, db)


@router.get("/friends")
def get_friends(user=Depends(auth()), db: Session = Depends(get_db)):
    rows = db.query(m.SocialFriendRequest).filter_by(status="accepted").filter(
        or_(m.SocialFriendRequest.sender_id == uid(user), m.SocialFriendRequest.recipient_id == uid(user))).all()
    return [mini(db, other) for r in rows
            if not blocked(db, uid(user), other := (r.recipient_id if r.sender_id == uid(user) else r.sender_id))]


@router.get("/tag-requests")
def tag_requests(user=Depends(auth()), db: Session = Depends(get_db)):
    rows = db.query(m.SocialTag, m.SocialEvent).join(
        m.SocialEvent, m.SocialEvent.id == m.SocialTag.event_id
    ).filter(
        m.SocialTag.telegram_id == uid(user), m.SocialTag.status == "pending",
        m.SocialEvent.hidden.is_(False), m.SocialEvent.expires_at > now(),
    ).order_by(m.SocialEvent.id.desc()).all()
    return [
        {"id": e.id, "location": e.location,
         "owner": None if e.visibility == "anonymous" else mini(db, e.owner_id),
         "starts_at": utc(e.starts_at).isoformat(), "expires_at": utc(e.expires_at).isoformat()}
        for _, e in rows if visible(db, e, uid(user))
    ]


@router.post("/friend-requests")
def invite(data: FriendInvite, user=Depends(auth()), db: Session = Depends(get_db)):
    adults(db, user)
    target = data.telegram_id
    if target == uid(user) or blocked(db, uid(user), target):
        fail(403, "Invitation unavailable")
    recipient = db.get(m.SocialProfile, target)
    if recipient is None:
        fail(404, "User not found")
    if (recipient.age or 0) < 18:
        fail(403, "Recipient is not eligible")
    existing = db.query(m.SocialFriendRequest).filter(or_(
        and_(m.SocialFriendRequest.sender_id == uid(user), m.SocialFriendRequest.recipient_id == target),
        and_(m.SocialFriendRequest.sender_id == target, m.SocialFriendRequest.recipient_id == uid(user)))).first()
    if existing:
        fail(409, "Friend request already exists")
    r = m.SocialFriendRequest(sender_id=uid(user), recipient_id=target)
    db.add(r)
    commit(db)
    return {"id": r.id, "status": r.status, "notification_status": notify(target, "You have a new friend request in Paphos Whisky Club.")}


@router.get("/friend-requests")
def friend_requests(user=Depends(auth()), db: Session = Depends(get_db)):
    rows = db.query(m.SocialFriendRequest).filter_by(recipient_id=uid(user), status="pending").all()
    return [{"id": r.id, "sender": mini(db, r.sender_id)} for r in rows if not blocked(db, uid(user), r.sender_id)]


@router.post("/friend-requests/{request_id}/accept")
def accept_friend(request_id: int, user=Depends(auth()), db: Session = Depends(get_db)):
    adults(db, user)
    r = db.query(m.SocialFriendRequest).filter_by(id=request_id, recipient_id=uid(user), status="pending").first()
    if not r or blocked(db, uid(user), r.sender_id):
        fail(404, "Friend request not found")
    r.status = "accepted"
    commit(db)
    return {"status": "accepted"}


@router.post("/blocks")
def block(data: FriendInvite, user=Depends(auth()), db: Session = Depends(get_db)):
    if data.telegram_id == uid(user) or not db.get(m.SocialProfile, data.telegram_id):
        fail(404, "User not found")
    block_pair(db, uid(user), data.telegram_id)
    return {"status": "blocked"}


@router.get("/blocks")
def blocks(user=Depends(auth()), db: Session = Depends(get_db)):
    return [{"id": row.id} for row in db.query(m.SocialBlock).filter_by(blocker_id=uid(user))]


@router.delete("/blocks/{block_id}")
def unblock(block_id: int, user=Depends(auth()), db: Session = Depends(get_db)):
    db.query(m.SocialBlock).filter_by(id=block_id, blocker_id=uid(user)).delete()
    commit(db)
    return {"status": "unblocked"}


@router.post("/media")
async def upload(request: Request, kind: Literal["event", "avatar"] = Query(...),
                 user=Depends(auth()), db: Session = Depends(get_db)):
    adults(db, user)
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > 5 * 1024 * 1024:
            fail(413, "Image exceeds 5 MB")
    try:
        with Image.open(io.BytesIO(data)) as image:
            if image.width * image.height > 25_000_000:
                fail(422, "Unsupported image")
            image.verify()
        with Image.open(io.BytesIO(data)) as image:
            if image.format not in ("JPEG", "PNG", "WEBP") or image.width * image.height > 25_000_000:
                fail(422, "Unsupported image")
            image.load()
            rgb = image.convert("RGB")
            for max_dimension in (1600, 1280, 1024, 800, 640, 512, 384, 256):
                rgb.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
                for quality in (85, 70, 55):
                    output = io.BytesIO()
                    rgb.save(output, format="JPEG", quality=quality)
                    if output.tell() <= MAX_SOCIAL_IMAGE_BYTES:
                        break
                if output.tell() <= MAX_SOCIAL_IMAGE_BYTES:
                    break
            else:
                fail(422, "Image cannot be compressed to 1 MB")
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        fail(422, "Invalid image")
    url, secret, bucket = storage_config()
    key = f"{kind}/{uuid4().hex}.jpg"
    # Record the key first so even an interrupted upload can be collected later.
    db.add(m.SocialMedia(key=key, owner_id=uid(user), kind=kind))
    commit(db)
    try:
        r = requests.post(
            f"{url}/storage/v1/object/{quote(bucket, safe='')}/{quote(key, safe='/')}",
            headers={"Authorization": f"Bearer {secret}", "apikey": secret,
                     "Content-Type": "image/jpeg", "x-upsert": "false"},
            data=output.getvalue(), timeout=15, allow_redirects=False)
        r.raise_for_status()
        if not r.ok:
            fail(503, "Media temporarily unavailable")
    except requests.RequestException:
        log.warning("Social image upload failed")
        fail(503, "Media temporarily unavailable")
    return {"key": key}


@router.post("/events", status_code=201)
def create_event(data: EventCreate, user=Depends(auth()), db: Session = Depends(get_db)):
    adults(db, user)
    media = db.query(m.SocialMedia).filter_by(key=data.photo_key).with_for_update().first()
    if (not OPAQUE_MEDIA_KEY.fullmatch(data.photo_key)
            or not media or media.owner_id != uid(user) or media.kind != "event"):
        fail(422, "Upload your event photo first")
    if db.query(m.SocialEvent).filter_by(photo_key=data.photo_key).first():
        fail(409, "Photo already used")
    if len(data.tagged_friend_ids) != len(set(data.tagged_friend_ids)) or any(
        not friends(db, uid(user), t) for t in data.tagged_friend_ids
    ):
        fail(422, "Tags must be unique mutual friends")
    start = now() + (timedelta(minutes=20) if data.start == "20m" else timedelta())
    expires = (start + timedelta(hours=1 if data.ttl == "1h" else 3)
               if data.ttl != "today" else datetime.combine(
                   start.astimezone(ZoneInfo("Asia/Nicosia")).date(),
                   time(23, 59),
                   tzinfo=ZoneInfo("Asia/Nicosia")).astimezone(timezone.utc))
    if expires <= start:
        fail(422, "Event would expire before it starts")
    e = m.SocialEvent(owner_id=uid(user), description=data.description, drink=data.drink,
                      visibility=data.visibility, latitude=data.latitude, longitude=data.longitude,
                      location=data.location, photo_key=data.photo_key, capacity=data.capacity,
                      starts_at=start, expires_at=expires)
    db.add(e)
    db.flush()
    db.add_all(m.SocialTag(event_id=e.id, telegram_id=t) for t in data.tagged_friend_ids)
    commit(db)
    result = event_json(db, e, uid(user))
    result["notifications"] = {str(t): notify(t, "Вас отметили в событии!") for t in data.tagged_friend_ids}
    return result


@router.post("/events/global", status_code=201)
def create_global_event(data: GlobalEventCreate, user=Depends(admin()), db: Session = Depends(get_db)):
    if data.expires_at <= now() or data.expires_at <= data.starts_at:
        fail(422, "Event must expire in the future and after it starts")
    e = m.SocialEvent(
        owner_id=uid(user), event_type="global", image_urls=data.image_urls,
        description=data.description, drink=data.drink, visibility=data.visibility,
        latitude=data.latitude, longitude=data.longitude, location=data.location,
        starts_at=data.starts_at, expires_at=data.expires_at,
    )
    db.add(e)
    commit(db)
    return event_json(db, e, uid(user))


@router.get("/events")
def list_events(user=Depends(auth()), db: Session = Depends(get_db)):
    adults(db, user)
    viewer = uid(user)
    friendship = exists().where(
        and_(m.SocialFriendRequest.status == "accepted",
             or_(and_(m.SocialFriendRequest.sender_id == viewer,
                      m.SocialFriendRequest.recipient_id == m.SocialEvent.owner_id),
                 and_(m.SocialFriendRequest.recipient_id == viewer,
                      m.SocialFriendRequest.sender_id == m.SocialEvent.owner_id)))
    )
    has_block = exists().where(or_(
        and_(m.SocialBlock.blocker_id == viewer,
             m.SocialBlock.blocked_id == m.SocialEvent.owner_id),
        and_(m.SocialBlock.blocker_id == m.SocialEvent.owner_id,
             m.SocialBlock.blocked_id == viewer),
    ))
    rows = db.query(m.SocialEvent).filter(
        m.SocialEvent.expires_at > now(), m.SocialEvent.hidden.is_(False),
        or_(m.SocialEvent.owner_id == viewer,
            and_(~has_block, or_(m.SocialEvent.visibility != "friends", friendship))),
    ).order_by(m.SocialEvent.id.desc()).limit(300).all()
    return [event_json(db, e, uid(user)) for e in rows if visible(db, e, uid(user))]


@router.get("/events/{event_id}")
def get_event(event_id: int, user=Depends(auth()), db: Session = Depends(get_db)):
    adults(db, user)
    return event_json(db, event_for(db, event_id, uid(user)), uid(user))


def update_tag_consent(event_id, decision, user, db):
    e = event_for(db, event_id, uid(user))
    tag = db.get(m.SocialTag, (event_id, uid(user)))
    if not tag or tag.status != "pending":
        fail(404, "Tag request not found")
    if decision == "accepted" and not friends(db, uid(user), e.owner_id):
        fail(404, "Tag request not found")
    tag.status = decision
    commit(db)
    return {"status": decision}


@router.post("/events/{event_id}/tags/accept")
def accept_tag(event_id: int, user=Depends(auth()), db: Session = Depends(get_db)):
    return update_tag_consent(event_id, "accepted", user, db)


@router.post("/events/{event_id}/tags/decline")
def decline_tag(event_id: int, user=Depends(auth()), db: Session = Depends(get_db)):
    return update_tag_consent(event_id, "declined", user, db)


@router.post("/events/{event_id}/block")
def block_event_owner(event_id: int, user=Depends(auth()), db: Session = Depends(get_db)):
    e = event_for(db, event_id, uid(user))
    if e.owner_id == uid(user):
        fail(403, "Cannot block yourself")
    block_pair(db, uid(user), e.owner_id)
    return {"status": "blocked"}


@router.post("/events/{event_id}/cheer")
def cheer(event_id: int, user=Depends(auth()), db: Session = Depends(get_db)):
    adults(db, user)
    event_for(db, event_id, uid(user))
    if not db.get(m.SocialCheer, (event_id, uid(user))):
        db.add(m.SocialCheer(event_id=event_id, telegram_id=uid(user)))
        commit(db)
    return {"cheered": True}


@router.post("/events/{event_id}/join")
def join(event_id: int, user=Depends(auth()), db: Session = Depends(get_db)):
    adults(db, user)
    e = event_for(db, event_id, uid(user))
    if e.event_type == "global":
        fail(403, "Global events do not accept joins")
    if e.owner_id == uid(user):
        fail(409, "Host already attends")
    existing = db.query(m.SocialJoinRequest).filter_by(event_id=event_id, telegram_id=uid(user)).first()
    if existing:
        fail(409, "Join request already exists")
    r = m.SocialJoinRequest(event_id=event_id, telegram_id=uid(user))
    db.add(r)
    commit(db)
    return {"id": r.id, "status": r.status,
            "notification_status": notify(e.owner_id, "Someone requested to join your Cyprus map event.")}


@router.get("/events/{event_id}/join-requests")
def join_requests(event_id: int, user=Depends(auth()), db: Session = Depends(get_db)):
    e = event_for(db, event_id, uid(user))
    if e.event_type == "global":
        fail(403, "Global events do not accept joins")
    if e.owner_id != uid(user):
        fail(403, "Host only")
    rows = db.query(m.SocialJoinRequest).filter_by(event_id=event_id, status="pending").all()
    return [{"id": r.id, "user": mini(db, r.telegram_id)} for r in rows if not blocked(db, uid(user), r.telegram_id)]


@router.post("/events/{event_id}/join-requests/{request_id}/accept")
def accept_join(event_id: int, request_id: int, user=Depends(auth()), db: Session = Depends(get_db)):
    # SQLite serializes writers with BEGIN IMMEDIATE; PostgreSQL locks the event row until commit.
    if db.bind.dialect.name == "sqlite":
        from sqlalchemy import text
        db.execute(text("BEGIN IMMEDIATE"))
    query = db.query(m.SocialEvent).filter_by(id=event_id)
    e = query.with_for_update().first() if db.bind.dialect.name != "sqlite" else query.first()
    if not visible(db, e, uid(user)) or e.owner_id != uid(user):
        fail(404, "Event not found")
    if e.event_type == "global":
        fail(403, "Global events do not accept joins")
    r = db.query(m.SocialJoinRequest).filter_by(id=request_id, event_id=event_id, status="pending").first()
    if not r or blocked(db, uid(user), r.telegram_id):
        fail(404, "Join request not found")
    count = db.query(m.SocialJoinRequest).filter_by(event_id=event_id, status="accepted").count()
    if e.capacity is not None and count + 1 >= e.capacity:
        fail(409, "Event is full")
    r.status = "accepted"
    commit(db)
    return {"status": "accepted", "notification_status": notify(r.telegram_id, "Your event join request was accepted.")}


def chat_access(db, event_id, user):
    e = event_for(db, event_id, uid(user))
    if e.event_type != "global" and uid(user) != e.owner_id and not db.query(m.SocialJoinRequest).filter_by(
        event_id=event_id, telegram_id=uid(user), status="accepted").first():
        fail(403, "Accepted attendees only")
    return e


def chat_json(db, item, e, viewer):
    return {"id": item.id, "body": item.body, "created_at": utc(item.created_at).isoformat(),
            "sender": None if item.sender_id == e.owner_id and e.visibility == "anonymous"
            and viewer != e.owner_id else mini(db, item.sender_id),
            "is_mine": item.sender_id == viewer}


@router.get("/events/{event_id}/chat")
def chat(event_id: int, after_id: int = Query(0, ge=0), user=Depends(auth()), db: Session = Depends(get_db)):
    e = chat_access(db, event_id, user)
    if e.event_type == "global":
        adults(db, user)
    rows = db.query(m.SocialChatMessage).filter(
        m.SocialChatMessage.event_id == event_id, m.SocialChatMessage.id > after_id
    ).order_by(m.SocialChatMessage.id).limit(100).all()
    return [chat_json(db, row, e, uid(user)) for row in rows
            if row.sender_id == uid(user) or not blocked(db, uid(user), row.sender_id)]


@router.post("/events/{event_id}/chat")
def send_chat(event_id: int, data: Message, user=Depends(auth()), db: Session = Depends(get_db)):
    adults(db, user)
    e = chat_access(db, event_id, user)
    item = m.SocialChatMessage(event_id=event_id, sender_id=uid(user), body=data.body)
    db.add(item)
    commit(db)
    return chat_json(db, item, e, uid(user))


@router.post("/events/{event_id}/report")
def report(event_id: int, data: Report, user=Depends(auth()), db: Session = Depends(get_db)):
    e = event_for(db, event_id, uid(user))
    if e.owner_id == uid(user):
        fail(403, "Cannot report own event")
    if db.query(m.SocialReport).filter_by(event_id=event_id, reporter_id=uid(user)).first():
        fail(409, "Already reported")
    db.add(m.SocialReport(event_id=event_id, reporter_id=uid(user), category=data.category))
    commit(db)
    return {"status": "reported"}


@router.get("/admin/reports")
def reports(user=Depends(admin()), db: Session = Depends(get_db)):
    return [{"id": r.id, "event_id": r.event_id, "reporter_id": r.reporter_id,
             "category": r.category, "created_at": utc(r.created_at).isoformat(),
             "owner_id": e.owner_id if (e := db.get(m.SocialEvent, r.event_id)) else None,
             "description": e.description if e else None,
             "location": e.location if e else None,
             "visibility": e.visibility if e else None,
             "hidden": e.hidden if e else None,
             "status": r.status,
             "resolved_at": utc(r.resolved_at).isoformat() if r.resolved_at else None,
             "resolved_by": r.resolved_by,
             "photo_url": event_photo_url(e, moderator=True) if e else None}
            for r in db.query(m.SocialReport).order_by(m.SocialReport.id.desc()).limit(500)]


@router.get("/admin/events/{event_id}")
def review_event(event_id: int, user=Depends(admin()), db: Session = Depends(get_db)):
    e = db.get(m.SocialEvent, event_id)
    if not e:
        fail(404, "Event not found")
    return {**event_json(db, e, uid(user), moderator=True), "hidden": e.hidden}


@router.post("/admin/events/{event_id}/hide")
def hide_event(event_id: int, user=Depends(admin()), db: Session = Depends(get_db)):
    e = db.get(m.SocialEvent, event_id)
    if not e:
        fail(404, "Event not found")
    e.hidden = True
    commit(db)
    return {"id": e.id, "hidden": True}


@router.post("/admin/reports/{report_id}/resolve")
def resolve_report(report_id: int, user=Depends(admin()), db: Session = Depends(get_db)):
    r = db.get(m.SocialReport, report_id)
    if not r:
        fail(404, "Report not found")
    if r.status != "resolved":
        r.status = "resolved"
        r.resolved_at = now()
        r.resolved_by = uid(user)
        commit(db)
    return {"id": r.id, "status": "resolved"}


@router.post("/admin/profiles/{telegram_id}/verify")
def verify_profile(telegram_id: int, data: Verify, user=Depends(admin()), db: Session = Depends(get_db)):
    p = db.get(m.SocialProfile, telegram_id)
    if not p:
        fail(404, "Profile not found")
    p.verified = data.verified
    commit(db)
    return {"telegram_id": telegram_id, "verified": p.verified}
