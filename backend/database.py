import os
from sqlalchemy import Table, create_engine, event, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

def normalize_database_url(url: str) -> str:
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg2://", 1)
    if url.startswith("postgresql+psycopg://"):
        return url.replace("postgresql+psycopg://", "postgresql+psycopg2://", 1)
    return url


DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL:
    DATABASE_URL = normalize_database_url(DATABASE_URL)

# Создаем движок подключения
engine = create_engine(DATABASE_URL)

# Настраиваем сессии
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


@event.listens_for(Table, "after_create")
def protect_backend_table(table, connection, **kwargs):
    if table.metadata is not Base.metadata or connection.dialect.name != "postgresql":
        return

    table_name = connection.dialect.identifier_preparer.format_table(table)
    connection.execute(text(f"ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY"))
    connection.execute(text(f"REVOKE ALL PRIVILEGES ON TABLE {table_name} FROM PUBLIC"))
    client_roles = connection.execute(
        text("SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')")
    ).scalars()
    for role in client_roles:
        role_name = connection.dialect.identifier_preparer.quote(role)
        connection.execute(
            text(f"REVOKE ALL PRIVILEGES ON TABLE {table_name} FROM {role_name}")
        )


# Функция-генератор для получения сессии БД в эндпоинтах
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()