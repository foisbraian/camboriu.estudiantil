#!/usr/bin/env python3
"""
Script para actualizar gastos específicos en la base de datos (local o Render).
Actualizaciones:
  - id IN (47, 112) -> concepto = 'OPERATIVO'
  - id = 47         -> categoria = 'LUISINHO'

Formas de uso:
1) Directo en Render Shell (usa DATABASE_URL del entorno):
     python scripts/update_gastos.py

2) Desde tu PC conectándote a la BD externa de Render:
     python backend/scripts/update_gastos.py --db "postgresql://usuario:password@host/nombre_db"

3) Desde tu PC mediante la API de Render (sin tocar PostgreSQL directamente):
     python backend/scripts/update_gastos.py --url "https://tu-backend.onrender.com"
"""

import sys
import os
import argparse
import json
import urllib.request
import urllib.error

def actualizar_via_api(base_url: str):
    base_url = base_url.rstrip("/")
    updates = [
        (47, {"concepto": "OPERATIVO", "categoria": "LUISINHO"}),
        (112, {"concepto": "OPERATIVO"}),
    ]
    print(f"-> Actualizando via API en {base_url}...")
    for gasto_id, payload in updates:
        url = f"{base_url}/gastos/{gasto_id}"
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="PATCH",
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                resultado = json.loads(resp.read().decode("utf-8"))
                print(f"[OK] Gasto #{gasto_id} actualizado: concepto='{resultado.get('concepto')}', categoria='{resultado.get('categoria')}'")
        except urllib.error.HTTPError as e:
            detalle = e.read().decode("utf-8", errors="ignore")
            print(f"[ERROR] Gasto #{gasto_id} devolvió HTTP {e.code}: {detalle}")
        except Exception as e:
            print(f"[ERROR] Gasto #{gasto_id}: {e}")

def actualizar_via_sql(db_url: str):
    from sqlalchemy import create_engine, text

    # Normalizar URL para postgres/psycopg
    if db_url.startswith("postgres://") or db_url.startswith("postgresql://"):
        if "psycopg" not in db_url:
            db_url = db_url.replace("postgres://", "postgresql+psycopg://", 1)
            db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)

    print(f"-> Conectando a la base de datos...")
    engine = create_engine(db_url)
    queries = [
        ("UPDATE gastos_empresa SET concepto = 'OPERATIVO' WHERE id IN (47, 112);", "Actualizar concepto de IDs 47 y 112 a OPERATIVO"),
        ("UPDATE gastos_empresa SET categoria = 'LUISINHO' WHERE id = 47;", "Actualizar categoria de ID 47 a LUISINHO"),
    ]

    with engine.begin() as conn:
        for sql, desc in queries:
            res = conn.execute(text(sql))
            print(f"[OK] {desc} (Filas afectadas: {res.rowcount})")

        # Verificar cómo quedaron
        check = conn.execute(text("SELECT id, fecha, concepto, categoria, total_reales, total_dolares FROM gastos_empresa WHERE id IN (47, 112) ORDER BY id;"))
        filas = check.fetchall()
        print("\nEstado actual de los registros:")
        for f in filas:
            print(f"  - ID {f[0]}: Concepto='{f[2]}', Categoria='{f[3]}', USD={f[5]}, BRL={f[4]}")

def main():
    parser = argparse.ArgumentParser(description="Actualizar gastos 47 y 112")
    parser.add_argument("--db", default=os.getenv("DATABASE_URL"), help="URL de conexión a PostgreSQL")
    parser.add_argument("--url", default=os.getenv("BACKEND_URL"), help="URL del backend de Render (ej: https://tu-app.onrender.com)")
    args = parser.parse_args()

    if args.url:
        actualizar_via_api(args.url)
    elif args.db:
        actualizar_via_sql(args.db)
    else:
        # Intentar importar desde database.py del backend si está disponible
        sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
        try:
            from database import DATABASE_URL
            if DATABASE_URL and not DATABASE_URL.startswith("sqlite"):
                actualizar_via_sql(DATABASE_URL)
                return
        except Exception:
            pass

        print("Error: No se especificó DATABASE_URL ni BACKEND_URL.")
        print("\nUso:")
        print("  1) Por API:")
        print("     python backend/scripts/update_gastos.py --url https://tu-backend.onrender.com")
        print("\n  2) Por Base de Datos PostgreSQL:")
        print("     python backend/scripts/update_gastos.py --db postgresql://usuario:clave@host/db")
        sys.exit(1)

if __name__ == "__main__":
    main()
