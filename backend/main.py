from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import case, func, inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload
from pydantic import BaseModel, Field
from typing import List, Literal, Optional

import models
from database import engine, get_db

# Автоматически создаем таблицы в Supabase при старте, если их еще нет
models.Base.metadata.create_all(bind=engine)


BottleLabel = Literal["bottle", "samples", "event"]


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
ensure_user_bottle_action_schema()

app = FastAPI(title="Paphos Whisky Club API")

# Настройка CORS, чтобы наш фронтенд на Vercel мог общаться с бэкендом
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшене лучше указать конкретный адрес Vercel
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Схемы валидации данных (Pydantic) ---
class EventCreate(BaseModel):
    title: str
    date: str
    description: str
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
    image_url: Optional[str] = None
    description: Optional[str] = None


class DistilleryResponse(DistilleryCreate):
    id: int

    class Config:
        from_attributes = True


class BottleCreate(BaseModel):
    name: str
    distillery_id: Optional[int] = None
    label: Optional[BottleLabel] = "bottle"
    age: Optional[str] = None
    abv: Optional[str] = None
    price_per_sample: float
    description: str
    image_url: Optional[str] = None


class BottleResponse(BottleCreate):
    id: int
    favorites_count: int
    tried_count: int

    class Config:
        from_attributes = True


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


def get_event_or_404(event_id: int, db: Session) -> models.Event:
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


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


def build_event_response(
    event: models.Event,
    *,
    registered_count: int = 0,
    samples_count: int = 0,
) -> EventResponse:
    return EventResponse(
        id=event.id,
        title=event.title,
        date=event.date,
        description=event.description,
        price=event.price,
        samples_price=event.samples_price,
        image_url=event.image_url,
        has_samples=event.has_samples,
        registered_count=int(registered_count),
        samples_count=int(samples_count),
    )


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
def get_events(db: Session = Depends(get_db)):
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
            registered_count=registered_count,
            samples_count=samples_count,
        )
        for event, registered_count, samples_count in events
    ]

@app.post("/api/events", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def create_event(event_data: EventCreate, db: Session = Depends(get_db)):
    new_event = models.Event(**event_data.model_dump())
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    return build_event_response(new_event)


@app.put("/api/events/{event_id}", response_model=EventResponse)
def update_event(event_id: int, event_data: EventCreate, db: Session = Depends(get_db)):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    for field, value in event_data.model_dump().items():
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
def delete_event(event_id: int, db: Session = Depends(get_db)):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(event)
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
):
    get_event_or_404(event_id, db)
    registration = get_or_create_registration(event_id, registration_data, db)
    registration.registered = registration_data.registered
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
):
    get_event_or_404(event_id, db)
    registration = get_or_create_registration(event_id, samples_data, db)
    registration.samples = samples_data.samples
    db.commit()
    db.refresh(registration)
    return registration


@app.get(
    "/api/events/{event_id}/members",
    response_model=List[RegistrationResponse],
)
def get_event_members(event_id: int, db: Session = Depends(get_db)):
    get_event_or_404(event_id, db)
    return db.query(models.Registration).filter(
        models.Registration.event_id == event_id
    ).order_by(models.Registration.id).all()


# --- ЭНДПОИНТЫ ДЛЯ БУТЫЛОК (BOTTLES) ---

@app.get("/api/distilleries", response_model=List[DistilleryWithBottlesResponse])
def get_distilleries(db: Session = Depends(get_db)):
    return db.query(models.Distillery).options(
        selectinload(models.Distillery.bottles)
    ).order_by(models.Distillery.name).all()


@app.post(
    "/api/distilleries",
    response_model=DistilleryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_distillery(
    distillery_data: DistilleryCreate,
    db: Session = Depends(get_db),
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
    return distillery


@app.put("/api/distilleries/{distillery_id}", response_model=DistilleryResponse)
def update_distillery(
    distillery_id: int,
    distillery_data: DistilleryCreate,
    db: Session = Depends(get_db),
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

    for field, value in distillery_data.model_dump().items():
        setattr(distillery, field, value)

    db.commit()
    db.refresh(distillery)
    return distillery


@app.delete("/api/distilleries/{distillery_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_distillery(distillery_id: int, db: Session = Depends(get_db)):
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
        db.query(models.UserBottleAction).filter(
            models.UserBottleAction.bottle_id.in_(bottle_ids)
        ).delete(synchronize_session=False)
    db.query(models.Bottle).filter(
        models.Bottle.distillery_id == distillery_id
    ).delete(synchronize_session=False)
    db.delete(distillery)
    db.commit()


@app.get("/api/bottles", response_model=List[BottleResponse])
def get_bottles(db: Session = Depends(get_db)):
    return db.query(models.Bottle).all()

@app.post("/api/bottles", response_model=BottleResponse, status_code=status.HTTP_201_CREATED)
def create_bottle(bottle_data: BottleCreate, db: Session = Depends(get_db)):
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
    return new_bottle


@app.put("/api/bottles/{bottle_id}", response_model=BottleResponse)
def update_bottle(
    bottle_id: int,
    bottle_data: BottleCreate,
    db: Session = Depends(get_db),
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

    bottle_payload = bottle_data.model_dump()
    if bottle_payload["label"] is None:
        bottle_payload["label"] = "bottle"

    for field, value in bottle_payload.items():
        setattr(bottle, field, value)

    db.commit()
    db.refresh(bottle)
    return bottle


@app.delete("/api/bottles/{bottle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bottle(bottle_id: int, db: Session = Depends(get_db)):
    bottle = db.query(models.Bottle).filter(models.Bottle.id == bottle_id).first()
    if not bottle:
        raise HTTPException(status_code=404, detail="Bottle not found")
    db.query(models.UserBottleAction).filter(
        models.UserBottleAction.bottle_id == bottle_id
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
):
    bottle = db.query(models.Bottle).filter(
        models.Bottle.id == bottle_id
    ).with_for_update().first()
    if not bottle:
        raise HTTPException(status_code=404, detail="Bottle not found")

    action_field = (
        "is_favorite" if action_data.action_type == "favorite" else "is_tried"
    )
    action = db.query(models.UserBottleAction).filter(
        models.UserBottleAction.telegram_id == action_data.telegram_id,
        models.UserBottleAction.bottle_id == bottle_id,
    ).first()

    current_value = getattr(action, action_field) if action else False
    target_value = not current_value

    if action is None:
        action = models.UserBottleAction(
            telegram_id=action_data.telegram_id,
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
            models.UserBottleAction.telegram_id == action_data.telegram_id,
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
def get_user_bottle_states(telegram_id: int, db: Session = Depends(get_db)):
    return db.query(models.UserBottleAction).filter(
        models.UserBottleAction.telegram_id == telegram_id,
        (models.UserBottleAction.is_favorite.is_(True))
        | (models.UserBottleAction.is_tried.is_(True)),
    ).order_by(models.UserBottleAction.bottle_id).all()