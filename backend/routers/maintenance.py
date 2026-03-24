from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from database import DATABASE_URL, engine


router = APIRouter(prefix="/maintenance", tags=["Maintenance"])

IS_SQLITE = DATABASE_URL.startswith("sqlite")

MIGRATIONS = [
    {
        "name": "asignaciones.pax_asignados",
        "sqlite": "ALTER TABLE asignaciones ADD COLUMN pax_asignados INTEGER",
        "postgres": "ALTER TABLE asignaciones ADD COLUMN IF NOT EXISTS pax_asignados INTEGER",
    },
    {
        "name": "finanzas_empresa.moneda",
        "sqlite": "ALTER TABLE finanzas_empresa ADD COLUMN moneda VARCHAR DEFAULT 'ARS'",
        "postgres": "ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS moneda VARCHAR DEFAULT 'ARS'",
    },
    {
        "name": "eventos.complejo",
        "sqlite": "ALTER TABLE eventos ADD COLUMN complejo VARCHAR",
        "postgres": "ALTER TABLE eventos ADD COLUMN IF NOT EXISTS complejo VARCHAR",
    },
]


def _is_duplicate_column_error(message: str) -> bool:
    lowered = message.lower()
    return "duplicate column" in lowered or "already exists" in lowered


@router.post("/migrate", summary="Aplicar migraciones puntuales")
def run_migrations():
    results = []
    try:
        with engine.begin() as conn:
            for migration in MIGRATIONS:
                statement = migration["sqlite"] if IS_SQLITE else migration["postgres"]
                try:
                    conn.execute(text(statement))
                    results.append({"name": migration["name"], "status": "applied"})
                except DBAPIError as exc:
                    raw_message = str(getattr(exc, "orig", exc))
                    if _is_duplicate_column_error(raw_message):
                        results.append({"name": migration["name"], "status": "skipped"})
                        continue
                    raise HTTPException(
                        status_code=500,
                        detail=f"No se pudo aplicar {migration['name']}: {raw_message}",
                    )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error inesperado: {exc}") from exc

    return {"detail": "Migracion completada", "results": results}
