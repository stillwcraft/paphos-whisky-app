import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Получаем ссылку из переменных окружения Render
DATABASE_URL = os.getenv("DATABASE_URL")

# Небольшой хак: SQLAlchemy требует, чтобы ссылка начиналась именно с postgresql://
# а некоторые сервисы выдают её как postgres://
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Создаем движок подключения
engine = create_engine(DATABASE_URL)

# Настраиваем сессии
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Функция-генератор для получения сессии БД в эндпоинтах
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()