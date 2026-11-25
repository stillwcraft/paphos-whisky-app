"""Authenticated, privacy-scoped user-created Cyprus map events."""
from __future__ import annotations
import io
import logging
import os
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, time, timedelta, timezone
from threading import BoundedSemaphore
from time import monotonic
from urllib.parse import quote, urlsplit
from uuid import uuid4
from zoneinfo import ZoneInfo

import requests
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.concurrency import run_in_threadpool
from fastapi.exceptions import RequestValidationError
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator
from sqlalchemy import and_, case, exists, func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from typing import Literal, Optional

import models as m
from database import get_db
from social_storage import storage_config

log = logging.getLogger(__name__)
OPAQUE_MEDIA_KEY = re.compile(r"^(event|avatar)/[0-9a-f]{32}\.jpg$")
MAX_SOCIAL_IMAGE_BYTES = 1024 * 1024


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
    response.headers["Cache-Control"] = "private, no-store"
    return user


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


# Signed URLs stay valid for `lifetime` seconds. Reusing one for at most half of that (max 60 s)
# keeps the handed-out URL within its original expiry while avoiding a storage round trip for
# every poll of the same event or chat.
_SIGNED_CACHE: dict = {}
SIGNED_CACHE_MAX_ENTRIES = 1024
sign_executor = ThreadPoolExecutor(max_workers=8, thread_name_prefix="social-sign")


def _remember_signed(cache_key, url, lifetime):
    if len(_SIGNED_CACHE) >= SIGNED_CACHE_MAX_ENTRIES:
        current = monotonic()
        for stale in [k for k, (_, until) in _SIGNED_CACHE.items() if until <= current]:
            _SIGNED_CACHE.pop(stale, None)
        if len(_SIGNED_CACHE) >= SIGNED_CACHE_MAX_ENTRIES:
            _SIGNED_CACHE.clear()
    _SIGNED_CACHE[cache_key] = (url, monotonic() + min(60, lifetime / 2))


def signed(key, lifetime=300):
    if not key:
        return None
    if not OPAQUE_MEDIA_KEY.fullmatch(key):
        return None
    cached = _SIGNED_CACHE.get((key, lifetime))
    if cached and cached[1] > monotonic():
        return cached[0]
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
        result = f"{url}/storage/v1{path}" if path.startswith("/object/") else f"{url}{path}"
        _remember_signed((key, lifetime), result, lifetime)
        return result
    except (requests.RequestException, KeyError, ValueError) as exc:
        log.warning("Social media signing failed: %s", type(exc).__name__)
        fail(503, "Media temporarily unavailable")


def sign_all(items):
    """Sign several (key, lifetime) pairs concurrently; duplicates are signed once."""
    unique = list(dict.fromkeys(items))
    if len(unique) <= 1:
        return {item: signed(*item) for item in unique}
    return dict(zip(unique, sign_executor.map(lambda item: signed(*item), unique)))


def load_profiles(db, person_ids):
    ids = list(dict.fromkeys(person_ids))
    if not ids:
        return {}
    return {p.telegram_id: p for p in
            db.query(m.SocialProfile).filter(m.SocialProfile.telegram_id.in_(ids))}


def avatar_sign_items(profiles):
    return [(p.avatar_key, 300) for p in profiles.values() if p.avatar_key and not p.avatar_hidden]


def person_card(person_id, profiles, urls):
    p = profiles.get(person_id)
    return {"telegram_id": person_id, "display_name": p.display_name if p else "Member",
            "verified": p.verified if p else False,
            "age": None,
            "avatar_url": urls.get((p.avatar_key, 300)) if p and p.avatar_key and not p.avatar_hidden else None,
            "avatar_hidden": p.avatar_hidden if p else False}


def minis(db, person_ids):
    """Public cards for many people using one profile query and concurrent avatar signing."""
    ids = list(dict.fromkeys(person_ids))
    profiles = load_profiles(db, ids)
    urls = sign_all(avatar_sign_items(profiles))
    return {person_id: person_card(person_id, profiles, urls) for person_id in ids}


def mini(db, person_id):
    return minis(db, [person_id])[person_id]


