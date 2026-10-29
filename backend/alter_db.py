from database import engine
from sqlalchemy import text

def upgrade_db():
    migraciones = [
        "ALTER TABLE grupos ADD COLUMN es_mix_grupo BOOLEAN DEFAULT FALSE",
        "ALTER TABLE fechas_evento ADD COLUMN es_mix_evento BOOLEAN DEFAULT FALSE",
        "ALTER TABLE grupos ADD COLUMN multiparque_acceso BOOLEAN DEFAULT FALSE",
        "ALTER TABLE grupos ADD COLUMN parador_acceso BOOLEAN DEFAULT FALSE",
        "ALTER TABLE empresas ADD COLUMN anios_informados VARCHAR DEFAULT ''",
        "ALTER TABLE grupos ADD COLUMN cena_velas BOOLEAN DEFAULT FALSE",
        "ALTER TABLE grupos ADD COLUMN bar_hielo BOOLEAN DEFAULT FALSE",
        "ALTER TABLE grupos ADD COLUMN pagantes_finales_multiparque INTEGER",
        "ALTER TABLE grupos ADD COLUMN pagantes_finales_campamento_p INTEGER",
        "ALTER TABLE grupos ADD COLUMN pagantes_finales_zacarias_p INTEGER",
        "ALTER TABLE fechas_evento ADD COLUMN es_privado BOOLEAN DEFAULT FALSE",
        "ALTER TABLE fechas_evento ADD COLUMN empresa_privada_id INTEGER",
        "ALTER TABLE finanzas_empresa ADD COLUMN precio_bar_hielo FLOAT DEFAULT 0",
        "ALTER TABLE finanzas_empresa ADD COLUMN precio_parque_sin_comida FLOAT DEFAULT 0",
        "ALTER TABLE finanzas_empresa ADD COLUMN precio_parque_con_comida FLOAT DEFAULT 0",
        "ALTER TABLE finanzas_empresa ADD COLUMN precio_multiparque FLOAT DEFAULT 0",
        "ALTER TABLE finanzas_empresa ADD COLUMN precio_cena_velas FLOAT DEFAULT 0",
        "ALTER TABLE finanzas_empresa ADD COLUMN precio_pool_con_comida FLOAT DEFAULT 0",
        "ALTER TABLE finanzas_empresa ADD COLUMN precio_pool_sin_comida FLOAT DEFAULT 0",
        "ALTER TABLE finanzas_empresa ADD COLUMN combo_multiparque BOOLEAN DEFAULT FALSE",
        "ALTER TABLE reservas_hotel ADD COLUMN total_habitaciones INTEGER DEFAULT 0",
        "ALTER TABLE pagos_hotel ADD COLUMN reserva_id INTEGER",
        "ALTER TABLE grupos ADD COLUMN discos_opcionales INTEGER DEFAULT 0",
        "ALTER TABLE grupos ADD COLUMN pagantes_finales_disco_opcional INTEGER",
        "ALTER TABLE asignaciones ADD COLUMN es_opcional BOOLEAN DEFAULT FALSE",
        "ALTER TABLE finanzas_empresa ADD COLUMN precio_disco_opcional FLOAT DEFAULT 0",
        "ALTER TABLE fechas_evento ADD COLUMN show VARCHAR",
        "ALTER TABLE fechas_evento ADD COLUMN animador VARCHAR",
        """CREATE TABLE IF NOT EXISTS links_personalizados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token VARCHAR UNIQUE,
            empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
            nombre VARCHAR NOT NULL,
            servicios_permitidos VARCHAR NOT NULL,
            eventos_permitidos VARCHAR,
            grupos_permitidos VARCHAR,
            incluir_vouchers BOOLEAN DEFAULT FALSE,
            activo BOOLEAN DEFAULT TRUE,
            creado_en VARCHAR
        )""",
        "ALTER TABLE links_personalizados ADD COLUMN empresas_ids VARCHAR",
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
