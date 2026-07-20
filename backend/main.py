import hashlib
import hmac
import json
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Literal, Optional
from urllib.parse import parse_qsl

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import case, func, inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel, Field

import models
from database import engine, get_db

# Автоматически создаем таблицы в Supabase при старте, если их еще нет
models.Base.metadata.create_all(bind=engine)


BottleLabel = Literal["bottle", "samples", "event"]
I18nString = Dict[str, str]
TELEGRAM_INIT_DATA_MAX_AGE = timedelta(hours=24)
TELEGRAM_INIT_DATA_FUTURE_SKEW = timedelta(minutes=5)


def get_table_columns(bind, table_name: str) -> dict[str, dict]:
    return {
        column["name"]: column for column in inspect(bind).get_columns(table_name)
    }


def rebuild_sqlite_bottles_table(
    connection,
    bottle_columns: dict[str, dict],
    *,
    cast_age_to_text: bool,
) -> None:
    legacy_table_name = "bottles_legacy_schema"
    bottle_indexes = inspect(connection).get_indexes("bottles")

    connection.execute(text(f"ALTER TABLE bottles RENAME TO {legacy_table_name}"))
    for index in bottle_indexes:
        index_name = index.get("name")
        if index_name:
            connection.execute(text(f"DROP INDEX IF EXISTS {index_name}"))

    models.Bottle.__table__.create(bind=connection)

    insert_columns = []
    select_columns = []
    for column in models.Bottle.__table__.columns:
        insert_columns.append(column.name)
        if column.name == "label":
            if column.name in bottle_columns:
                select_columns.append("COALESCE(label, 'bottle') AS label")
            else:
                select_columns.append("'bottle' AS label")
        elif column.name == "age" and cast_age_to_text and column.name in bottle_columns:
            select_columns.append("CAST(age AS TEXT) AS age")
        elif column.name in bottle_columns:
            select_columns.append(column.name)
        elif column.name in {"favorites_count", "tried_count"}:
            select_columns.append(f"0 AS {column.name}")
        else:
            select_columns.append(f"NULL AS {column.name}")

    connection.execute(
        text(
            f"""
            INSERT INTO bottles ({", ".join(insert_columns)})
            SELECT {", ".join(select_columns)}
            FROM {legacy_table_name}
            """
        )
    )
    connection.execute(text(f"DROP TABLE {legacy_table_name}"))


def ensure_event_schema() -> None:
    event_columns = get_table_columns(engine, "events")
    with engine.begin() as connection:
        if "has_samples" not in event_columns:
            connection.execute(
                text(
                    "ALTER TABLE events "
                    "ADD COLUMN has_samples BOOLEAN NOT NULL DEFAULT FALSE"
                )
            )
        if "samples_price" not in event_columns:
            samples_price_type = (
                "DOUBLE PRECISION"
                if engine.dialect.name == "postgresql"
                else "FLOAT"
            )
            connection.execute(
                text(
                    "ALTER TABLE events "
                    f"ADD COLUMN samples_price {samples_price_type} NULL"
                )
            )


def ensure_catalog_schema() -> None:
    with engine.begin() as connection:
        bottle_columns = get_table_columns(connection, "bottles")
        if "distillery_id" not in bottle_columns:
            connection.execute(
                text("ALTER TABLE bottles ADD COLUMN distillery_id INTEGER")
            )

            if "distillery" in bottle_columns:
                legacy_bottles = connection.execute(
                    text("SELECT id, distillery FROM bottles")
                ).mappings()
                distillery_ids: dict[str, int] = {}

                for bottle in legacy_bottles:
                    distillery_name = (bottle["distillery"] or "Unspecified").strip()
                    if distillery_name not in distillery_ids:
                        existing_distillery = connection.execute(
                            text("SELECT id FROM distilleries WHERE name = :name"),
                            {"name": distillery_name},
                        ).mappings().first()

                        if existing_distillery:
                            distillery_ids[distillery_name] = existing_distillery["id"]
                        else:
                            connection.execute(
                                text("INSERT INTO distilleries (name) VALUES (:name)"),
                                {"name": distillery_name},
                            )
                            created_distillery = connection.execute(
                                text("SELECT id FROM distilleries WHERE name = :name"),
                                {"name": distillery_name},
                            ).mappings().first()
                            distillery_ids[distillery_name] = created_distillery["id"]

                    connection.execute(
                        text(
                            "UPDATE bottles SET distillery_id = :distillery_id "
                            "WHERE id = :bottle_id"
                        ),
                        {
                            "distillery_id": distillery_ids[distillery_name],
                            "bottle_id": bottle["id"],
                        },
                    )

        distillery_columns = get_table_columns(connection, "distilleries")
        if "description" not in distillery_columns:
            connection.execute(
                text("ALTER TABLE distilleries ADD COLUMN description TEXT")
            )

        bottle_columns = get_table_columns(connection, "bottles")
        if "abv" not in bottle_columns:
            connection.execute(text("ALTER TABLE bottles ADD COLUMN abv TEXT"))
        if "cask" not in bottle_columns:
            connection.execute(text("ALTER TABLE bottles ADD COLUMN cask TEXT"))
        if "bottles" not in bottle_columns:
            connection.execute(text("ALTER TABLE bottles ADD COLUMN bottles TEXT"))
        if "favorites_count" not in bottle_columns:
            connection.execute(
                text(
                    "ALTER TABLE bottles ADD COLUMN favorites_count "
                    "INTEGER NOT NULL DEFAULT 0"
                )
            )
        if "tried_count" not in bottle_columns:
            connection.execute(
                text(
                    "ALTER TABLE bottles ADD COLUMN tried_count "
                    "INTEGER NOT NULL DEFAULT 0"
                )
            )
        if "label" not in bottle_columns:
            connection.execute(
                text(
                    "ALTER TABLE bottles ADD COLUMN label "
                    "VARCHAR NOT NULL DEFAULT 'bottle'"
                )
            )

        bottle_columns = get_table_columns(connection, "bottles")
        age_column = bottle_columns.get("age")
        distillery_column = bottle_columns.get("distillery_id")

        if engine.dialect.name == "postgresql":
            if age_column and "INT" in str(age_column["type"]).upper():
                connection.execute(
                    text(
                        "ALTER TABLE bottles ALTER COLUMN age TYPE VARCHAR "
                        "USING age::VARCHAR"
                    )
                )
            if distillery_column and not distillery_column.get("nullable", True):
                connection.execute(
                    text("ALTER TABLE bottles ALTER COLUMN distillery_id DROP NOT NULL")
                )
        elif engine.dialect.name == "sqlite":
            if (
                age_column
                and "INT" in str(age_column["type"]).upper()
            ) or (
                distillery_column and not distillery_column.get("nullable", True)
            ):
                rebuild_sqlite_bottles_table(
                    connection,
                    bottle_columns,
                    cast_age_to_text=bool(
                        age_column and "INT" in str(age_column["type"]).upper()
                    ),
                )