class Relations:
    """In-memory friendship/block lookups for a bounded set of people (two queries in total)."""

    def __init__(self, db, person_ids):
        ids = set(person_ids)
        self.friend_pairs = set()
        self.block_pairs = set()
        if not ids:
            return
        self.friend_pairs = {frozenset((r.sender_id, r.recipient_id)) for r in db.query(
            m.SocialFriendRequest.sender_id, m.SocialFriendRequest.recipient_id
        ).filter(m.SocialFriendRequest.status == "accepted",
                 m.SocialFriendRequest.sender_id.in_(ids), m.SocialFriendRequest.recipient_id.in_(ids))}
        self.block_pairs = {frozenset((r.blocker_id, r.blocked_id)) for r in db.query(
            m.SocialBlock.blocker_id, m.SocialBlock.blocked_id
        ).filter(m.SocialBlock.blocker_id.in_(ids), m.SocialBlock.blocked_id.in_(ids))}

    def blocked(self, a, b):
        return frozenset((a, b)) in self.block_pairs

    def friends(self, a, b):
        return frozenset((a, b)) in self.friend_pairs and not self.blocked(a, b)


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


def event_photo_sign_item(e, moderator=False):
    if e.event_type == "global" or not e.photo_key:
        return None
    return (e.photo_key, 300 if moderator else
            min(300, max(1, int((utc(e.expires_at) - now()).total_seconds()))))


def event_photo_url(e, moderator=False):
    if e.event_type == "global":
        return (e.image_urls or [None])[0]
    item = event_photo_sign_item(e, moderator)
    return signed(*item) if item else None


def event_json(db, e, viewer, moderator=False):
    is_global = e.event_type == "global"
    owner_visible = e.visibility != "anonymous" or e.owner_id == viewer or moderator
    joins = [] if is_global else db.query(m.SocialJoinRequest).filter_by(
        event_id=e.id).order_by(m.SocialJoinRequest.id).all()
    accepted = [j for j in joins if j.status == "accepted"]
    own_join = next((j for j in joins if j.telegram_id == viewer), None)
    tags = db.query(m.SocialTag).filter_by(event_id=e.id, status="accepted").all()
    cheer_count, cheered = db.query(
        func.count(m.SocialCheer.telegram_id),
        func.coalesce(func.sum(case((m.SocialCheer.telegram_id == viewer, 1), else_=0)), 0),
    ).filter(m.SocialCheer.event_id == e.id).one()

    people_ids = {e.owner_id, viewer}
    people_ids.update(t.telegram_id for t in tags)
    people_ids.update(j.telegram_id for j in accepted)
    relations = Relations(db, people_ids)
    # Anonymous event participants cannot infer the organizer through tags or attendee lists.
    tagged_ids = [
        t.telegram_id for t in tags
        if t.telegram_id != e.owner_id
        and (moderator or (relations.friends(e.owner_id, t.telegram_id)
                           and not relations.blocked(viewer, t.telegram_id)
                           and (viewer in (e.owner_id, t.telegram_id)
                                or relations.friends(viewer, t.telegram_id))))
    ]
    attendee_ids = [] if is_global else [
        j.telegram_id for j in accepted if moderator or not relations.blocked(viewer, j.telegram_id)]
    shown_ids = set(tagged_ids) | set(attendee_ids)
    if owner_visible:
        shown_ids.add(e.owner_id)
    profiles = load_profiles(db, shown_ids)
    photo_item = event_photo_sign_item(e, moderator)
    # One concurrent pass over every avatar and the event photo instead of sequential round trips.
    urls = sign_all(avatar_sign_items(profiles) + ([photo_item] if photo_item else []))
    cards = {person_id: person_card(person_id, profiles, urls) for person_id in shown_ids}
    return {
        "id": e.id, "description": e.description, "drink": e.drink,
        "event_type": e.event_type, "map_layer": e.map_layer, "image_urls": e.image_urls or [],
        "visibility": e.visibility, "latitude": e.latitude, "longitude": e.longitude,
        "location": e.location,
        "photo_url": (e.image_urls or [None])[0] if is_global else urls.get(photo_item),
        "starts_at": utc(e.starts_at).isoformat(), "expires_at": utc(e.expires_at).isoformat(),
        "capacity": e.capacity, "attendee_count": 0 if is_global else len(accepted) + 1,
        "owner": cards[e.owner_id] if owner_visible else None,
        "is_owner": e.owner_id == viewer,
        "tagged_friends": [cards[t] for t in tagged_ids],
        "attendees": [] if is_global else (
            [dict(cards[a]) for a in attendee_ids]
            + ([dict(cards[e.owner_id])] if owner_visible else [])),
        "cheers": cheer_count,
        "cheered": bool(cheered),
        "join_status": None if is_global else "host" if e.owner_id == viewer else
                       (own_join.status if own_join else None),
    }


