from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import models
from database import get_db
from schemas.infographic import InfographicCreate, InfographicResponse


router = APIRouter(prefix="/api/v1/infographics", tags=["infographics"])
admin_router = APIRouter(prefix="/api/v1/infographics", tags=["infographics"])


@router.get("/{infographic_id}", response_model=InfographicResponse)
def get_infographic(infographic_id: UUID, db: Session = Depends(get_db)):
    infographic = db.get(models.Infographic, infographic_id)
    if infographic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Infographic not found")
    return infographic


@admin_router.post("", response_model=InfographicResponse, status_code=status.HTTP_201_CREATED)
def create_infographic(payload: InfographicCreate, db: Session = Depends(get_db)):
    infographic = models.Infographic(**payload.model_dump())
    db.add(infographic)
    db.commit()
    db.refresh(infographic)
    return infographic
