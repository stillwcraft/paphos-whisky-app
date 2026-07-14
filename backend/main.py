import hashlib
import hmac
import json
import os
import sqlite3
from datetime import datetime, timezone
from html import escape
from pathlib import Path
from typing import Literal, Optional
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, urlencode
from urllib.request import Request, urlopen

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


app = FastAPI()

# Keep credentials out of source control. Configure these values in the deployment environment.
BOT_TOKEN = os.getenv("BOT_TOKEN", "")
ADMIN_CHAT_ID = os.getenv("ADMIN_CHAT_ID", "")
ADMIN_TELEGRAM_ID = os.getenv("ADMIN_TELEGRAM_ID", "")
DATABASE_PATH = Path(__file__).with_name("club.db")
INIT_DATA_MAX_AGE_SECONDS = 24 * 60 * 60

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AuthRequest(BaseModel):
    init_data: str = Field(min_length=1, max_length=10_000)


class OrderRequest(AuthRequest):
    item_id: int
    item_name: str = Field(min_length=1, max_length=200)
    item_type: Literal["Бутылка", "Сэмпл 40 мл"]
    comment: str = Field(default="", max_length=1_000)


class TelegramUser(BaseModel):
    id: int
    first_name: str
    username: Optional[str] = None


class EventCreate(AuthRequest):
    title: str = Field(min_length=1, max_length=200)
    date: str = Field(min_length=1, max_length=100)
    location: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=2_000)
    image: str = Field(min_length=1, max_length=2_000)
    status: Literal["past", "current", "future"]
    bottles: list[str] = Field(min_length=1)


class BottleCreate(AuthRequest):
    name: str = Field(min_length=1, max_length=200)
    price: float = Field(gt=0)
    type: Literal["Бутылка", "Сэмпл 40 мл"]
    description: str = Field(min_length=1, max_length=2_000)
    image: str = Field(min_length=1, max_length=2_000)


DEMO_EVENTS = [
    (
        "Islay: торф и морской бриз",
        "18 января 2026",
        "The Cigar Room, Лимасол",
        "Вечер, посвященный островному характеру Islay и его легендарным винокурням.",
        "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=320&q=80",
        "past",
        ["Ardbeg Uigeadail", "Lagavulin 16", "Caol Ila 12"],
    ),
    (
        "Шотландская классика",
        "22 марта 2026",
        "Vinyl Bar, Пафос",
        "Сравнили узнаваемые стили Highland, Speyside и Lowland в камерной компании клуба.",
        "https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=320&q=80",
        "past",
        ["GlenDronach 15", "Balvenie DoubleWood 12", "Auchentoshan Three Wood"],
    ),
    (
        "Релизы независимых боттлеров",
        "25 июля 2026",
        "Whisky Library, Пафос",
        "Открываем редкие релизы от независимых боттлеров и обсуждаем, как читать этикетки.",
        "https://images.unsplash.com/photo-1568213816046-0ee1c42bd559?auto=format&fit=crop&w=320&q=80",
        "current",
        ["Signatory Vintage Bunnahabhain 2013", "Gordon & MacPhail Linkwood 2009", "Cadenhead Glenlossie 2010"],
    ),
    (
        "Японский виски: баланс и точность",
        "29 августа 2026",
        "Rooftop 51, Лимасол",
        "Будущая встреча клуба о японской школе виски, блендах и гармонии вкуса.",
        "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=320&q=80",
        "future",
        ["Nikka From The Barrel", "Hibiki Japanese Harmony", "Mars Kasei"],
    ),
]

