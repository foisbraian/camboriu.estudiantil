"""
Conector de Claude (servidor MCP) integrado al backend.

Permite que el equipo le pregunte a Claude desde el celular, la web o la computadora
("¿cuántos pax tiene PANAM?") y Claude consulte esta misma base de datos. Todo es SOLO LECTURA.

Se activa solo si existe la variable de entorno MCP_TOKEN (una clave secreta larga).
La dirección del conector queda:  https://<backend>.onrender.com/<MCP_TOKEN>/mcp
Si MCP_TOKEN no está configurada, el backend funciona exactamente igual que antes.
"""

import contextlib
import os
from datetime import date, datetime
from decimal import Decimal

import anyio
from sqlalchemy import inspect, text

from database import engine

MAX_FILAS = 500
TIMEOUT_MS = 15000
ES_POSTGRES = engine.dialect.name == "postgresql"

INSTRUCCIONES = """Base de datos del sistema de eventos de Camboriú Estudiantil (viajes de egresados a Balneário Camboriú).

Modelo de datos principal:
- empresas: agencias de viaje (ej. PANAM, WOLF). Columna `nombre`.
- grupos: cada grupo de viaje pertenece a una empresa (grupos.empresa_id -> empresas.id).
  PAX de un grupo = cantidad_estudiantes + cantidad_padres + cantidad_guias (usar COALESCE(...,0) en cada uno).
  fecha_entrada / fecha_salida: estadía del grupo. La temporada se toma del año de fecha_entrada salvo que se indique otra cosa.
  Columnas *_acceso / *_con_comida: servicios contratados (parque, campamento, zacarias, pool, surf, unipraias, beto, barco, cristo, sunset, quinta_comida, multiparque, parador).
  discos_compradas: cantidad de noches de disco. pagantes_finales_*: pagantes finales por servicio.
- eventos: servicios/lugares (tipo DISCO | PARQUE | POOL, ...) con capacidad_maxima.
- fechas_evento: cada día que abre un evento (evento_id, fecha, tematica_id, con_alcohol, es_privado).
- asignaciones: grupo asignado a una fecha de evento (grupo_id, fecha_evento_id, pax_asignados).
  Ocupación de una fecha = SUM(pax_asignados) (si es NULL usar el pax del grupo); capacidad libre = capacidad_maxima - ocupación.
- finanzas_empresa / precios_servicios_mensuales / pagos: precios por empresa y pagos recibidos.
- hoteles / reservas_hotel / pagos_hotel: hotelería por empresa.

Cómo responder:
- Para preguntas por una empresa, usá primero `resumen_empresa` (busca por nombre parcial, sin importar mayúsculas).
- Para el resto, `consultar_sql` con SELECT (PostgreSQL). Comparar nombres con ILIKE '%texto%'.
- Si dudás de una columna, usá `esquema`.
- Respondé en español, con el dato concreto primero y breve detalle después.
- No muestres codigo_acceso de empresas ni token de vouchers: son credenciales."""


def _valor(v):
    if isinstance(v, Decimal):
        return int(v) if v == v.to_integral_value() else float(v)
    if isinstance(v, (date, datetime)):
        return v.isoformat()
    if isinstance(v, (bytes, memoryview)):
        return "<binario>"
    return v


def _ejecutar(consulta, params=None, limite=MAX_FILAS):
    """Ejecuta en una transacción de solo lectura y siempre hace rollback."""
    with engine.connect() as conn:
        if ES_POSTGRES:
            conn.exec_driver_sql("SET TRANSACTION READ ONLY")
            conn.exec_driver_sql(f"SET LOCAL statement_timeout = {TIMEOUT_MS}")
        try:
            if params is None:
                # SQL libre: se pasa tal cual al driver, sin parámetros, para que '%' (ILIKE '%x%') funcione
                cur = conn.connection.cursor()
                cur.execute(consulta)
                if cur.description is None:
                    return {"columnas": [], "filas": [], "total": 0}
                columnas = [d[0] for d in cur.description]
                filas = cur.fetchmany(limite + 1)
                cur.close()
            else:
                res = conn.execute(text(consulta), params)
                if not res.returns_rows:
                    return {"columnas": [], "filas": [], "total": 0}
                columnas = list(res.keys())
                filas = res.fetchmany(limite + 1)
        finally:
            conn.rollback()
    salida = {
        "columnas": columnas,
        "filas": [dict(zip(columnas, map(_valor, f))) for f in filas[:limite]],
    }
    salida["total"] = len(salida["filas"])
    if len(filas) > limite:
        salida["aviso"] = f"Se muestran solo las primeras {limite} filas. Usá SUM/COUNT/GROUP BY o filtros."
    return salida


def _esquema():
    insp = inspect(engine)
    tablas = []
    for nombre in sorted(insp.get_table_names()):
        fks = [
            f"{', '.join(fk['constrained_columns'])} -> {fk['referred_table']}.{', '.join(fk['referred_columns'])}"
            for fk in insp.get_foreign_keys(nombre)
        ]
        tablas.append({
            "tabla": nombre,
            "columnas": [f"{c['name']} ({c['type']})" for c in insp.get_columns(nombre)],
            "relaciones": fks,
        })
    return {"tablas": tablas}


