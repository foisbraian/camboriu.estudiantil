import sqlite3

def upgrade_db():
    conn = sqlite3.connect('app.db')
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE finanzas_empresa ADD COLUMN moneda VARCHAR DEFAULT 'ARS'")
        print("Column 'moneda' added successfully.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("Column 'moneda' already exists.")
        else:
            print("Error:", e)
    
    conn.commit()
    conn.close()

if __name__ == "__main__":
    upgrade_db()
