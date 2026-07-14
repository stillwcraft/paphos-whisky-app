from sqlalchemy import Column, Integer, String, Float
from database import Base

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    date = Column(String)  # Например: "25 Июля, 19:00"
    description = Column(String)
    price = Column(Float)
    image_url = Column(String, nullable=True)

class Bottle(Base):
    __tablename__ = "bottles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    distillery = Column(String)
    age = Column(Integer, nullable=True)
    price_per_sample = Column(Float)
    description = Column(String)
    image_url = Column(String, nullable=True)