SQL_RESUMEN = """
SELECT e.nombre AS empresa,
       COUNT(g.id) AS grupos,
       COALESCE(SUM(COALESCE(g.cantidad_estudiantes,0)),0) AS estudiantes,
       COALESCE(SUM(COALESCE(g.cantidad_padres,0)),0) AS padres,
       COALESCE(SUM(COALESCE(g.cantidad_guias,0)),0) AS guias,
       COALESCE(SUM(COALESCE(g.cantidad_estudiantes,0) + COALESCE(g.cantidad_padres,0) + COALESCE(g.cantidad_guias,0)),0) AS pax_totales,
       MIN(g.fecha_entrada) AS primera_entrada,
       MAX(g.fecha_salida) AS ultima_salida
FROM empresas e
LEFT JOIN grupos g ON g.empresa_id = e.id
WHERE LOWER(e.nombre) LIKE :patron
GROUP BY e.id, e.nombre
ORDER BY e.nombre
"""

SQL_GRUPOS = """
SELECT g.nombre AS grupo, g.fecha_entrada, g.fecha_salida,
       COALESCE(g.cantidad_estudiantes,0) AS estudiantes,
       COALESCE(g.cantidad_padres,0) AS padres,
       COALESCE(g.cantidad_guias,0) AS guias,
       COALESCE(g.cantidad_estudiantes,0) + COALESCE(g.cantidad_padres,0) + COALESCE(g.cantidad_guias,0) AS pax
FROM grupos g JOIN empresas e ON e.id = g.empresa_id
WHERE LOWER(e.nombre) LIKE :patron
ORDER BY g.fecha_entrada, g.nombre
"""


def _resumen_empresa(nombre, anio):
    params = {"patron": f"%{nombre.strip().lower()}%"}
    resumen, grupos = SQL_RESUMEN, SQL_GRUPOS
    if anio:
        filtro = " AND EXTRACT(YEAR FROM g.fecha_entrada) = :anio" if ES_POSTGRES else " AND strftime('%Y', g.fecha_entrada) = :anio"
        params["anio"] = anio if ES_POSTGRES else str(anio)
        resumen = resumen.replace("LEFT JOIN grupos g ON g.empresa_id = e.id", "LEFT JOIN grupos g ON g.empresa_id = e.id" + filtro)
        grupos = grupos.replace("WHERE LOWER(e.nombre) LIKE :patron", "WHERE LOWER(e.nombre) LIKE :patron" + filtro)
    r = _ejecutar(resumen, params)
    if not r["filas"]:
        return {"mensaje": f"No hay ninguna empresa cuyo nombre contenga '{nombre}'."}
    return {"resumen": r["filas"], "grupos": _ejecutar(grupos, params, limite=200)["filas"]}


_PERMITIDAS = ("select", "with", "table", "values", "explain")


def crear_conector():
    from mcp.server.fastmcp import FastMCP

    token = os.environ["MCP_TOKEN"].strip()
    mcp = FastMCP(
        "Eventos Camboriú",
        instructions=INSTRUCCIONES,
        host="0.0.0.0",  # desactiva el filtro de host local: el servicio corre detrás de Render
        stateless_http=True,
        json_response=True,
        streamable_http_path="/mcp",
    )

    @mcp.tool()
    async def resumen_empresa(nombre: str, anio: int | None = None) -> dict:
        """PAX totales (estudiantes + padres + guías), cantidad de grupos y detalle por grupo de una empresa.
        `nombre` puede ser parcial y no distingue mayúsculas (ej. 'panam').
        `anio` opcional filtra por el año de fecha_entrada de los grupos (temporada)."""
        return await anyio.to_thread.run_sync(_resumen_empresa, nombre, anio)

    @mcp.tool()
    async def esquema() -> dict:
        """Lista todas las tablas con sus columnas y relaciones."""
        return await anyio.to_thread.run_sync(_esquema)

    @mcp.tool()
    async def consultar_sql(consulta: str) -> dict:
        """Ejecuta una consulta SQL de SOLO LECTURA (SELECT / WITH) en PostgreSQL.
        Máximo 500 filas y 15 segundos. Para totales usá SUM/COUNT con GROUP BY.
        Para nombres usá ILIKE '%texto%'."""
        if not consulta.strip().lower().startswith(_PERMITIDAS):
            return {"error": "Solo se permiten consultas de lectura que empiecen con SELECT o WITH."}
        try:
            return await anyio.to_thread.run_sync(_ejecutar, consulta)
        except Exception as e:  # el error vuelve a Claude para que corrija la consulta
            mensaje = str(getattr(e, "orig", e)).strip()
            if "read-only transaction" in mensaje:
                mensaje = "La conexión es de solo lectura: no se pueden modificar datos."
            return {"error": mensaje}

    return token, mcp


def montar_conector(app):
    """Monta el conector en /<MCP_TOKEN>/mcp si MCP_TOKEN está configurada. Nunca rompe el backend."""
    token = os.getenv("MCP_TOKEN", "").strip()
    if not token:
        print("Conector de Claude: desactivado (falta MCP_TOKEN).")
        return
    if len(token) < 24:
        print("Conector de Claude: desactivado (MCP_TOKEN debe tener al menos 24 caracteres).")
        return
    try:
        token, mcp = crear_conector()
        app.mount(f"/{token}", mcp.streamable_http_app())
    except Exception as e:
        print(f"Conector de Claude: no se pudo iniciar ({e}). El backend sigue funcionando.")
        return

    # El conector necesita su administrador de sesiones activo mientras corre la app.
    lifespan_original = app.router.lifespan_context

    @contextlib.asynccontextmanager
    async def lifespan(a):
        async with mcp.session_manager.run():
            async with lifespan_original(a) as estado:
                yield estado

    app.router.lifespan_context = lifespan
    print("Conector de Claude: activo en /<MCP_TOKEN>/mcp")
