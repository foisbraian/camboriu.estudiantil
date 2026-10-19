from database import engine
from sqlalchemy import text

def upgrade_db():
    migraciones = [
        "ALTER TABLE grupos ADD COLUMN es_mix_grupo BOOLEAN DEFAULT FALSE",
        "ALTER TABLE fechas_evento ADD COLUMN es_mix_evento BOOLEAN DEFAULT FALSE",
        "ALTER TABLE grupos ADD COLUMN multiparque_acceso BOOLEAN DEFAULT FALSE",
        "ALTER TABLE grupos ADD COLUMN parador_acceso BOOLEAN DEFAULT FALSE",
        "ALTER TABLE empresas ADD COLUMN anios_informados VARCHAR DEFAULT ''",
    ]
    for sql in migraciones:
        try:
            with engine.begin() as conn:
                conn.execute(text(sql))
            print(f"OK: {sql}")
        except Exception as e:
            # Ignorar si las columnas ya existen
            print(f"Ignorado o ya existe: {sql}")

    # Ajustes puntuales de datos
    datos_updates = [
        "UPDATE gastos_empresa SET concepto = 'OPERATIVO' WHERE id IN (47, 112)",
        "UPDATE gastos_empresa SET categoria = 'LUISINHO' WHERE id = 47",
    ]
    for sql in datos_updates:
        try:
            with engine.begin() as conn:
                res = conn.execute(text(sql))
                print(f"OK ({res.rowcount} filas afectadas): {sql}")
        except Exception as e:
            print(f"Aviso en update ({sql}): {e}")

if __name__ == "__main__":
    upgrade_db()