def ensure_i18n_schema() -> None:
    json_type = "JSONB" if engine.dialect.name == "postgresql" else "JSON"
    i18n_columns = {
        "events": ("name_i18n", "description_i18n"),
        "tasting_tags": ("name_i18n", "description_i18n"),
        "bottles": ("name_i18n", "description_i18n"),
        "distilleries": ("name_i18n", "description_i18n"),
    }

    with engine.begin() as connection:
        for table_name, columns in i18n_columns.items():
            existing_columns = get_table_columns(connection, table_name)
            for column_name in columns:
                if column_name not in existing_columns:
                    connection.execute(
                        text(
                            f"ALTER TABLE {table_name} "
                            f"ADD COLUMN {column_name} {json_type}"
                        )
                    )


def ensure_user_bottle_action_schema() -> None:
    inspector = inspect(engine)
    if "user_bottle_actions" not in inspector.get_table_names():
        return

    indexes = inspector.get_indexes("user_bottle_actions")
    unique_constraints = inspector.get_unique_constraints("user_bottle_actions")
    index_names = {index["name"] for index in indexes}
    has_pair_uniqueness = any(
        set(constraint.get("column_names") or []) == {"telegram_id", "bottle_id"}
        for constraint in unique_constraints
    ) or any(
        index.get("unique")
        and set(index.get("column_names") or []) == {"telegram_id", "bottle_id"}
        for index in indexes
    )

    with engine.begin() as connection:
        if "ix_user_bottle_actions_telegram_id" not in index_names:
            connection.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_user_bottle_actions_telegram_id "
                    "ON user_bottle_actions (telegram_id)"
                )
            )
        if "ix_user_bottle_actions_bottle_id" not in index_names:
            connection.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_user_bottle_actions_bottle_id "
                    "ON user_bottle_actions (bottle_id)"
                )
            )
        if not has_pair_uniqueness:
            duplicate_rows = connection.execute(
                text(
                    """
                    SELECT
                        telegram_id,
                        bottle_id,
                        MIN(id) AS keep_id,
                        MAX(CASE WHEN is_favorite THEN 1 ELSE 0 END) AS is_favorite,
                        MAX(CASE WHEN is_tried THEN 1 ELSE 0 END) AS is_tried
                    FROM user_bottle_actions
                    GROUP BY telegram_id, bottle_id
                    HAVING COUNT(*) > 1
                    """
                )
            ).mappings().all()

            for row in duplicate_rows:
                connection.execute(
                    text(
                        """
                        UPDATE user_bottle_actions
                        SET is_favorite = :is_favorite, is_tried = :is_tried
                        WHERE id = :keep_id
                        """
                    ),
                    {
                        "keep_id": row["keep_id"],
                        "is_favorite": row["is_favorite"],
                        "is_tried": row["is_tried"],
                    },
                )
                connection.execute(
                    text(
                        """
                        DELETE FROM user_bottle_actions
                        WHERE telegram_id = :telegram_id
                          AND bottle_id = :bottle_id
                          AND id != :keep_id
                        """
                    ),
                    {
                        "telegram_id": row["telegram_id"],
                        "bottle_id": row["bottle_id"],
                        "keep_id": row["keep_id"],
                    },
                )

            connection.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS "
                    "uq_user_bottle_action_telegram_bottle_idx "
                    "ON user_bottle_actions (telegram_id, bottle_id)"
                )
            )


ensure_event_schema()
ensure_catalog_schema()
ensure_i18n_schema()
ensure_user_bottle_action_schema()


def ensure_user_review_schema() -> None:
    with engine.begin() as connection:
        all_tables = set(inspect(connection).get_table_names())
        if "user_reviews" not in all_tables:
            models.UserReview.__table__.create(bind=connection)
            all_tables.add("user_reviews")

        review_columns = get_table_columns(connection, "user_reviews")
        for col_name in ("nose", "taste", "finish"):
            if col_name not in review_columns:
                connection.execute(
                    text(
                        f"ALTER TABLE user_reviews "
                        f"ADD COLUMN {col_name} INTEGER NOT NULL DEFAULT 80"
                    )
                )

        review_inspector = inspect(connection)
        review_indexes = review_inspector.get_indexes("user_reviews")
        review_index_names = {idx["name"] for idx in review_indexes}
        if "ix_user_reviews_telegram_id" not in review_index_names:
            connection.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_user_reviews_telegram_id "
                    "ON user_reviews (telegram_id)"
                )
            )
        if "ix_user_reviews_bottle_id" not in review_index_names:
            connection.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_user_reviews_bottle_id "
                    "ON user_reviews (bottle_id)"
                )
            )

        review_unique = review_inspector.get_unique_constraints("user_reviews")
        has_review_pair_unique = any(
            set(c.get("column_names") or []) == {"telegram_id", "bottle_id"}
            for c in review_unique
        ) or any(
            idx.get("unique")
            and set(idx.get("column_names") or []) == {"telegram_id", "bottle_id"}
            for idx in review_indexes
        )
        if not has_review_pair_unique:
            dup_reviews = connection.execute(
                text(
                    """
                    SELECT telegram_id, bottle_id, MIN(id) AS keep_id
                    FROM user_reviews
                    GROUP BY telegram_id, bottle_id
                    HAVING COUNT(*) > 1
                    """
                )
            ).mappings().all()
            for row in dup_reviews:
                if "user_review_tags" in all_tables:
                    connection.execute(
                        text(
                            """
                            DELETE FROM user_review_tags
                            WHERE review_id != :keep_id
                              AND review_id IN (
                                  SELECT id
                                  FROM user_reviews
                                  WHERE telegram_id = :telegram_id
                                    AND bottle_id = :bottle_id
                              )
                            """
                        ),
                        {
                            "telegram_id": row["telegram_id"],
                            "bottle_id": row["bottle_id"],
                            "keep_id": row["keep_id"],
                        },
                    )
                connection.execute(
                    text(
                        """
                        DELETE FROM user_reviews
                        WHERE telegram_id = :telegram_id
                          AND bottle_id = :bottle_id
                          AND id != :keep_id
                        """
                    ),
                    {
                        "telegram_id": row["telegram_id"],
                        "bottle_id": row["bottle_id"],
                        "keep_id": row["keep_id"],
                    },
                )
            connection.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS "
                    "uq_user_review_telegram_bottle_idx "
                    "ON user_reviews (telegram_id, bottle_id)"
                )
            )

        if "user_review_tags" not in all_tables:
            models.UserReviewTag.__table__.create(bind=connection)
        else:
            tag_inspector = inspect(connection)
            tag_indexes = tag_inspector.get_indexes("user_review_tags")
            tag_index_names = {idx["name"] for idx in tag_indexes}
            if "ix_user_review_tags_review_id" not in tag_index_names:
                connection.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_user_review_tags_review_id "
                        "ON user_review_tags (review_id)"
                    )
                )
            if "ix_user_review_tags_tasting_tag_id" not in tag_index_names:
                connection.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_user_review_tags_tasting_tag_id "
                        "ON user_review_tags (tasting_tag_id)"
                    )
                )

            tag_unique = tag_inspector.get_unique_constraints("user_review_tags")
            has_tag_pair_unique = any(
                set(c.get("column_names") or []) == {"review_id", "tasting_tag_id"}
                for c in tag_unique
            ) or any(
                idx.get("unique")
                and set(idx.get("column_names") or []) == {"review_id", "tasting_tag_id"}
                for idx in tag_indexes
            )
            if not has_tag_pair_unique:
                dup_tags = connection.execute(
                    text(
                        """
                        SELECT review_id, tasting_tag_id, MIN(id) AS keep_id
                        FROM user_review_tags
                        GROUP BY review_id, tasting_tag_id
                        HAVING COUNT(*) > 1
                        """
                    )
                ).mappings().all()
                for row in dup_tags:
                    connection.execute(
                        text(
                            """
                            DELETE FROM user_review_tags
                            WHERE review_id = :review_id
                              AND tasting_tag_id = :tasting_tag_id
                              AND id != :keep_id
                            """
                        ),
                        {
                            "review_id": row["review_id"],
                            "tasting_tag_id": row["tasting_tag_id"],
                            "keep_id": row["keep_id"],
                        },
                    )
                connection.execute(
                    text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS "
                        "uq_user_review_tag_review_tasting_idx "
                        "ON user_review_tags (review_id, tasting_tag_id)"
                    )
                )