DEMO_BOTTLES = [
    (
        "Ardbeg Uigeadail",
        92,
        "Бутылка",
        "Дымный, торфяной, с нотами ванили и темного шоколада.",
        "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=600&q=80",
    ),
    (
        "GlenDronach 15 Revival",
        14,
        "Сэмпл 40 мл",
        "Хересный, насыщенный, с вишней, орехом и пряностями.",
        "https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=600&q=80",
    ),
    (
        "Springbank 10",
        79,
        "Бутылка",
        "Слегка дымный, маслянистый, с цитрусом и морской солью.",
        "https://images.unsplash.com/photo-1568213816046-0ee1c42bd559?auto=format&fit=crop&w=600&q=80",
    ),
    (
        "Port Charlotte 10",
        11,
        "Сэмпл 40 мл",
        "Яркий торф, лимонная цедра и долгий солоноватый финиш.",
        "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80",
    ),
    (
        "Nikka From The Barrel",
        55,
        "Бутылка",
        "Плотный бленд с карамелью, дубом и деликатными специями.",
        "https://images.unsplash.com/photo-1547595628-c61a29f496f0?auto=format&fit=crop&w=600&q=80",
    ),
    (
        "Lagavulin 16",
        16,
        "Сэмпл 40 мл",
        "Глубокий дым, сухофрукты, йод и теплое дубовое послевкусие.",
        "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=600&q=80",
    ),
]


def initialize_database() -> None:
    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                date TEXT NOT NULL,
                location TEXT NOT NULL,
                description TEXT NOT NULL,
                image TEXT NOT NULL,
                status TEXT NOT NULL CHECK (status IN ('past', 'current', 'future')),
                bottles_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS bottles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                price REAL NOT NULL CHECK (price > 0),
                type TEXT NOT NULL CHECK (type IN ('Бутылка', 'Сэмпл 40 мл')),
                description TEXT NOT NULL,
                image TEXT NOT NULL
            );
            """
        )

        if connection.execute("SELECT COUNT(*) FROM events").fetchone()[0] == 0:
            connection.executemany(
                """
                INSERT INTO events (title, date, location, description, image, status, bottles_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                [(*event[:6], json.dumps(event[6], ensure_ascii=False)) for event in DEMO_EVENTS],
            )

        if connection.execute("SELECT COUNT(*) FROM bottles").fetchone()[0] == 0:
            connection.executemany(
                """
                INSERT INTO bottles (name, price, type, description, image)
                VALUES (?, ?, ?, ?, ?)
                """,
                DEMO_BOTTLES,
            )


def get_database_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def require_admin(init_data: str) -> TelegramUser:
    user = validate_init_data(init_data)

    if not ADMIN_TELEGRAM_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ADMIN_TELEGRAM_ID is not configured",
        )

    try:
        admin_user_id = int(ADMIN_TELEGRAM_ID)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ADMIN_TELEGRAM_ID must be a numeric Telegram user ID",
        ) from error

    if user.id != admin_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access is required",
        )

    return user


def validate_init_data(init_data: str) -> TelegramUser:
    if not BOT_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="BOT_TOKEN is not configured",
        )

    try:
        parameters = dict(parse_qsl(init_data, keep_blank_values=True, strict_parsing=True))
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed Telegram initData",
        ) from error

    received_hash = parameters.pop("hash", None)
    if not received_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Telegram initData hash is missing",
        )

    data_check_string = "\n".join(
        f"{key}={value}" for key, value in sorted(parameters.items())
    )
    secret_key = hmac.new(
        b"WebAppData",
        BOT_TOKEN.encode(),
        hashlib.sha256,
    ).digest()
    calculated_hash = hmac.new(
        secret_key,
        data_check_string.encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(calculated_hash, received_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Telegram initData signature",
        )

    try:
        auth_date = int(parameters["auth_date"])
        user_data = json.loads(parameters["user"])
        user = TelegramUser.model_validate(user_data)
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Telegram initData user payload is invalid",
        ) from error

    now = int(datetime.now(timezone.utc).timestamp())
    if auth_date > now + 60 or now - auth_date > INIT_DATA_MAX_AGE_SECONDS:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Telegram initData has expired",
        )

    return user