class ProfileUpdate(BaseModel):
    display_name: str = Field(min_length=1, max_length=100)
    age: Optional[int] = Field(ge=18, le=120)
    avatar_key: Optional[str] = None
    avatar_hidden: Optional[bool] = None


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


class ScheduledEventFields(BaseModel):
    location: str = Field(min_length=1, max_length=150)
    description: str = Field(min_length=1, max_length=5000)
    latitude: float = Field(ge=34, le=36)
    longitude: float = Field(ge=32, le=35)
    drink: Literal["beer", "wine", "spirits", "cocktails", "coffee"]
    visibility: Literal["public", "friends", "anonymous"]
    starts_at: datetime
    expires_at: datetime

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


class GlobalEventCreate(ScheduledEventFields):
    map_layer: Literal["events", "apartments"] = "events"
    image_urls: list[str] = Field(min_length=1, max_length=5)

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


class RegularEventUpdate(ScheduledEventFields):
    model_config = ConfigDict(extra="forbid")
    description: str = Field(min_length=1, max_length=400)
    capacity: Optional[int] = Field(ge=2, le=100)
    photo_key: Optional[str] = Field(default=None, min_length=1, max_length=256)

    @field_validator("photo_key", mode="before")
    @classmethod
    def non_null_photo(cls, value):
        if value is None:
            raise ValueError("Omit photo_key to keep the existing photo")
        return value


class GlobalEventUpdate(GlobalEventCreate):
    model_config = ConfigDict(extra="forbid")


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
    if data.avatar_hidden and data.avatar_key is not None:
        fail(422, "Cannot hide an uploaded avatar in the same request")
    p = profile(db, user)
    avatar_key = data.avatar_key if "avatar_key" in data.model_fields_set else p.avatar_key
    avatar_hidden = data.avatar_hidden if data.avatar_hidden is not None else p.avatar_hidden
    if "avatar_key" in data.model_fields_set and data.avatar_key is not None:
        avatar_hidden = False
    if avatar_hidden:
        avatar_key = None
    if "avatar_key" in data.model_fields_set and avatar_key is not None:
        media = db.query(m.SocialMedia).filter_by(key=data.avatar_key).with_for_update().first()
        if (not OPAQUE_MEDIA_KEY.fullmatch(data.avatar_key)
                or not media or media.owner_id != uid(user) or media.kind != "avatar"):
            fail(422, "Upload your avatar first")
    name = data.display_name.strip()
    if not name:
        fail(422, "Display name cannot be blank")
    if (p.display_name, p.age, p.avatar_key, p.avatar_hidden) != (name, data.age, avatar_key, avatar_hidden):
        p.verified = False
    p.display_name, p.age, p.avatar_key, p.avatar_hidden = name, data.age, avatar_key, avatar_hidden
    commit(db)
    return get_profile(user, db)


@router.get("/friends")
def get_friends(user=Depends(auth()), db: Session = Depends(get_db)):
    rows = db.query(m.SocialFriendRequest).filter_by(status="accepted").filter(
        or_(m.SocialFriendRequest.sender_id == uid(user), m.SocialFriendRequest.recipient_id == uid(user))).all()
    others = [r.recipient_id if r.sender_id == uid(user) else r.sender_id for r in rows]
    relations = Relations(db, {uid(user), *others})
    visible_others = [other for other in others if not relations.blocked(uid(user), other)]
    cards = minis(db, visible_others)
    return [cards[other] for other in visible_others]


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
    relations = Relations(db, {uid(user), *(r.sender_id for r in rows)})
    rows = [r for r in rows if not relations.blocked(uid(user), r.sender_id)]
    cards = minis(db, [r.sender_id for r in rows])
    return [{"id": r.id, "sender": cards[r.sender_id]} for r in rows]


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


MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_UPLOAD_PIXELS = 25_000_000
UPLOADS_PER_DAY = 20
# Decoding a 25 MP image takes ~75 MB, so only a couple may be processed at the same time.
_upload_slots = BoundedSemaphore(2)


def compress_upload(data: bytes) -> bytes:
    try:
        with Image.open(io.BytesIO(data)) as image:
            if image.width * image.height > MAX_UPLOAD_PIXELS:
                fail(422, "Unsupported image")
            image.verify()
        with Image.open(io.BytesIO(data)) as image:
            if image.format not in ("JPEG", "PNG", "WEBP") or image.width * image.height > MAX_UPLOAD_PIXELS:
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
    return output.getvalue()


