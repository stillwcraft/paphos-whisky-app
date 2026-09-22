import json
from datetime import date, datetime, timezone
from typing import Literal, Optional, Union

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import Date, cast, func
from sqlalchemy.orm import Session

import models
from database import get_db


router = APIRouter(prefix="/api/profile", tags=["profile"])


class EventTrailNode(BaseModel):
    id: str
    type: Literal["event"]
    title: str
    date: str
    image_url: Optional[str] = None
    status: Literal["attended", "missed", "upcoming"]
    bottles_count: int


class MilestoneTrailNode(BaseModel):
    id: str
    type: Literal["milestone"]
    tried_bottles_count: int


class WhiskyTrailResponse(BaseModel):
    status: Literal["success", "empty"]
    focused_node_id: Optional[str] = None
    message: Optional[str] = None
    nodes: list[Union[EventTrailNode, MilestoneTrailNode]]


def get_localized_title(
    values: Optional[dict[str, str]],
    lang: str,
    default_text: Optional[str],
) -> str:
    normalized_lang = (lang or "").strip().lower().replace("_", "-").split("-", 1)[0]
    requested_lang = normalized_lang if normalized_lang in {"en", "ru", "uk"} else None

    if isinstance(values, str):
        try:
            values = json.loads(values)
        except json.JSONDecodeError:
            values = None

    if isinstance(values, dict):
        for locale in (requested_lang, "en", "ru"):
            value = values.get(locale) if locale else None
            if isinstance(value, str) and value.strip():
                return value

    return default_text or ""


def parse_event_date(date_value: Optional[str]) -> Optional[datetime]:
    if not date_value:
        return None

    try:
        parsed_date = datetime.fromisoformat(date_value.replace("Z", "+00:00"))
    except ValueError:
        return None

    if parsed_date.tzinfo is None:
        return parsed_date.replace(tzinfo=timezone.utc)
    return parsed_date.astimezone(timezone.utc)


def get_event_calendar_date(
    date_value: Optional[str],
    parsed_date: Optional[datetime],
) -> Optional[date]:
    if date_value:
        try:
            return date.fromisoformat(date_value[:10])
        except ValueError:
            pass
    return parsed_date.date() if parsed_date else None


@router.get("/whisky-trail", response_model=WhiskyTrailResponse)
def get_whisky_trail(
    telegram_id: int,
    lang: str = Query(default="ru"),
    db: Session = Depends(get_db),
) -> WhiskyTrailResponse:
    events = (
        db.query(models.Event)
        .order_by(cast(models.Event.date, Date).asc())
        .all()
    )

    if not events:
        message = "Start of the Trail" if lang.lower().startswith("en") else "Начало пути"
        return WhiskyTrailResponse(status="empty", message=message, nodes=[])

    registered_event_ids = {
        event_id
        for (event_id,) in (
            db.query(models.Registration.event_id)
            .filter(
                models.Registration.telegram_id == telegram_id,
                models.Registration.registered.is_(True),
            )
            .all()
        )
    }
    event_bottles = {}
    for event_id, bottle_id in (
        db.query(
            models.event_bottles_table.c.event_id,
            models.event_bottles_table.c.bottle_id,
        )
        .all()
    ):
        event_bottles.setdefault(event_id, []).append(bottle_id)

    now = datetime.now(timezone.utc)
    parsed_dates = [parse_event_date(event.date) for event in events]
    event_calendar_dates = [
        get_event_calendar_date(event.date, parsed_date)
        for event, parsed_date in zip(events, parsed_dates)
    ]
    attended_event_ids = {
        event.id
        for event, event_date in zip(events, event_calendar_dates)
        if event_date is not None
        and event_date < now.date()
        and event.id in registered_event_ids
    }
    attended_bottle_ids = {
        bottle_id
        for event_id in attended_event_ids
        for bottle_id in event_bottles.get(event_id, [])
    }
    if attended_bottle_ids:
        bottle_actions = (
            db.query(models.UserBottleAction)
            .filter(
                models.UserBottleAction.telegram_id == telegram_id,
                models.UserBottleAction.bottle_id.in_(attended_bottle_ids),
            )
            .all()
        )
        actions_by_bottle_id = {
            action.bottle_id: action for action in bottle_actions
        }
        for bottle_id in attended_bottle_ids:
            action = actions_by_bottle_id.get(bottle_id)
            if action:
                action.is_tried = True
            else:
                db.add(
                    models.UserBottleAction(
                        telegram_id=telegram_id,
                        bottle_id=bottle_id,
                        is_tried=True,
                    )
                )
        db.commit()

    upcoming_index = next(
        (
            index
            for index, event_date in enumerate(event_calendar_dates)
            if event_date is not None and event_date >= now.date()
        ),
        None,
    )

    nodes: list[Union[EventTrailNode, MilestoneTrailNode]] = []
    last_past_node_id: Optional[str] = None
    cumulative_tried_bottles_count = 0
    for index, (event, event_date) in enumerate(
        zip(events, event_calendar_dates),
        start=1,
    ):
        node_id = f"event_{event.id}"
        is_past = event_date is not None and event_date < now.date()
        event_status: Literal["attended", "missed", "upcoming"]
        if is_past:
            event_status = "attended" if event.id in registered_event_ids else "missed"
            last_past_node_id = node_id
            if event_status == "attended":
                cumulative_tried_bottles_count += len(event_bottles.get(event.id, []))
        else:
            event_status = "upcoming"

        nodes.append(
            EventTrailNode(
                id=node_id,
                type="event",
                title=get_localized_title(event.name_i18n, lang, event.title),
                date=event.date,
                image_url=event.image_url,
                status=event_status,
                bottles_count=len(event_bottles.get(event.id, [])),
            )
        )
        if index % 3 == 0:
            nodes.append(
                MilestoneTrailNode(
                    id=f"milestone_{index}",
                    type="milestone",
                    tried_bottles_count=cumulative_tried_bottles_count,
                )
            )

    focused_node_id = (
        f"event_{events[upcoming_index].id}"
        if upcoming_index is not None
        else last_past_node_id
    )
    return WhiskyTrailResponse(
        status="success",
        focused_node_id=focused_node_id,
        nodes=nodes,
    )
