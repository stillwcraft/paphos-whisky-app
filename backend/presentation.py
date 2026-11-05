"""Durable room state and bounded, serialized WebSocket fan-out (one ASGI worker)."""
import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Response, WebSocket, WebSocketDisconnect
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool
from sqlalchemy import Column, JSON, String

from database import Base, SessionLocal
from schemas.presentation import Command, PresentationManifest, public_slide

log = logging.getLogger(__name__)
MAX_CONNECTIONS = 100
MAX_CONTRIBUTORS = 1000


class PresentationRoomRecord(Base):
    __tablename__ = "presentation_rooms"
    id = Column(String(32), primary_key=True)
    payload = Column(JSON, nullable=False)


def read_record(room_id):
    with SessionLocal() as db:
        record = db.get(PresentationRoomRecord, room_id)
        return record.payload if record else None


def read_room_summaries(presenter_id, limit, offset):
    with SessionLocal() as db:
        query = db.query(PresentationRoomRecord).filter(
            PresentationRoomRecord.payload["presenter_id"].as_integer() == presenter_id,
        )
        total = query.count()
        records = query.order_by(PresentationRoomRecord.id.desc()).offset(offset).limit(limit).all()
        items = []
        for record in records:
            payload = record.payload
            manifest = payload["manifest"]
            items.append({
                "room_id": record.id,
                "manifest_id": manifest["id"],
                "title": manifest.get("title") or manifest["slides"][0].get("title"),
                "slide_count": len(manifest["slides"]),
                "current_slide_index": payload["current_slide_index"],
            })
        return {"items": items, "total": total, "limit": limit, "offset": offset,
                "has_more": offset + len(items) < total}


def write_record(room_id, payload):
    with SessionLocal() as db:
        record = db.get(PresentationRoomRecord, room_id)
        if record is None:
            db.add(PresentationRoomRecord(id=room_id, payload=payload))
        else:
            record.payload = payload
        db.commit()


def delete_record(room_id):
    with SessionLocal() as db:
        record = db.get(PresentationRoomRecord, room_id)
        if record:
            db.delete(record)
            db.commit()


@dataclass
class Client:
    socket: WebSocket
    user_id: int


@dataclass
class Room:
    id: str
    payload: dict
    manifest: PresentationManifest
    clients: dict[int, Client] = field(default_factory=dict)

    def snapshot(self, user_id):
        current = self.payload["current_slide_index"]
        maximum = self.payload["max_unlocked_slide_index"]
        results = {}
        for slide in self.manifest.slides[:maximum + 1]:
            entries = self.payload["responses"].get(slide.id, {})
            if slide.type == "poll":
                counts = {option.id: 0 for option in slide.options}
                for option_id in entries.values():
                    counts[option_id] += 1
                results[slide.id] = {"counts": counts, "own_vote": entries.get(str(user_id))}
            elif slide.type == "word_cloud":
                counts = {}
                for words in entries.values():
                    for word in words:
                        counts[word] = counts.get(word, 0) + 1
                results[slide.id] = {"counts": counts, "own_words": entries.get(str(user_id), [])}
        return {
            "type": "state", "room_id": self.id,
            "role": "presenter" if user_id == self.payload["presenter_id"] else "viewer",
            "revision": self.payload["revision"],
            "current_slide_index": current,
            "max_unlocked_slide_index": maximum,
            "slide_count": len(self.manifest.slides),
            "title": self.manifest.title,
            "theme": self.manifest.theme.model_dump() if self.manifest.theme else None,
            # No future title, URL, answer key, or manifest is sent, even to the presenter.
            "slides": {str(i): public_slide(slide) for i, slide in enumerate(self.manifest.slides[:maximum + 1])},
            "results": results,
        }


class WebSocketManager:
    def __init__(self):
        self.rooms: dict[str, Room] = {}
        self.connections = 0
        # Serializes reads, commits, sync snapshots and broadcasts, including room deletion.
        self.lock = asyncio.Lock()

    async def room(self, room_id):
        room = self.rooms.get(room_id)
        if room is None:
            payload = await run_in_threadpool(read_record, room_id)
            if payload is None:
                raise HTTPException(404, "Presentation room not found")
            room = Room(room_id, payload, PresentationManifest.model_validate(payload["manifest"]))
            self.rooms[room_id] = room
        return room

    async def send(self, room, client, message):
        try:
            await asyncio.wait_for(client.socket.send_json(message), timeout=3)
        except (asyncio.TimeoutError, RuntimeError, WebSocketDisconnect, OSError):
            log.info("Disconnecting unavailable presentation socket in room %s", room.id)
            room.clients.pop(id(client.socket), None)
            await self.close(client.socket, 1013)

    async def close(self, socket, code):
        try:
            await asyncio.wait_for(socket.close(code=code), timeout=1)
        except (asyncio.TimeoutError, RuntimeError, WebSocketDisconnect, OSError):
            log.debug("Presentation socket unavailable during close")

    async def broadcast(self, room):
        await asyncio.gather(*(self.send(room, client, room.snapshot(client.user_id))
                               for client in list(room.clients.values())))

    async def command(self, room, client, command):
        if self.rooms.get(room.id) is not room:
            raise HTTPException(404, "Presentation room closed")
        if command.type == "ping":
            await self.send(room, client, {"type": "pong"})
            return
        if command.type == "sync":
            await self.send(room, client, room.snapshot(client.user_id))
            return

        # Copy-on-write: a failed commit must not expose uncommitted state.
        payload = json.loads(json.dumps(room.payload))
        if command.type == "advance":
            if client.user_id != payload["presenter_id"]:
                raise HTTPException(403, "Only the presenter can activate slides")
            target = command.index
            if target is None or target >= len(room.manifest.slides):
                raise HTTPException(422, "Invalid slide index")
            if target > payload["max_unlocked_slide_index"] + 1:
                raise HTTPException(409, "Activate slides sequentially")
            payload["current_slide_index"] = target
            payload["max_unlocked_slide_index"] = max(target, payload["max_unlocked_slide_index"])
        else:
            slide = room.manifest.slides[payload["current_slide_index"]]
            if command.slide_id != slide.id:
                raise HTTPException(409, "Only the currently active slide accepts responses")
            responses = payload["responses"].setdefault(slide.id, {})
            key = str(client.user_id)
            if key in responses:
                raise HTTPException(409, "You have already responded to this slide")
            if len(responses) >= MAX_CONTRIBUTORS:
                raise HTTPException(409, "This slide has reached its response limit")
            if command.type == "vote":
                if slide.type != "poll" or command.option_id not in {option.id for option in slide.options}:
                    raise HTTPException(422, "Invalid poll option")
                responses[key] = command.option_id
            elif command.type == "words":
                if slide.type != "word_cloud" or not 1 <= len(command.words) <= slide.max_words:
                    raise HTTPException(422, "Invalid word cloud response")
                words = list(dict.fromkeys(" ".join(word.casefold().split()) for word in command.words))
                if not all(words):
                    raise HTTPException(422, "Words cannot be blank")
                responses[key] = words
        payload["revision"] += 1
        await run_in_threadpool(write_record, room.id, payload)
        room.payload = payload
        await self.broadcast(room)

    def evict_idle(self, room):
        if not room.clients:
            self.rooms.pop(room.id, None)