def store_upload(db, user, kind, data: bytes):
    """Blocking part of an upload (DB, image decoding, storage call); runs in a worker thread."""
    adults(db, user)
    if not is_admin(user):
        recent = db.query(func.count(m.SocialMedia.key)).filter(
            m.SocialMedia.owner_id == uid(user),
            m.SocialMedia.created_at > now() - timedelta(hours=24),
        ).scalar()
        if recent >= UPLOADS_PER_DAY:
            fail(429, "Daily upload limit reached")
    if not _upload_slots.acquire(timeout=5):
        fail(503, "Image processing is busy, retry shortly")
    try:
        jpeg = compress_upload(data)
    finally:
        _upload_slots.release()
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
            data=jpeg, timeout=15, allow_redirects=False)
        r.raise_for_status()
        if not r.ok:
            fail(503, "Media temporarily unavailable")
    except requests.RequestException:
        log.warning("Social image upload failed")
        fail(503, "Media temporarily unavailable")
    return {"key": key}


@router.post("/media")
async def upload(request: Request, kind: Literal["event", "avatar"] = Query(...),
                 user=Depends(auth()), db: Session = Depends(get_db)):
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > MAX_UPLOAD_BYTES:
        fail(413, "Image exceeds 5 MB")
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > MAX_UPLOAD_BYTES:
            fail(413, "Image exceeds 5 MB")
    # Decoding, DB access and the storage call are blocking, so keep them off the event loop.
    return await run_in_threadpool(store_upload, db, user, kind, bytes(data))


def has_active_regular_event(db, owner_id):
    return db.query(m.SocialEvent.id).filter(
        m.SocialEvent.owner_id == owner_id,
        m.SocialEvent.event_type == "regular",
        m.SocialEvent.expires_at > now(),
    ).first() is not None


@router.get("/events/mine/active")
def active_event_status(user=Depends(auth()), db: Session = Depends(get_db)):
    adults(db, user)
    return {"has_active_event": False if is_admin(user) else has_active_regular_event(db, uid(user))}


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
    if not is_admin(user):
        # Serialize the check and insert for this owner across PostgreSQL workers.
        db.query(m.SocialProfile).filter_by(telegram_id=uid(user)).with_for_update().one()
        if has_active_regular_event(db, uid(user)):
            fail(409, "Only one active event is allowed")
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
        owner_id=uid(user), event_type="global", map_layer=data.map_layer, image_urls=data.image_urls,
        description=data.description, drink=data.drink, visibility=data.visibility,
        latitude=data.latitude, longitude=data.longitude, location=data.location,
        starts_at=data.starts_at, expires_at=data.expires_at,
    )
    db.add(e)
    commit(db)
    return event_json(db, e, uid(user))


def visible_event_filter(viewer):
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
    return (
        m.SocialEvent.expires_at > now(), m.SocialEvent.hidden.is_(False),
        or_(m.SocialEvent.owner_id == viewer,
            and_(~has_block, or_(m.SocialEvent.visibility != "friends", friendship))),
    )


@router.get("/events/map")
def map_events(user=Depends(auth()), db: Session = Depends(get_db)):
    adults(db, user)
    rows = db.query(
        m.SocialEvent.id, m.SocialEvent.latitude, m.SocialEvent.longitude,
        m.SocialEvent.event_type, m.SocialEvent.map_layer, m.SocialEvent.expires_at, m.SocialEvent.starts_at,
        m.SocialEvent.drink, m.SocialEvent.image_urls,
    ).filter(*visible_event_filter(uid(user))).order_by(m.SocialEvent.id.desc()).all()
    return [
        {
            "id": e.id, "latitude": e.latitude, "longitude": e.longitude,
            "event_type": e.event_type, "map_layer": e.map_layer, "expires_at": utc(e.expires_at).isoformat(),
            "starts_at": utc(e.starts_at).isoformat(), "drink": e.drink,
            "image_url": (e.image_urls or [None])[0] if e.event_type == "global" else None,
        }
        for e in rows
    ]


