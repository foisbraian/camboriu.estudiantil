import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# PostgreSQL para producción (Render), SQLite para desarrollo
DATABASE_URL = os.getenv("DATABASE_URL")

# Si la variable está vacía o no existe, usamos SQLite
if not DATABASE_URL or not DATABASE_URL.strip():
    DATABASE_URL = "sqlite:///./app.db"

# ⭐ FIX para Render: SQLAlchemy requiere 'postgresql://' en lugar de 'postgres://'
if DATABASE_URL.startswith("postgres://") or DATABASE_URL.startswith("postgresql://"):
    # Forzar el uso del driver moderno psycopg3 si no está especificado
    if "psycopg" not in DATABASE_URL:
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

# Si es SQLite, necesitamos check_same_thread=False
is_sqlite = DATABASE_URL.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {}

engine_kwargs = {
    "connect_args": connect_args,
    "pool_pre_ping": True,
}

if not is_sqlite:
    engine_kwargs.update({
        "pool_size": 20,
        "max_overflow": 20,
        "pool_recycle": 1800,
        "pool_timeout": 30,
    })

engine = create_engine(
    DATABASE_URL,
    **engine_kwargs
)

print(f"CONECTADO A: {DATABASE_URL.split('://')[0]}://*** (Persistence: {'OK' if not is_sqlite else 'NO - Ephemeral'})")

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

Base = declarative_base()


# dependencia para usar la DB en endpoints después
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
