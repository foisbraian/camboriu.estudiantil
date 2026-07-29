import sqlite3

def upgrade_db():
    conn = sqlite3.connect('app.db')
    cursor = conn.cursor()
    
    migraciones = [
        ("ALTER TABLE grupos ADD COLUMN es_mix_grupo BOOLEAN DEFAULT FALSE", "es_mix_grupo en grupos"),
        ("ALTER TABLE fechas_evento ADD COLUMN es_mix_evento BOOLEAN DEFAULT FALSE", "es_mix_evento en fechas_evento"),
    ]

    for sql, descripcion in migraciones:
        try:
            cursor.execute(sql)
            print(f"OK: {descripcion}")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print(f"Ya existe: {descripcion}")
            else:
                print(f"Error en '{descripcion}': {e}")
    
    conn.commit()
    conn.close()
    print("\nMigracion completada.")

if __name__ == "__main__":
    upgrade_db()