def create_presentation_router(authenticate, require_admin):
    router = APIRouter(prefix="/api/presentations", tags=["presentations"])
    manager = WebSocketManager()

    @router.get("/rooms")
    async def list_rooms(response: Response, limit: int = Query(20, ge=1, le=50),
                         offset: int = Query(0, ge=0), user=Depends(require_admin)):
        response.headers["Cache-Control"] = "private, no-store"
        return await run_in_threadpool(read_room_summaries, user.telegram_id, limit, offset)

    @router.post("/rooms", status_code=201)
    async def create_room(manifest: PresentationManifest, response: Response, user=Depends(require_admin)):
        response.headers["Cache-Control"] = "private, no-store"
        payload = {
            "manifest": manifest.model_dump(), "presenter_id": user.telegram_id,
            "current_slide_index": 0, "max_unlocked_slide_index": 0,
            "revision": 0, "responses": {},
        }
        room_id = uuid4().hex
        await run_in_threadpool(write_record, room_id, payload)
        return {"room_id": room_id}

    @router.get("/rooms/{room_id}")
    async def get_state(room_id: str, response: Response, user=Depends(authenticate)):
        response.headers["Cache-Control"] = "private, no-store"
        async with manager.lock:
            room = await manager.room(room_id)
            state = room.snapshot(user.telegram_id)
            manager.evict_idle(room)
            return state

    @router.delete("/rooms/{room_id}", status_code=204)
    async def close_room(room_id: str, user=Depends(require_admin)):
        async with manager.lock:
            room = await manager.room(room_id)
            if user.telegram_id != room.payload["presenter_id"]:
                raise HTTPException(403, "Only the room presenter can close it")
            await run_in_threadpool(delete_record, room_id)
            manager.rooms.pop(room_id, None)
            await asyncio.gather(*(manager.close(client.socket, 4004) for client in list(room.clients.values())))
        return Response(status_code=204)

    @router.websocket("/rooms/{room_id}/ws")
    async def session(socket: WebSocket, room_id: str):
        async with manager.lock:
            if manager.connections >= MAX_CONNECTIONS:
                await socket.close(code=1013)
                return
            manager.connections += 1
        room = None
        try:
            await socket.accept()
            # Browser WebSockets cannot set Authorization; never put initData in URL/logs.
            raw = await asyncio.wait_for(socket.receive_text(), timeout=5)
            if len(raw) > 16384:
                raise HTTPException(413, "Authentication message too large")
            message = json.loads(raw)
            if not isinstance(message, dict) or message.get("type") != "auth" or not isinstance(message.get("init_data"), str):
                raise HTTPException(401, "Authentication required")
            user = authenticate(authorization=f'tma {message["init_data"]}')
            async with manager.lock:
                room = await manager.room(room_id)
                client = Client(socket, user.telegram_id)
                room.clients[id(socket)] = client
                await manager.send(room, client, room.snapshot(user.telegram_id))
            timestamps = []
            while True:
                raw = await asyncio.wait_for(socket.receive_text(), timeout=60)
                now = time.monotonic()
                timestamps = [stamp for stamp in timestamps if stamp > now - 10]
                if len(raw) > 4096 or len(timestamps) >= 20:
                    await socket.close(code=1008)
                    break
                timestamps.append(now)
                async with manager.lock:
                    try:
                        command = Command.model_validate_json(raw)
                        await manager.command(room, client, command)
                    except ValidationError:
                        await manager.send(room, client, {"type": "error", "message": "Invalid presentation command"})
                    except HTTPException as exc:
                        await manager.send(room, client, {"type": "error", "message": exc.detail})
        except HTTPException as exc:
            await socket.send_json({"type": "error", "message": exc.detail})
            await socket.close(code=4001 if exc.status_code == 401 else 4004 if exc.status_code == 404 else 1008)
        except (json.JSONDecodeError, asyncio.TimeoutError):
            await socket.close(code=1008)
        except WebSocketDisconnect:
            pass
        finally:
            async with manager.lock:
                manager.connections -= 1
                if room:
                    room.clients.pop(id(socket), None)
                    manager.evict_idle(room)

    return router
