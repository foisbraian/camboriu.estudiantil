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
    {
        "name": "grupos.pagantes_finales",
        "sqlite": "ALTER TABLE grupos ADD COLUMN pagantes_finales INTEGER",
        "postgres": "ALTER TABLE grupos ADD COLUMN IF NOT EXISTS pagantes_finales INTEGER",
    },
    {
        "name": "grupos.pagantes_finales_disco",
        "sqlite": "ALTER TABLE grupos ADD COLUMN pagantes_finales_disco INTEGER",
        "postgres": "ALTER TABLE grupos ADD COLUMN IF NOT EXISTS pagantes_finales_disco INTEGER",
    },
    {
        "name": "grupos.pagantes_finales_parque",
        "sqlite": "ALTER TABLE grupos ADD COLUMN pagantes_finales_parque INTEGER",
        "postgres": "ALTER TABLE grupos ADD COLUMN IF NOT EXISTS pagantes_finales_parque INTEGER",
    },
    {
        "name": "grupos.pagantes_finales_pool",
        "sqlite": "ALTER TABLE grupos ADD COLUMN pagantes_finales_pool INTEGER",
        "postgres": "ALTER TABLE grupos ADD COLUMN IF NOT EXISTS pagantes_finales_pool INTEGER",
    },
    {
        "name": "grupos.pagantes_finales_cena",
        "sqlite": "ALTER TABLE grupos ADD COLUMN pagantes_finales_cena INTEGER",
        "postgres": "ALTER TABLE grupos ADD COLUMN IF NOT EXISTS pagantes_finales_cena INTEGER",
    },
    {
        "name": "grupos.pagantes_finales_hielo",
        "sqlite": "ALTER TABLE grupos ADD COLUMN pagantes_finales_hielo INTEGER",
        "postgres": "ALTER TABLE grupos ADD COLUMN IF NOT EXISTS pagantes_finales_hielo INTEGER",
    },
    {
        "name": "grupos.pagantes_finales_combo",
        "sqlite": "ALTER TABLE grupos ADD COLUMN pagantes_finales_combo INTEGER",
        "postgres": "ALTER TABLE grupos ADD COLUMN IF NOT EXISTS pagantes_finales_combo INTEGER",
    },
    {
        "name": "finanzas_empresa.combo_cena_velas",
        "sqlite": "ALTER TABLE finanzas_empresa ADD COLUMN combo_cena_velas BOOLEAN DEFAULT FALSE",
        "postgres": "ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS combo_cena_velas BOOLEAN DEFAULT FALSE",
    },
    {
        "name": "finanzas_empresa.combo_bar_hielo",
        "sqlite": "ALTER TABLE finanzas_empresa ADD COLUMN combo_bar_hielo BOOLEAN DEFAULT FALSE",
        "postgres": "ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS combo_bar_hielo BOOLEAN DEFAULT FALSE",
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