ensure_user_review_schema()

app = FastAPI(title="Paphos Whisky Club API")

# Настройка CORS, чтобы наш фронтенд на Vercel мог общаться с бэкендом
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшене лучше указать конкретный адрес Vercel
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TelegramAuthContext(BaseModel):
    telegram_id: int
    user: dict


def get_localized_string(
    i18n_dict: Optional[I18nString],
    lang: str,
    default_text: Optional[str],
) -> str:
    values: Any = i18n_dict
    if isinstance(values, str):
        try:
            values = json.loads(values)
        except (TypeError, json.JSONDecodeError):
            values = None

    normalized_lang = (lang or "").strip().lower().replace("_", "-").split("-", 1)[0]
    requested_lang = normalized_lang if normalized_lang in {"en", "ru", "uk"} else None
    if isinstance(values, dict):
        for locale in (requested_lang, "en", "ru"):
            value = values.get(locale) if locale else None
            if isinstance(value, str) and value.strip():
                return value

    return default_text if isinstance(default_text, str) else ""


def get_bot_token() -> str:
    bot_token = os.getenv("BOT_TOKEN")
    if not bot_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Telegram auth is not configured: BOT_TOKEN is missing",
        )
    return bot_token


def parse_authorization_header(authorization: Optional[str]) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )

    scheme, _, credentials = authorization.partition(" ")
    if not credentials or scheme.lower() not in {"tma", "bearer"}:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header must be formatted as 'tma <initData>'",
        )

    raw_init_data = credentials.strip()
    if not raw_init_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Telegram initData is missing",
        )
    return raw_init_data


def parse_telegram_user_id(user_payload: dict) -> int:
    telegram_id = user_payload.get("id")
    if isinstance(telegram_id, bool):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Telegram user id is invalid",
        )

    try:
        parsed_id = int(telegram_id)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Telegram user id is invalid",
        ) from None

    return parsed_id


def validate_telegram_init_data(raw_init_data: str, bot_token: str) -> TelegramAuthContext:
    try:
        init_data_pairs = parse_qsl(
            raw_init_data,
            keep_blank_values=True,
            strict_parsing=True,
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Telegram initData is malformed",
        ) from None

    provided_hash = None
    data_check_pairs: list[tuple[str, str]] = []

    for key, value in init_data_pairs:
        if key == "hash":
            if provided_hash is not None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Telegram initData hash is invalid",
                )
            provided_hash = value
            continue
        data_check_pairs.append((key, value))

    if not provided_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Telegram initData hash is missing",
        )

    data_check_string = "\n".join(
        f"{key}={value}" for key, value in sorted(data_check_pairs, key=lambda item: item[0])
    )
    secret_key = hmac.new(
        key=b"WebAppData",
        msg=bot_token.encode(),
        digestmod=hashlib.sha256,
    ).digest()
    expected_hash = hmac.new(
        key=secret_key,
        msg=data_check_string.encode(),
        digestmod=hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected_hash, provided_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Telegram initData hash is invalid",
        )

    init_data = dict(data_check_pairs)
    auth_date_raw = init_data.get("auth_date")
    try:
        auth_timestamp = int(auth_date_raw) if auth_date_raw is not None else None
    except (TypeError, ValueError):
        auth_timestamp = None

    if auth_timestamp is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Telegram auth_date is invalid",
        )

    auth_datetime = datetime.fromtimestamp(auth_timestamp, tz=timezone.utc)
    now_utc = datetime.now(timezone.utc)
    if auth_datetime > now_utc + TELEGRAM_INIT_DATA_FUTURE_SKEW:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Telegram initData auth_date is in the future",
        )
    if now_utc - auth_datetime > TELEGRAM_INIT_DATA_MAX_AGE:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Telegram initData has expired",
        )

    user_raw = init_data.get("user")
    if not user_raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Telegram user payload is missing",
        )

    try:
        user_payload = json.loads(user_raw)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Telegram user payload is invalid",
        ) from None

    if not isinstance(user_payload, dict):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Telegram user payload is invalid",
        )

    return TelegramAuthContext(
        telegram_id=parse_telegram_user_id(user_payload),
        user=user_payload,
    )


def get_authenticated_telegram_user(
    authorization: Optional[str] = Header(default=None),
) -> TelegramAuthContext:
    raw_init_data = parse_authorization_header(authorization)
    return validate_telegram_init_data(raw_init_data, get_bot_token())


