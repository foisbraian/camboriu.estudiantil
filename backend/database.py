import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# PostgreSQL para producción (Render), SQLite para desarrollo
DATABASE_URL = os.getenv("DATABASE_URL")

# Si la variable está vacía o no existe, usamos SQLite
if not DATABASE_URL or not DATABASE_URL.strip():
    DATABASE_URL = "sqlite:///./app.db"

# ⭐ FIX para Render: SQLAlchemy requiere 'postgresql://' en lugar de 'postgres://'
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Si es SQLite, necesitamos check_same_thread=False
is_sqlite = DATABASE_URL.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

Base = declarative_base()


# dependencia para usar la DB en endpoints después
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