def get_user_stats(user_id: int) -> dict[str, int]:
    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS user_statistics (
                user_id INTEGER PRIMARY KEY,
                visits INTEGER NOT NULL,
                bottles_tried INTEGER NOT NULL
            )
            """
        )
        connection.execute(
            """
            INSERT OR IGNORE INTO user_statistics (user_id, visits, bottles_tried)
            VALUES (?, 5, 14)
            """,
            (user_id,),
        )
        row = connection.execute(
            "SELECT visits, bottles_tried FROM user_statistics WHERE user_id = ?",
            (user_id,),
        ).fetchone()

    if row is None:
        raise RuntimeError("User statistics were not created")

    return {"visits": row[0], "bottles_tried": row[1]}


def send_order_notification(order: OrderRequest, user: TelegramUser) -> None:
    if not ADMIN_CHAT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ADMIN_CHAT_ID is not configured",
        )

    username = f"@{user.username}" if user.username else "не указан"
    message = (
        "<b>Новый заказ Whisky Club</b>\n"
        f"Пользователь: {escape(user.first_name)} ({escape(username)})\n"
        f"Telegram ID: <code>{user.id}</code>\n"
        f"Товар: {escape(order.item_name)}\n"
        f"Тип: {escape(order.item_type)}\n"
        f"ID товара: <code>{order.item_id}</code>\n"
        f"Комментарий: {escape(order.comment or '—')}"
    )
    body = urlencode(
        {
            "chat_id": ADMIN_CHAT_ID,
            "text": message,
            "parse_mode": "HTML",
        }
    ).encode()
    request = Request(
        f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
        data=body,
        method="POST",
    )

    try:
        with urlopen(request, timeout=10) as response:
            response_data = json.loads(response.read())
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to notify the club administrator",
        ) from error

    if not response_data.get("ok"):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Telegram Bot API rejected the order notification",
        )


def serialize_event(row: sqlite3.Row) -> dict[str, object]:
    event = dict(row)
    event["bottles"] = json.loads(event.pop("bottles_json"))
    return event


@app.on_event("startup")
def initialize_application_database() -> None:
    initialize_database()


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/events")
def list_events() -> list[dict[str, object]]:
    with get_database_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, title, date, location, description, image, status, bottles_json
            FROM events
            ORDER BY id
            """
        ).fetchall()

    return [serialize_event(row) for row in rows]


@app.get("/api/bottles")
def list_bottles() -> list[dict[str, object]]:
    with get_database_connection() as connection:
        rows = connection.execute(
            "SELECT id, name, price, type, description, image FROM bottles ORDER BY id"
        ).fetchall()

    return [dict(row) for row in rows]


@app.post("/api/auth")
def authenticate(request: AuthRequest) -> dict[str, object]:
    user = validate_init_data(request.init_data)
    statistics = get_user_stats(user.id)

    return {
        "status": "success",
        "user": user.model_dump(),
        "statistics": statistics,
    }


@app.post("/api/order")
def create_order(order: OrderRequest) -> dict[str, str]:
    user = validate_init_data(order.init_data)
    send_order_notification(order, user)

    return {"status": "success", "message": "Order notification sent"}


@app.post("/api/admin/events", status_code=status.HTTP_201_CREATED)
def create_event(event: EventCreate) -> dict[str, object]:
    require_admin(event.init_data)

    with get_database_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO events (title, date, location, description, image, status, bottles_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event.title,
                event.date,
                event.location,
                event.description,
                event.image,
                event.status,
                json.dumps(event.bottles, ensure_ascii=False),
            ),
        )
        event_id = cursor.lastrowid
        row = connection.execute(
            """
            SELECT id, title, date, location, description, image, status, bottles_json
            FROM events
            WHERE id = ?
            """,
            (event_id,),
        ).fetchone()

    if row is None:
        raise RuntimeError("Event was not created")

    return serialize_event(row)


@app.post("/api/admin/bottles", status_code=status.HTTP_201_CREATED)
def create_bottle(bottle: BottleCreate) -> dict[str, object]:
    require_admin(bottle.init_data)

    with get_database_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO bottles (name, price, type, description, image)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                bottle.name,
                bottle.price,
                bottle.type,
                bottle.description,
                bottle.image,
            ),
        )
        bottle_id = cursor.lastrowid
        row = connection.execute(
            "SELECT id, name, price, type, description, image FROM bottles WHERE id = ?",
            (bottle_id,),
        ).fetchone()

    if row is None:
        raise RuntimeError("Bottle was not created")

    return dict(row)


@app.delete("/api/admin/bottles/{bottle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bottle(bottle_id: int, request: AuthRequest) -> None:
    require_admin(request.init_data)

    with get_database_connection() as connection:
        cursor = connection.execute("DELETE FROM bottles WHERE id = ?", (bottle_id,))

    if cursor.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bottle not found",
        )