@router.get("/events")
def list_events(user=Depends(auth()), db: Session = Depends(get_db)):
    adults(db, user)
    rows = db.query(m.SocialEvent).filter(
        *visible_event_filter(uid(user))
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
    relations = Relations(db, {uid(user), *(r.telegram_id for r in rows)})
    rows = [r for r in rows if not relations.blocked(uid(user), r.telegram_id)]
    cards = minis(db, [r.telegram_id for r in rows])
    return [{"id": r.id, "user": cards[r.telegram_id]} for r in rows]


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


def chat_json(item, e, viewer, cards):
    return {"id": item.id, "body": item.body, "created_at": utc(item.created_at).isoformat(),
            "sender": None if item.sender_id == e.owner_id and e.visibility == "anonymous"
            and viewer != e.owner_id else cards[item.sender_id],
            "is_mine": item.sender_id == viewer}


@router.get("/events/{event_id}/chat")
def chat(event_id: int, after_id: int = Query(0, ge=0), user=Depends(auth()), db: Session = Depends(get_db)):
    e = chat_access(db, event_id, user)
    if e.event_type == "global":
        adults(db, user)
    rows = db.query(m.SocialChatMessage).filter(
        m.SocialChatMessage.event_id == event_id, m.SocialChatMessage.id > after_id
    ).order_by(m.SocialChatMessage.id).limit(100).all()
    relations = Relations(db, {uid(user), *(row.sender_id for row in rows)})
    rows = [row for row in rows
            if row.sender_id == uid(user) or not relations.blocked(uid(user), row.sender_id)]
    # Anonymous hosts are never serialized for other viewers, so their avatar is not signed either.
    cards = minis(db, {row.sender_id for row in rows
                       if not (row.sender_id == e.owner_id and e.visibility == "anonymous"
                               and uid(user) != e.owner_id)})
    return [chat_json(row, e, uid(user), cards) for row in rows]


@router.post("/events/{event_id}/chat")
def send_chat(event_id: int, data: Message, user=Depends(auth()), db: Session = Depends(get_db)):
    adults(db, user)
    e = chat_access(db, event_id, user)
    item = m.SocialChatMessage(event_id=event_id, sender_id=uid(user), body=data.body)
    db.add(item)
    commit(db)
    return chat_json(item, e, uid(user), minis(db, [item.sender_id]))


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


@router.put("/admin/events/{event_id}")
def update_admin_event(event_id: int, data: dict, user=Depends(admin()), db: Session = Depends(get_db)):
    if db.bind.dialect.name == "sqlite":
        from sqlalchemy import text
        db.execute(text("BEGIN IMMEDIATE"))
    e = db.query(m.SocialEvent).filter_by(id=event_id).with_for_update().first()
    if not e:
        fail(404, "Event not found")
    try:
        update = (GlobalEventUpdate if e.event_type == "global" else RegularEventUpdate).model_validate(data)
    except ValidationError as exc:
        raise RequestValidationError([{"type": error["type"], "loc": ("body", *error["loc"]),
                                       "msg": error["msg"], "input": error.get("input")}
                                      for error in exc.errors()]) from exc
    if update.expires_at <= now() or update.expires_at <= update.starts_at:
        fail(422, "Event must expire in the future and after it starts")
    if e.event_type == "regular":
        if update.capacity is not None:
            accepted = db.query(m.SocialJoinRequest).filter_by(event_id=e.id, status="accepted").count()
            if update.capacity < accepted + 1:
                fail(422, "Capacity cannot be less than accepted attendees and host")
        if update.photo_key is not None and update.photo_key != e.photo_key:
            media = db.query(m.SocialMedia).filter_by(key=update.photo_key).with_for_update().first()
            if (not OPAQUE_MEDIA_KEY.fullmatch(update.photo_key)
                    or not media or media.owner_id != uid(user) or media.kind != "event"):
                fail(422, "Upload your event photo first")
            if db.query(m.SocialEvent).filter_by(photo_key=update.photo_key).first():
                fail(409, "Photo already used")
            e.photo_key = update.photo_key
        e.capacity = update.capacity
    else:
        e.image_urls = update.image_urls
        if "map_layer" in update.model_fields_set:
            e.map_layer = update.map_layer
    for field in ("location", "description", "latitude", "longitude", "drink",
                  "visibility", "starts_at", "expires_at"):
        setattr(e, field, getattr(update, field))
    commit(db)
    return event_json(db, e, uid(user), moderator=True)


@router.delete("/admin/events/{event_id}", status_code=204)
def delete_admin_event(event_id: int, user=Depends(admin()), db: Session = Depends(get_db)):
    e = db.get(m.SocialEvent, event_id)
    if not e:
        fail(404, "Event not found")
    db.delete(e)
    commit(db)
    return Response(status_code=204)


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
