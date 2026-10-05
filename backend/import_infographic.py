"""Import a localized timeline JSON file for an existing distillery."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import TYPE_CHECKING

from pydantic import ValidationError
from sqlalchemy import func
from sqlalchemy.orm import Session

from schemas.infographic import InfographicCreate

if TYPE_CHECKING:
    import models


def import_timeline(db: Session, distillery_name: str, data: dict) -> models.Infographic:
    import models

    if not distillery_name.strip():
        raise ValueError("Distillery name must not be empty")
    matches = db.query(models.Distillery).filter(
        func.lower(models.Distillery.name).contains(distillery_name.strip().lower(), autoescape=True)
    ).all()
    if len(matches) != 1:
        raise ValueError(
            f"Expected exactly one distillery matching {distillery_name!r}; found {len(matches)}"
        )

    distillery = matches[0]
    payload = InfographicCreate(
        title=f"{distillery.name} History",
        type="timeline",
        distillery_id=distillery.id,
        schema_data=data,
    )
    timeline = payload.model_dump()["schema_data"]
    existing = db.query(models.Infographic).filter_by(distillery_id=distillery.id).one_or_none()
    if existing is not None:
        if existing.type != "timeline" or existing.schema_data != timeline:
            raise ValueError(f"{distillery.name} already has a different infographic; refusing to overwrite")
        return existing

    infographic = models.Infographic(**payload.model_dump())
    db.add(infographic)
    db.commit()
    db.refresh(infographic)
    return infographic


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", type=Path, help="Path to a timeline JSON file")
    parser.add_argument("--distillery", required=True, help="Unique part of the distillery name")
    args = parser.parse_args()
    if not os.getenv("DATABASE_URL"):
        parser.error("Set DATABASE_URL before importing an infographic")

    try:
        data = json.loads(args.file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        parser.error(str(exc))

    from database import SessionLocal

    try:
        with SessionLocal() as db:
            infographic = import_timeline(db, args.distillery, data)
            print(f"Infographic {infographic.id} linked to distillery {infographic.distillery_id}")
    except (ValueError, ValidationError) as exc:
        parser.error(str(exc))


if __name__ == "__main__":
    main()
