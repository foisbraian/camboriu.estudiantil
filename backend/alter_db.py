from database import engine
from sqlalchemy import text

def upgrade_db():
    migraciones = [
        "ALTER TABLE grupos ADD COLUMN es_mix_grupo BOOLEAN DEFAULT FALSE",
        "ALTER TABLE fechas_evento ADD COLUMN es_mix_evento BOOLEAN DEFAULT FALSE",
    ]
    with engine.begin() as conn:
        for sql in migraciones:
            try:
                conn.execute(text(sql))
                print(f"OK: {sql}")
            except Exception as e:
                # Ignorar si las columnas ya existen
                print(f"Ignorado o ya existe: {e}")

if __name__ == "__main__":
    upgrade_db()
