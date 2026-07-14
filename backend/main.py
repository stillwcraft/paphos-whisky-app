from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

import models
from database import engine, get_db

# Автоматически создаем таблицы в Supabase при старте, если их еще нет
models.Base.metadata.create_all(bind=engine)


def ensure_event_schema() -> None:
    event_columns = {
        column["name"] for column in inspect(engine).get_columns("events")
    }
    if "has_samples" not in event_columns:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE events "
                    "ADD COLUMN has_samples BOOLEAN NOT NULL DEFAULT FALSE"
                )
            )


def ensure_catalog_schema() -> None:
    bottle_columns = {
        column["name"] for column in inspect(engine).get_columns("bottles")
    }
    if "distillery_id" in bottle_columns:
        return

    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE bottles ADD COLUMN distillery_id INTEGER")
        )

        if "distillery" not in bottle_columns:
            return

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


ensure_event_schema()
ensure_catalog_schema()

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
    image_url: Optional[str] = None
    has_samples: bool = False

class EventResponse(EventCreate):
    id: int
    class Config:
        from_attributes = True

class DistilleryCreate(BaseModel):
    name: str
    image_url: Optional[str] = None


class DistilleryResponse(DistilleryCreate):
    id: int

    class Config:
        from_attributes = True


class BottleCreate(BaseModel):
    name: str
    distillery_id: int
    age: Optional[int] = None
    price_per_sample: float
    description: str
    image_url: Optional[str] = None

class BottleResponse(BottleCreate):
    id: int
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


# --- ЭНДПОИНТЫ ДЛЯ СОБЫТИЙ (EVENTS) ---

@app.get("/api/events", response_model=List[EventResponse])
def get_events(db: Session = Depends(get_db)):
    return db.query(models.Event).all()

@app.post("/api/events", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def create_event(event_data: EventCreate, db: Session = Depends(get_db)):
    new_event = models.Event(**event_data.model_dump())
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    return new_event


@app.put("/api/events/{event_id}", response_model=EventResponse)
def update_event(event_id: int, event_data: EventCreate, db: Session = Depends(get_db)):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    for field, value in event_data.model_dump().items():
        setattr(event, field, value)

    db.commit()
    db.refresh(event)
    return event


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

@app.get("/api/distilleries", response_model=List[DistilleryResponse])
def get_distilleries(db: Session = Depends(get_db)):
    return db.query(models.Distillery).order_by(models.Distillery.name).all()


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


@app.delete("/api/distilleries/{distillery_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_distillery(distillery_id: int, db: Session = Depends(get_db)):
    distillery = db.query(models.Distillery).filter(
        models.Distillery.id == distillery_id
    ).first()
    if not distillery:
        raise HTTPException(status_code=404, detail="Distillery not found")

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
    distillery = db.query(models.Distillery).filter(
        models.Distillery.id == bottle_data.distillery_id
    ).first()
    if not distillery:
        raise HTTPException(status_code=404, detail="Distillery not found")

    new_bottle = models.Bottle(**bottle_data.model_dump())
    db.add(new_bottle)
    db.commit()
    db.refresh(new_bottle)
    return new_bottle

@app.delete("/api/bottles/{bottle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bottle(bottle_id: int, db: Session = Depends(get_db)):
    bottle = db.query(models.Bottle).filter(models.Bottle.id == bottle_id).first()
    if not bottle:
        raise HTTPException(status_code=404, detail="Bottle not found")
    db.delete(bottle)
    db.commit()
    return