def ensure_telegram_id_matches(authenticated_user: TelegramAuthContext, telegram_id: Optional[int]) -> int:
    if telegram_id is not None and telegram_id != authenticated_user.telegram_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated Telegram user does not match requested telegram_id",
        )
    return authenticated_user.telegram_id


def require_admin(
    authenticated_user: TelegramAuthContext = Depends(get_authenticated_telegram_user),
) -> TelegramAuthContext:
    admin_telegram_id = os.getenv("ADMIN_TELEGRAM_ID")
    if not admin_telegram_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ADMIN_TELEGRAM_ID is not configured",
        )

    try:
        parsed_admin_id = int(admin_telegram_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ADMIN_TELEGRAM_ID is invalid",
        ) from None

    if authenticated_user.telegram_id != parsed_admin_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    return authenticated_user


# --- Схемы валидации данных (Pydantic) ---
class EventCreate(BaseModel):
    title: str
    title_i18n: Optional[I18nString] = None
    name_i18n: Optional[I18nString] = None
    date: str
    description: str
    description_i18n: Optional[I18nString] = None
    price: float
    samples_price: Optional[float] = None
    image_url: Optional[str] = None
    has_samples: bool = False

class EventResponse(EventCreate):
    id: int
    registered_count: int
    samples_count: int

    class Config:
        from_attributes = True

class DistilleryCreate(BaseModel):
    name: str
    name_i18n: Optional[I18nString] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    description_i18n: Optional[I18nString] = None


class DistilleryResponse(DistilleryCreate):
    id: int

    class Config:
        from_attributes = True


class TastingTagCreate(BaseModel):
    name: str
    name_i18n: Optional[I18nString] = None
    description_i18n: Optional[I18nString] = None
    icon_url: str


class TastingTagResponse(TastingTagCreate):
    id: int

    class Config:
        from_attributes = True


class BottleCreate(BaseModel):
    name: str
    name_i18n: Optional[I18nString] = None
    distillery_id: Optional[int] = None
    label: Optional[BottleLabel] = "bottle"
    age: Optional[str] = None
    abv: Optional[str] = None
    cask: Optional[str] = None
    bottles: Optional[str] = None
    price_per_sample: float
    description: str
    description_i18n: Optional[I18nString] = None
    image_url: Optional[str] = None


class BottleUpdate(BottleCreate):
    cask: Optional[str] = None
    bottles: Optional[str] = None


class BottleResponse(BottleCreate):
    cask: Optional[str] = None
    bottles: Optional[str] = None
    id: int
    favorites_count: int
    tried_count: int

    class Config:
        from_attributes = True


class BottleTagStatResponse(BaseModel):
    id: int
    name: str
    icon_url: str
    count: int


class BottleTagStatsResponse(BaseModel):
    club_rating: Optional[float]
    tags: List[BottleTagStatResponse]


class DistilleryWithBottlesResponse(DistilleryResponse):
    bottles: List[BottleResponse] = Field(default_factory=list)


class BottleActionToggleRequest(BaseModel):
    telegram_id: int
    action_type: Literal["favorite", "tried"]


class UserBottleStateResponse(BaseModel):
    bottle_id: int
    is_favorite: bool
    is_tried: bool

    class Config:
        from_attributes = True


class BottleActionToggleResponse(UserBottleStateResponse):
    favorites_count: int
    tried_count: int


class ReviewCreate(BaseModel):
    telegram_id: int
    bottle_id: int
    nose: int = Field(default=80, ge=0, le=100)
    taste: int = Field(default=80, ge=0, le=100)
    finish: int = Field(default=80, ge=0, le=100)
    tag_ids: List[int] = Field(default_factory=list)


class ReviewQuery(BaseModel):
    telegram_id: int
    bottle_id: int


class ReviewResponse(BaseModel):
    id: Optional[int]
    telegram_id: int
    bottle_id: int
    nose: int
    taste: int
    finish: int
    tag_ids: List[int]

    class Config:
        from_attributes = True


class RegistrationBase(BaseModel):
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None


class RegistrationRequest(RegistrationBase):
    registered: bool


class SamplesRequest(RegistrationBase):
    samples: bool


class RegistrationResponse(RegistrationBase):
    id: int
    event_id: int
    registered: bool
    samples: bool

    class Config:
        from_attributes = True


class MemberResponse(BaseModel):
    id: int
    registered: bool
    samples: bool

    class Config:
        from_attributes = True


class UserStatsResponse(BaseModel):
    tastings_attended: int
    tested_releases: int


def get_event_or_404(event_id: int, db: Session) -> models.Event:
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


def bind_registration_to_authenticated_user(
    registration_data: RegistrationBase,
    authenticated_user: TelegramAuthContext,
) -> RegistrationBase:
    ensure_telegram_id_matches(authenticated_user, registration_data.telegram_id)
    return registration_data.model_copy(update={"telegram_id": authenticated_user.telegram_id})


def get_or_create_registration(
    event_id: int,
    registration_data: RegistrationBase,
    db: Session,
) -> models.Registration:
    registration = db.query(models.Registration).filter(
        models.Registration.event_id == event_id,
        models.Registration.telegram_id == registration_data.telegram_id,
    ).first()

    if registration:
        registration.username = registration_data.username
        registration.first_name = registration_data.first_name
        return registration

    registration = models.Registration(
        event_id=event_id,
        telegram_id=registration_data.telegram_id,
        username=registration_data.username,
        first_name=registration_data.first_name,
    )
    db.add(registration)
    return registration


def recompute_bottle_counts(bottle: models.Bottle, db: Session) -> None:
    favorites_count, tried_count = db.query(
        func.coalesce(
            func.sum(
                case((models.UserBottleAction.is_favorite.is_(True), 1), else_=0)
            ),
            0,
        ),
        func.coalesce(
            func.sum(case((models.UserBottleAction.is_tried.is_(True), 1), else_=0)),
            0,
        ),
    ).filter(models.UserBottleAction.bottle_id == bottle.id).one()
    bottle.favorites_count = favorites_count
    bottle.tried_count = tried_count


def parse_event_date_to_utc(date_value: Optional[str]) -> Optional[datetime]:
    if not date_value:
        return None

    normalized_value = date_value.strip()
    if not normalized_value:
        return None

    if normalized_value.endswith(("Z", "z")):
        normalized_value = f"{normalized_value[:-1]}+00:00"

    try:
        parsed_date = datetime.fromisoformat(normalized_value)
    except ValueError:
        return None

    if parsed_date.tzinfo is None:
        return parsed_date.replace(tzinfo=timezone.utc)

    return parsed_date.astimezone(timezone.utc)


