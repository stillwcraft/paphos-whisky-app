from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

import models
from database import engine, get_db

# Автоматически создаем таблицы в Supabase при старте, если их еще нет
models.Base.metadata.create_all(bind=engine)

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

class EventResponse(EventCreate):
    id: int
    class Config:
        from_attributes = True

class BottleCreate(BaseModel):
    name: str
    distillery: str
    age: Optional[int] = None
    price_per_sample: float
    description: str
    image_url: Optional[str] = None

class BottleResponse(BottleCreate):
    id: int
    class Config:
        from_attributes = True


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


# --- ЭНДПОИНТЫ ДЛЯ БУТЫЛОК (BOTTLES) ---

@app.get("/api/bottles", response_model=List[BottleResponse])
def get_bottles(db: Session = Depends(get_db)):
    return db.query(models.Bottle).all()

@app.post("/api/bottles", response_model=BottleResponse, status_code=status.HTTP_201_CREATED)
def create_bottle(bottle_data: BottleCreate, db: Session = Depends(get_db)):
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