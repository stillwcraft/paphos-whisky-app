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
    samples_price = Column(Float, nullable=True)
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


class TastingTag(Base):
    __tablename__ = "tasting_tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    icon_url = Column(String, nullable=False)


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
    cask = Column(String, nullable=True)
    bottles = Column(String, nullable=True)
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
    user_reviews = relationship(
        "UserReview",
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


class UserReview(Base):
    __tablename__ = "user_reviews"
    __table_args__ = (
        UniqueConstraint(
            "telegram_id",
            "bottle_id",
            name="uq_user_review_telegram_bottle",
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
    nose = Column(Integer, nullable=False, default=80)
    taste = Column(Integer, nullable=False, default=80)
    finish = Column(Integer, nullable=False, default=80)

    bottle = relationship("Bottle", back_populates="user_reviews")
    review_tags = relationship(
        "UserReviewTag",
        back_populates="review",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    tags = relationship(
        "TastingTag",
        secondary="user_review_tags",
        viewonly=True,
        overlaps="review_tags,review,tasting_tag",
    )


class UserReviewTag(Base):
    __tablename__ = "user_review_tags"
    __table_args__ = (
        UniqueConstraint(
            "review_id",
            "tasting_tag_id",
            name="uq_user_review_tag_review_tasting",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(
        Integer,
        ForeignKey("user_reviews.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    tasting_tag_id = Column(
        Integer,
        ForeignKey("tasting_tags.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    review = relationship(
        "UserReview",
        back_populates="review_tags",
        overlaps="tags",
    )
    tasting_tag = relationship("TastingTag", overlaps="tags")