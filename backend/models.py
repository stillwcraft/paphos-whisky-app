from sqlalchemy import BigInteger, Boolean, Column, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship
from database import Base

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    date = Column(String)  # Например: "25 Июля, 19:00"
    description = Column(String)
    price = Column(Float)
    image_url = Column(String, nullable=True)
    has_samples = Column(Boolean, default=False, nullable=False)


class Registration(Base):
    __tablename__ = "registrations"
    __table_args__ = (
        UniqueConstraint("event_id", "telegram_id", name="uq_registration_event_telegram"),
    )

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, index=True, nullable=False)
    telegram_id = Column(BigInteger, nullable=False)
    username = Column(String, nullable=True)
    first_name = Column(String, nullable=True)
    registered = Column(Boolean, default=False, nullable=False)
    samples = Column(Boolean, default=False, nullable=False)


class Distillery(Base):
    __tablename__ = "distilleries"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, unique=True, nullable=False)
    image_url = Column(String, nullable=True)
    bottles = relationship(
        "Bottle",
        back_populates="distillery",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Bottle(Base):
    __tablename__ = "bottles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    distillery_id = Column(
        Integer,
        ForeignKey("distilleries.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    age = Column(Integer, nullable=True)
    price_per_sample = Column(Float)
    description = Column(String)
    image_url = Column(String, nullable=True)
    distillery = relationship("Distillery", back_populates="bottles")