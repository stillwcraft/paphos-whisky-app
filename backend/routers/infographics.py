from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import models
from database import get_db
from schemas.infographic import InfographicCreate, InfographicResponse


router = APIRouter(prefix="/api/v1/infographics", tags=["infographics"])
distillery_router = APIRouter(prefix="/api/v1/distilleries", tags=["infographics"])
admin_router = APIRouter(prefix="/api/v1/infographics", tags=["infographics"])


@router.get("/{infographic_id}", response_model=InfographicResponse)
def get_infographic(infographic_id: UUID, db: Session = Depends(get_db)):
    infographic = db.get(models.Infographic, infographic_id)
    if infographic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Infographic not found")
    return infographic


@distillery_router.get("/{distillery_id}/infographic", response_model=Optional[InfographicResponse])
def get_distillery_infographic(distillery_id: int, db: Session = Depends(get_db)):
    if db.get(models.Distillery, distillery_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Distillery not found")
    return db.query(models.Infographic).filter(models.Infographic.distillery_id == distillery_id).one_or_none()


@admin_router.post("", response_model=InfographicResponse, status_code=status.HTTP_201_CREATED)
def create_infographic(payload: InfographicCreate, db: Session = Depends(get_db)):
    if payload.distillery_id is not None:
        if db.get(models.Distillery, payload.distillery_id) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Distillery not found")
        if db.query(models.Infographic.id).filter(
            models.Infographic.distillery_id == payload.distillery_id
        ).first():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Distillery already has an infographic")
    infographic = models.Infographic(**payload.model_dump())
    db.add(infographic)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not assign infographic to distillery",
        ) from None
    db.refresh(infographic)
    return infographic
