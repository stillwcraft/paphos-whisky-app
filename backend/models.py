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
    description = Column(String, nullable=True)
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
        nullable=True,
    )
    label = Column(String, default="bottle", nullable=False)
    age = Column(String, nullable=True)
    abv = Column(String, nullable=True)
    price_per_sample = Column(Float)
    description = Column(String)
    image_url = Column(String, nullable=True)
    favorites_count = Column(Integer, default=0, nullable=False)
    tried_count = Column(Integer, default=0, nullable=False)
    distillery = relationship("Distillery", back_populates="bottles")
    user_actions = relationship(
        "UserBottleAction",
        back_populates="bottle",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class UserBottleAction(Base):
    __tablename__ = "user_bottle_actions"
    __table_args__ = (
        UniqueConstraint(
            "telegram_id",
            "bottle_id",
            name="uq_user_bottle_action_telegram_bottle",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(BigInteger, index=True, nullable=False)
    bottle_id = Column(
        Integer,
        ForeignKey("bottles.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    is_favorite = Column(Boolean, default=False, nullable=False)
    is_tried = Column(Boolean, default=False, nullable=False)

    bottle = relationship("Bottle", back_populates="user_actions")