def build_event_response(
    event: models.Event,
    *,
    lang: str = "en",
    registered_count: int = 0,
    samples_count: int = 0,
) -> EventResponse:
    title_i18n = event.title_i18n
    return EventResponse(
        id=event.id,
        title=get_localized_string(title_i18n, lang, event.title),
        title_i18n=title_i18n,
        name_i18n=title_i18n,
        date=event.date,
        description=get_localized_string(
            event.description_i18n,
            lang,
            event.description,
        ),
        description_i18n=event.description_i18n,
        price=event.price,
        samples_price=event.samples_price,
        image_url=event.image_url,
        has_samples=event.has_samples,
        registered_count=int(registered_count),
        samples_count=int(samples_count),
    )


def build_tasting_tag_response(
    tag: models.TastingTag,
    *,
    lang: str = "en",
) -> TastingTagResponse:
    return TastingTagResponse(
        id=tag.id,
        name=get_localized_string(tag.name_i18n, lang, tag.name),
        name_i18n=tag.name_i18n,
        description_i18n=tag.description_i18n,
        icon_url=tag.icon_url,
    )


def build_bottle_response(
    bottle: models.Bottle,
    *,
    lang: str = "en",
) -> BottleResponse:
    return BottleResponse(
        id=bottle.id,
        name=get_localized_string(bottle.name_i18n, lang, bottle.name),
        name_i18n=bottle.name_i18n,
        distillery_id=bottle.distillery_id,
        label=bottle.label,
        age=bottle.age,
        abv=bottle.abv,
        cask=bottle.cask,
        bottles=bottle.bottles,
        price_per_sample=bottle.price_per_sample,
        description=get_localized_string(
            bottle.description_i18n,
            lang,
            bottle.description,
        ),
        description_i18n=bottle.description_i18n,
        image_url=bottle.image_url,
        favorites_count=bottle.favorites_count,
        tried_count=bottle.tried_count,
    )


def build_distillery_response(
    distillery: models.Distillery,
    *,
    lang: str = "en",
) -> DistilleryResponse:
    return DistilleryResponse(
        id=distillery.id,
        name=get_localized_string(distillery.name_i18n, lang, distillery.name),
        name_i18n=distillery.name_i18n,
        image_url=distillery.image_url,
        description=get_localized_string(
            distillery.description_i18n,
            lang,
            distillery.description,
        ),
        description_i18n=distillery.description_i18n,
    )


def build_distillery_with_bottles_response(
    distillery: models.Distillery,
    *,
    lang: str = "en",
) -> DistilleryWithBottlesResponse:
    return DistilleryWithBottlesResponse(
        **build_distillery_response(distillery, lang=lang).model_dump(),
        bottles=[
            build_bottle_response(bottle, lang=lang)
            for bottle in distillery.bottles
        ],
    )


def build_event_payload(event_data: EventCreate, *, exclude_unset: bool) -> dict:
    payload = event_data.model_dump(exclude_unset=exclude_unset)
    if "title_i18n" in event_data.model_fields_set:
        payload["name_i18n"] = payload.pop("title_i18n", None)
    else:
        payload.pop("title_i18n", None)
    return payload


def get_event_counts_subquery(db: Session):
    return (
        db.query(
            models.Registration.event_id.label("event_id"),
            func.coalesce(
                func.sum(
                    case((models.Registration.registered.is_(True), 1), else_=0)
                ),
                0,
            ).label("registered_count"),
            func.coalesce(
                func.sum(case((models.Registration.samples.is_(True), 1), else_=0)),
                0,
            ).label("samples_count"),
        )
        .group_by(models.Registration.event_id)
        .subquery()
    )


# --- ЭНДПОИНТЫ ДЛЯ СОБЫТИЙ (EVENTS) ---

@app.get("/api/events", response_model=List[EventResponse])
def get_events(lang: str = "en", db: Session = Depends(get_db)):
    event_counts = get_event_counts_subquery(db)
    events = (
        db.query(
            models.Event,
            func.coalesce(event_counts.c.registered_count, 0).label("registered_count"),
            func.coalesce(event_counts.c.samples_count, 0).label("samples_count"),
        )
        .outerjoin(event_counts, models.Event.id == event_counts.c.event_id)
        .all()
    )
    return [
        build_event_response(
            event,
            lang=lang,
            registered_count=registered_count,
            samples_count=samples_count,
        )
        for event, registered_count, samples_count in events
    ]

@app.post("/api/events", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def create_event(
    event_data: EventCreate,
    db: Session = Depends(get_db),
    _: TelegramAuthContext = Depends(require_admin),
):
    new_event = models.Event(**build_event_payload(event_data, exclude_unset=False))
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    return build_event_response(new_event)


@app.put("/api/events/{event_id}", response_model=EventResponse)
def update_event(
    event_id: int,
    event_data: EventCreate,
    db: Session = Depends(get_db),
    _: TelegramAuthContext = Depends(require_admin),
):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    for field, value in build_event_payload(event_data, exclude_unset=True).items():
        setattr(event, field, value)

    db.commit()
    db.refresh(event)
    event_counts = get_event_counts_subquery(db)
    registered_count, samples_count = (
        db.query(
            func.coalesce(event_counts.c.registered_count, 0),
            func.coalesce(event_counts.c.samples_count, 0),
        )
        .select_from(models.Event)
        .outerjoin(event_counts, models.Event.id == event_counts.c.event_id)
        .filter(models.Event.id == event_id)
        .one()
    )
    return build_event_response(
        event,
        registered_count=registered_count,
        samples_count=samples_count,
    )


@app.delete("/api/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    _: TelegramAuthContext = Depends(require_admin),
):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(event)
    db.commit()
    return


@app.get("/api/tasting-tags", response_model=List[TastingTagResponse])
def get_tasting_tags(lang: str = "en", db: Session = Depends(get_db)):
    tags = db.query(models.TastingTag).order_by(models.TastingTag.name).all()
    return [build_tasting_tag_response(tag, lang=lang) for tag in tags]


@app.post(
    "/api/admin/tasting-tags",
    response_model=TastingTagResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_tasting_tag(
    tag_data: TastingTagCreate,
    db: Session = Depends(get_db),
    _: TelegramAuthContext = Depends(require_admin),
):
    tag = models.TastingTag(**tag_data.model_dump())
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return build_tasting_tag_response(tag)


@app.put("/api/admin/tasting-tags/{tag_id}", response_model=TastingTagResponse)
def update_tasting_tag(
    tag_id: int,
    tag_data: TastingTagCreate,
    db: Session = Depends(get_db),
    _: TelegramAuthContext = Depends(require_admin),
):
    tag = db.query(models.TastingTag).filter(models.TastingTag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tasting tag not found")

    for field, value in tag_data.model_dump(exclude_unset=True).items():
        setattr(tag, field, value)

    db.commit()
    db.refresh(tag)
    return build_tasting_tag_response(tag)


@app.delete(
    "/api/admin/tasting-tags/{tag_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_tasting_tag(
    tag_id: int,
    db: Session = Depends(get_db),
    _: TelegramAuthContext = Depends(require_admin),
):
    tag = db.query(models.TastingTag).filter(models.TastingTag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tasting tag not found")
    db.query(models.UserReviewTag).filter(
        models.UserReviewTag.tasting_tag_id == tag_id
    ).delete(synchronize_session=False)
    db.delete(tag)
    db.commit()
    return


@app.post(
    "/api/events/{event_id}/register",
    response_model=RegistrationResponse,
)
def register_for_event(
    event_id: int,
    registration_data: RegistrationRequest,
    db: Session = Depends(get_db),
    authenticated_user: TelegramAuthContext = Depends(get_authenticated_telegram_user),
):
    get_event_or_404(event_id, db)
    bound_registration = bind_registration_to_authenticated_user(
        registration_data,
        authenticated_user,
    )
    registration = get_or_create_registration(event_id, bound_registration, db)
    registration.registered = bound_registration.registered
    db.commit()
    db.refresh(registration)
    return registration


@app.post(
    "/api/events/{event_id}/samples",
    response_model=RegistrationResponse,
)
def reserve_samples(
    event_id: int,
    samples_data: SamplesRequest,
    db: Session = Depends(get_db),
    authenticated_user: TelegramAuthContext = Depends(get_authenticated_telegram_user),
):
    get_event_or_404(event_id, db)
    bound_samples = bind_registration_to_authenticated_user(
        samples_data,
        authenticated_user,
    )
    registration = get_or_create_registration(event_id, bound_samples, db)
    registration.samples = bound_samples.samples
    db.commit()
    db.refresh(registration)
    return registration


@app.get(
    "/api/events/{event_id}/members",
    response_model=List[MemberResponse],
)
def get_event_members(
    event_id: int,
    db: Session = Depends(get_db),
    _: TelegramAuthContext = Depends(get_authenticated_telegram_user),
):
    get_event_or_404(event_id, db)
    return db.query(models.Registration).filter(
        models.Registration.event_id == event_id
    ).order_by(models.Registration.id).all()


@app.get("/api/users/{telegram_id}/stats", response_model=UserStatsResponse)
def get_user_stats(
    telegram_id: int,
    db: Session = Depends(get_db),
    authenticated_user: TelegramAuthContext = Depends(get_authenticated_telegram_user),
):
    telegram_id = ensure_telegram_id_matches(authenticated_user, telegram_id)
    now_utc = datetime.utcnow().replace(tzinfo=timezone.utc)
    attended_tastings = 0

    registered_event_dates = (
        db.query(models.Event.date)
        .join(models.Registration, models.Registration.event_id == models.Event.id)
        .filter(
            models.Registration.telegram_id == telegram_id,
            models.Registration.registered.is_(True),
        )
        .all()
    )

    for (event_date,) in registered_event_dates:
        parsed_event_date = parse_event_date_to_utc(event_date)
        if parsed_event_date and parsed_event_date <= now_utc:
            attended_tastings += 1

    tested_releases = (
        db.query(func.count(models.UserBottleAction.id))
        .filter(
            models.UserBottleAction.telegram_id == telegram_id,
            models.UserBottleAction.is_tried.is_(True),
        )
        .scalar()
        or 0
    )

    return UserStatsResponse(
        tastings_attended=attended_tastings,
        tested_releases=int(tested_releases),
    )


# --- ЭНДПОИНТЫ ДЛЯ БУТЫЛОК (BOTTLES) ---

@app.get("/api/distilleries", response_model=List[DistilleryWithBottlesResponse])
def get_distilleries(lang: str = "en", db: Session = Depends(get_db)):
    distilleries = db.query(models.Distillery).options(
        joinedload(models.Distillery.bottles)
    ).order_by(models.Distillery.name).all()
    return [
        build_distillery_with_bottles_response(distillery, lang=lang)
        for distillery in distilleries
    ]


@app.post(
    "/api/distilleries",
    response_model=DistilleryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_distillery(
    distillery_data: DistilleryCreate,
    db: Session = Depends(get_db),
    _: TelegramAuthContext = Depends(require_admin),
):
    existing_distillery = db.query(models.Distillery).filter(
        models.Distillery.name == distillery_data.name
    ).first()
    if existing_distillery:
        raise HTTPException(status_code=409, detail="Distillery already exists")

    distillery = models.Distillery(**distillery_data.model_dump())
    db.add(distillery)
    db.commit()
    db.refresh(distillery)
    return build_distillery_response(distillery)


@app.put("/api/distilleries/{distillery_id}", response_model=DistilleryResponse)
def update_distillery(
    distillery_id: int,
    distillery_data: DistilleryCreate,
    db: Session = Depends(get_db),
    _: TelegramAuthContext = Depends(require_admin),
):
    distillery = db.query(models.Distillery).filter(
        models.Distillery.id == distillery_id
    ).first()
    if not distillery:
        raise HTTPException(status_code=404, detail="Distillery not found")

    same_name_distillery = db.query(models.Distillery).filter(
        models.Distillery.name == distillery_data.name,
        models.Distillery.id != distillery_id,
    ).first()
    if same_name_distillery:
        raise HTTPException(status_code=409, detail="Distillery already exists")

    for field, value in distillery_data.model_dump(exclude_unset=True).items():
        setattr(distillery, field, value)

    db.commit()
    db.refresh(distillery)
    return build_distillery_response(distillery)


@app.delete("/api/distilleries/{distillery_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_distillery(
    distillery_id: int,
    db: Session = Depends(get_db),
    _: TelegramAuthContext = Depends(require_admin),
):
    distillery = db.query(models.Distillery).filter(
        models.Distillery.id == distillery_id
    ).first()
    if not distillery:
        raise HTTPException(status_code=404, detail="Distillery not found")

    bottle_ids = [
        bottle_id
        for (bottle_id,) in db.query(models.Bottle.id).filter(
            models.Bottle.distillery_id == distillery_id
        ).all()
    ]
    if bottle_ids:
        review_ids = [
            review_id
            for (review_id,) in db.query(models.UserReview.id).filter(
                models.UserReview.bottle_id.in_(bottle_ids)
            ).all()
        ]
        db.query(models.UserBottleAction).filter(
            models.UserBottleAction.bottle_id.in_(bottle_ids)
        ).delete(synchronize_session=False)
        if review_ids:
            db.query(models.UserReviewTag).filter(
                models.UserReviewTag.review_id.in_(review_ids)
            ).delete(synchronize_session=False)
        db.query(models.UserReview).filter(
            models.UserReview.bottle_id.in_(bottle_ids)
        ).delete(synchronize_session=False)
    db.query(models.Bottle).filter(
        models.Bottle.distillery_id == distillery_id
    ).delete(synchronize_session=False)
    db.delete(distillery)
    db.commit()


@app.get("/api/bottles", response_model=List[BottleResponse])
def get_bottles(lang: str = "en", db: Session = Depends(get_db)):
    bottles = db.query(models.Bottle).all()
    return [build_bottle_response(bottle, lang=lang) for bottle in bottles]


@app.get(
    "/api/bottles/{bottle_id}/tag-stats",
    response_model=BottleTagStatsResponse,
)
def get_bottle_tag_stats(
    bottle_id: int,
    db: Session = Depends(get_db),
    lang: str = "en",
) -> BottleTagStatsResponse:
    bottle_exists = db.query(models.Bottle.id).filter(
        models.Bottle.id == bottle_id
    ).first()
    if not bottle_exists:
        raise HTTPException(status_code=404, detail="Bottle not found")

    tag_stats = (
        db.query(
            models.TastingTag.id.label("id"),
            models.TastingTag.name.label("name"),
            models.TastingTag.name_i18n.label("name_i18n"),
            models.TastingTag.icon_url.label("icon_url"),
            func.count(models.UserReviewTag.review_id).label("count"),
        )
        .join(
            models.UserReviewTag,
            models.UserReviewTag.tasting_tag_id == models.TastingTag.id,
        )
        .join(
            models.UserReview,
            models.UserReview.id == models.UserReviewTag.review_id,
        )
        .filter(models.UserReview.bottle_id == bottle_id)
        .group_by(
            models.TastingTag.id,
            models.TastingTag.name,
            models.TastingTag.name_i18n,
            models.TastingTag.icon_url,
        )
        .order_by(
            func.count(models.UserReviewTag.review_id).desc(),
            models.TastingTag.name.asc(),
            models.TastingTag.id.asc(),
        )
        .limit(10)
        .all()
    )
    rating = db.query(
        func.avg(
            (models.UserReview.nose + models.UserReview.taste + models.UserReview.finish)
            / 3.0
        )
    ).filter(models.UserReview.bottle_id == bottle_id).scalar()

    return BottleTagStatsResponse(
        club_rating=round(float(rating), 2) if rating is not None else None,
        tags=[
            BottleTagStatResponse(
                id=tag_id,
                name=get_localized_string(name_i18n, lang, name),
                icon_url=icon_url,
                count=int(count),
            )
            for tag_id, name, name_i18n, icon_url, count in tag_stats
        ],
    )


@app.post("/api/bottles", response_model=BottleResponse, status_code=status.HTTP_201_CREATED)
def create_bottle(
    bottle_data: BottleCreate,
    db: Session = Depends(get_db),
    _: TelegramAuthContext = Depends(require_admin),
):
    if bottle_data.distillery_id is not None:
        distillery = db.query(models.Distillery).filter(
            models.Distillery.id == bottle_data.distillery_id
        ).first()
        if not distillery:
            raise HTTPException(status_code=404, detail="Distillery not found")

    bottle_payload = bottle_data.model_dump()
    if bottle_payload["label"] is None:
        bottle_payload["label"] = "bottle"

    new_bottle = models.Bottle(**bottle_payload)
    db.add(new_bottle)
    db.commit()
    db.refresh(new_bottle)
    return build_bottle_response(new_bottle)


@app.put("/api/bottles/{bottle_id}", response_model=BottleResponse)
def update_bottle(
    bottle_id: int,
    bottle_data: BottleUpdate,
    db: Session = Depends(get_db),
    _: TelegramAuthContext = Depends(require_admin),
):
    bottle = db.query(models.Bottle).filter(
        models.Bottle.id == bottle_id
    ).first()
    if not bottle:
        raise HTTPException(status_code=404, detail="Bottle not found")

    if bottle_data.distillery_id is not None:
        distillery = db.query(models.Distillery).filter(
            models.Distillery.id == bottle_data.distillery_id
        ).first()
        if not distillery:
            raise HTTPException(status_code=404, detail="Distillery not found")

    bottle_payload = bottle_data.model_dump(exclude_unset=True)
    if bottle_payload.get("label") is None and "label" in bottle_payload:
        bottle_payload["label"] = "bottle"

    for field, value in bottle_payload.items():
        setattr(bottle, field, value)

    db.commit()
    db.refresh(bottle)
    return build_bottle_response(bottle)


@app.delete("/api/bottles/{bottle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bottle(
    bottle_id: int,
    db: Session = Depends(get_db),
    _: TelegramAuthContext = Depends(require_admin),
):
    bottle = db.query(models.Bottle).filter(models.Bottle.id == bottle_id).first()
    if not bottle:
        raise HTTPException(status_code=404, detail="Bottle not found")
    review_ids = [
        review_id
        for (review_id,) in db.query(models.UserReview.id).filter(
            models.UserReview.bottle_id == bottle_id
        ).all()
    ]
    db.query(models.UserBottleAction).filter(
        models.UserBottleAction.bottle_id == bottle_id
    ).delete(synchronize_session=False)
    if review_ids:
        db.query(models.UserReviewTag).filter(
            models.UserReviewTag.review_id.in_(review_ids)
        ).delete(synchronize_session=False)
    db.query(models.UserReview).filter(
        models.UserReview.bottle_id == bottle_id
    ).delete(synchronize_session=False)
    db.delete(bottle)
    db.commit()
    return


@app.post(
    "/api/bottles/{bottle_id}/toggle-action",
    response_model=BottleActionToggleResponse,
)
def toggle_bottle_action(
    bottle_id: int,
    action_data: BottleActionToggleRequest,
    db: Session = Depends(get_db),
    authenticated_user: TelegramAuthContext = Depends(get_authenticated_telegram_user),
):
    telegram_id = ensure_telegram_id_matches(authenticated_user, action_data.telegram_id)
    bottle = db.query(models.Bottle).filter(
        models.Bottle.id == bottle_id
    ).with_for_update().first()
    if not bottle:
        raise HTTPException(status_code=404, detail="Bottle not found")

    action_field = (
        "is_favorite" if action_data.action_type == "favorite" else "is_tried"
    )
    action = db.query(models.UserBottleAction).filter(
        models.UserBottleAction.telegram_id == telegram_id,
        models.UserBottleAction.bottle_id == bottle_id,
    ).first()

    current_value = getattr(action, action_field) if action else False
    target_value = not current_value

    if action is None:
        action = models.UserBottleAction(
            telegram_id=telegram_id,
            bottle_id=bottle_id,
        )
        db.add(action)

    setattr(action, action_field, target_value)

    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        bottle = db.query(models.Bottle).filter(
            models.Bottle.id == bottle_id
        ).with_for_update().first()
        if not bottle:
            raise HTTPException(status_code=404, detail="Bottle not found")
        action = db.query(models.UserBottleAction).filter(
            models.UserBottleAction.telegram_id == telegram_id,
            models.UserBottleAction.bottle_id == bottle_id,
        ).first()
        if action is None:
            raise HTTPException(
                status_code=409,
                detail="Failed to persist bottle action",
            )
        setattr(action, action_field, target_value)
        db.flush()

    recompute_bottle_counts(bottle, db)
    db.commit()
    db.refresh(action)
    db.refresh(bottle)

    return BottleActionToggleResponse(
        bottle_id=bottle.id,
        is_favorite=action.is_favorite,
        is_tried=action.is_tried,
        favorites_count=bottle.favorites_count,
        tried_count=bottle.tried_count,
    )


@app.get(
    "/api/bottles/user-states",
    response_model=List[UserBottleStateResponse],
)
def get_user_bottle_states(
    telegram_id: Optional[int] = None,
    db: Session = Depends(get_db),
    authenticated_user: TelegramAuthContext = Depends(get_authenticated_telegram_user),
):
    telegram_id = ensure_telegram_id_matches(authenticated_user, telegram_id)
    return db.query(models.UserBottleAction).filter(
        models.UserBottleAction.telegram_id == telegram_id,
        (models.UserBottleAction.is_favorite.is_(True))
        | (models.UserBottleAction.is_tried.is_(True)),
    ).order_by(models.UserBottleAction.bottle_id).all()


def build_review_response(review: models.UserReview) -> ReviewResponse:
    return ReviewResponse(
        id=review.id,
        telegram_id=review.telegram_id,
        bottle_id=review.bottle_id,
        nose=review.nose,
        taste=review.taste,
        finish=review.finish,
        tag_ids=[tag.id for tag in review.tags],
    )


@app.get("/api/reviews", response_model=ReviewResponse)
def get_review(
    review_query: ReviewQuery = Depends(),
    db: Session = Depends(get_db),
    authenticated_user: TelegramAuthContext = Depends(get_authenticated_telegram_user),
):
    telegram_id = ensure_telegram_id_matches(
        authenticated_user,
        review_query.telegram_id,
    )
    review = (
        db.query(models.UserReview)
        .options(joinedload(models.UserReview.tags))
        .filter(
            models.UserReview.telegram_id == telegram_id,
            models.UserReview.bottle_id == review_query.bottle_id,
        )
        .first()
    )
    if review is None:
        return ReviewResponse(
            id=None,
            telegram_id=telegram_id,
            bottle_id=review_query.bottle_id,
            nose=80,
            taste=80,
            finish=80,
            tag_ids=[],
        )
    return build_review_response(review)


@app.post("/api/reviews", response_model=ReviewResponse)
def upsert_review(
    review_data: ReviewCreate,
    db: Session = Depends(get_db),
    authenticated_user: TelegramAuthContext = Depends(get_authenticated_telegram_user),
):
    telegram_id = ensure_telegram_id_matches(authenticated_user, review_data.telegram_id)
    bottle_id = review_data.bottle_id

    bottle = (
        db.query(models.Bottle)
        .filter(models.Bottle.id == bottle_id)
        .with_for_update()
        .first()
    )
    if not bottle:
        raise HTTPException(status_code=404, detail="Bottle not found")

    # Deduplicate tag IDs (preserve first occurrence order).
    unique_tag_ids = list(dict.fromkeys(review_data.tag_ids))
    if unique_tag_ids:
        found_ids = {
            tag_id
            for (tag_id,) in db.query(models.TastingTag.id)
            .filter(models.TastingTag.id.in_(unique_tag_ids))
            .all()
        }
        unknown_ids = [tid for tid in unique_tag_ids if tid not in found_ids]
        if unknown_ids:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unknown tasting tag IDs: {unknown_ids}",
            )

    review = db.query(models.UserReview).filter(
        models.UserReview.telegram_id == telegram_id,
        models.UserReview.bottle_id == bottle_id,
    ).first()

    if review is None:
        review = models.UserReview(
            telegram_id=telegram_id,
            bottle_id=bottle_id,
            nose=review_data.nose,
            taste=review_data.taste,
            finish=review_data.finish,
        )
        db.add(review)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            # Race condition: re-acquire lock and load existing row.
            bottle = (
                db.query(models.Bottle)
                .filter(models.Bottle.id == bottle_id)
                .with_for_update()
                .first()
            )
            if not bottle:
                raise HTTPException(status_code=404, detail="Bottle not found")
            review = db.query(models.UserReview).filter(
                models.UserReview.telegram_id == telegram_id,
                models.UserReview.bottle_id == bottle_id,
            ).first()
            if review is None:
                raise HTTPException(
                    status_code=409,
                    detail="Failed to create review",
                )
            review.nose = review_data.nose
            review.taste = review_data.taste
            review.finish = review_data.finish
    else:
        review.nose = review_data.nose
        review.taste = review_data.taste
        review.finish = review_data.finish
        db.flush()

    # Use the current Session transaction so the flushed review ID is visible.
    db.execute(
        text("DELETE FROM user_review_tags WHERE review_id = :review_id"),
        {"review_id": review.id},
    )
    if unique_tag_ids:
        db.execute(
            text(
                """
                INSERT INTO user_review_tags (review_id, tasting_tag_id)
                VALUES (:review_id, :tasting_tag_id)
                """
            ),
            [
                {"review_id": review.id, "tasting_tag_id": tag_id}
                for tag_id in unique_tag_ids
            ],
        )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Selected tasting tags are no longer available",
        ) from None

    return ReviewResponse(
        id=review.id,
        telegram_id=review.telegram_id,
        bottle_id=review.bottle_id,
        nose=review.nose,
        taste=review.taste,
        finish=review.finish,
        tag_ids=unique_tag_ids,
    )