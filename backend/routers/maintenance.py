from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from database import DATABASE_URL, engine


router = APIRouter(prefix="/maintenance", tags=["Maintenance"])

IS_SQLITE = DATABASE_URL.startswith("sqlite")

MIGRATIONS = [
    {
        "name": "empresas.numero_contacto",
        "sqlite": "ALTER TABLE empresas ADD COLUMN numero_contacto VARCHAR",
        "postgres": "ALTER TABLE empresas ADD COLUMN IF NOT EXISTS numero_contacto VARCHAR",
    },
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
    # ── Nuevos eventos: acceso en grupos ────────────────────────────────────
    {
        "name": "grupos.surf_acceso",
        "sqlite": "ALTER TABLE grupos ADD COLUMN surf_acceso BOOLEAN DEFAULT FALSE",
        "postgres": "ALTER TABLE grupos ADD COLUMN IF NOT EXISTS surf_acceso BOOLEAN DEFAULT FALSE",
    },
    {
        "name": "grupos.unipraias_acceso",
        "sqlite": "ALTER TABLE grupos ADD COLUMN unipraias_acceso BOOLEAN DEFAULT FALSE",
        "postgres": "ALTER TABLE grupos ADD COLUMN IF NOT EXISTS unipraias_acceso BOOLEAN DEFAULT FALSE",
    },
    {
        "name": "grupos.beto_acceso",
        "sqlite": "ALTER TABLE grupos ADD COLUMN beto_acceso BOOLEAN DEFAULT FALSE",
        "postgres": "ALTER TABLE grupos ADD COLUMN IF NOT EXISTS beto_acceso BOOLEAN DEFAULT FALSE",
    },
    {
        "name": "grupos.barco_acceso",
        "sqlite": "ALTER TABLE grupos ADD COLUMN barco_acceso BOOLEAN DEFAULT FALSE",
        "postgres": "ALTER TABLE grupos ADD COLUMN IF NOT EXISTS barco_acceso BOOLEAN DEFAULT FALSE",
    },
    {
        "name": "grupos.cristo_acceso",
        "sqlite": "ALTER TABLE grupos ADD COLUMN cristo_acceso BOOLEAN DEFAULT FALSE",
        "postgres": "ALTER TABLE grupos ADD COLUMN IF NOT EXISTS cristo_acceso BOOLEAN DEFAULT FALSE",
    },
    {
        "name": "grupos.sunset_acceso",
        "sqlite": "ALTER TABLE grupos ADD COLUMN sunset_acceso BOOLEAN DEFAULT FALSE",
        "postgres": "ALTER TABLE grupos ADD COLUMN IF NOT EXISTS sunset_acceso BOOLEAN DEFAULT FALSE",
    },
    # ── Nuevos eventos: pagantes_finales en grupos ───────────────────────────
    {
        "name": "grupos.pagantes_finales_surf",
        "sqlite": "ALTER TABLE grupos ADD COLUMN pagantes_finales_surf INTEGER",
        "postgres": "ALTER TABLE grupos ADD COLUMN IF NOT EXISTS pagantes_finales_surf INTEGER",
    },
    {
        "name": "grupos.pagantes_finales_unipraias",
        "sqlite": "ALTER TABLE grupos ADD COLUMN pagantes_finales_unipraias INTEGER",
        "postgres": "ALTER TABLE grupos ADD COLUMN IF NOT EXISTS pagantes_finales_unipraias INTEGER",
    },
    {
        "name": "grupos.pagantes_finales_beto",
        "sqlite": "ALTER TABLE grupos ADD COLUMN pagantes_finales_beto INTEGER",
        "postgres": "ALTER TABLE grupos ADD COLUMN IF NOT EXISTS pagantes_finales_beto INTEGER",
    },
    {
        "name": "grupos.pagantes_finales_barco",
        "sqlite": "ALTER TABLE grupos ADD COLUMN pagantes_finales_barco INTEGER",
        "postgres": "ALTER TABLE grupos ADD COLUMN IF NOT EXISTS pagantes_finales_barco INTEGER",
    },
    {
        "name": "grupos.pagantes_finales_cristo",
        "sqlite": "ALTER TABLE grupos ADD COLUMN pagantes_finales_cristo INTEGER",
        "postgres": "ALTER TABLE grupos ADD COLUMN IF NOT EXISTS pagantes_finales_cristo INTEGER",
    },
    {
        "name": "grupos.pagantes_finales_sunset",
        "sqlite": "ALTER TABLE grupos ADD COLUMN pagantes_finales_sunset INTEGER",
        "postgres": "ALTER TABLE grupos ADD COLUMN IF NOT EXISTS pagantes_finales_sunset INTEGER",
    },
    # ── Nuevos eventos: precios en finanzas_empresa ──────────────────────────
    {
        "name": "finanzas_empresa.precio_surf",
        "sqlite": "ALTER TABLE finanzas_empresa ADD COLUMN precio_surf INTEGER DEFAULT 0",
        "postgres": "ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS precio_surf INTEGER DEFAULT 0",
    },
    {
        "name": "finanzas_empresa.precio_unipraias",
        "sqlite": "ALTER TABLE finanzas_empresa ADD COLUMN precio_unipraias INTEGER DEFAULT 0",
        "postgres": "ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS precio_unipraias INTEGER DEFAULT 0",
    },
    {
        "name": "finanzas_empresa.precio_beto",
        "sqlite": "ALTER TABLE finanzas_empresa ADD COLUMN precio_beto INTEGER DEFAULT 0",
        "postgres": "ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS precio_beto INTEGER DEFAULT 0",
    },
    {
        "name": "finanzas_empresa.precio_barco",
        "sqlite": "ALTER TABLE finanzas_empresa ADD COLUMN precio_barco INTEGER DEFAULT 0",
        "postgres": "ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS precio_barco INTEGER DEFAULT 0",
    },
    {
        "name": "finanzas_empresa.precio_cristo",
        "sqlite": "ALTER TABLE finanzas_empresa ADD COLUMN precio_cristo INTEGER DEFAULT 0",
        "postgres": "ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS precio_cristo INTEGER DEFAULT 0",
    },
    {
        "name": "finanzas_empresa.precio_sunset",
        "sqlite": "ALTER TABLE finanzas_empresa ADD COLUMN precio_sunset INTEGER DEFAULT 0",
        "postgres": "ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS precio_sunset INTEGER DEFAULT 0",
    },
    # ── Nuevos eventos: flags combo en finanzas_empresa ─────────────────────
    {
        "name": "finanzas_empresa.combo_surf",
        "sqlite": "ALTER TABLE finanzas_empresa ADD COLUMN combo_surf BOOLEAN DEFAULT FALSE",
        "postgres": "ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS combo_surf BOOLEAN DEFAULT FALSE",
    },
    {
        "name": "finanzas_empresa.combo_unipraias",
        "sqlite": "ALTER TABLE finanzas_empresa ADD COLUMN combo_unipraias BOOLEAN DEFAULT FALSE",
        "postgres": "ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS combo_unipraias BOOLEAN DEFAULT FALSE",
    },
    {
        "name": "finanzas_empresa.combo_beto",
        "sqlite": "ALTER TABLE finanzas_empresa ADD COLUMN combo_beto BOOLEAN DEFAULT FALSE",
        "postgres": "ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS combo_beto BOOLEAN DEFAULT FALSE",
    },
    {
        "name": "finanzas_empresa.combo_barco",
        "sqlite": "ALTER TABLE finanzas_empresa ADD COLUMN combo_barco BOOLEAN DEFAULT FALSE",
        "postgres": "ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS combo_barco BOOLEAN DEFAULT FALSE",
    },
    {
        "name": "finanzas_empresa.combo_cristo",
        "sqlite": "ALTER TABLE finanzas_empresa ADD COLUMN combo_cristo BOOLEAN DEFAULT FALSE",
        "postgres": "ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS combo_cristo BOOLEAN DEFAULT FALSE",
    },
    {
        "name": "finanzas_empresa.combo_sunset",
        "sqlite": "ALTER TABLE finanzas_empresa ADD COLUMN combo_sunset BOOLEAN DEFAULT FALSE",
        "postgres": "ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS combo_sunset BOOLEAN DEFAULT FALSE",
    },
    {
        "name": "fechas_evento.horario",
        "sqlite": "ALTER TABLE fechas_evento ADD COLUMN horario VARCHAR",
        "postgres": "ALTER TABLE fechas_evento ADD COLUMN IF NOT EXISTS horario VARCHAR",
    },
    {
        "name": "grupos.campamento_acceso",
        "sqlite": "ALTER TABLE grupos ADD COLUMN campamento_acceso BOOLEAN DEFAULT FALSE",
        "postgres": "ALTER TABLE grupos ADD COLUMN IF NOT EXISTS campamento_acceso BOOLEAN DEFAULT FALSE",
    },
    {
        "name": "grupos.campamento_con_comida",
        "sqlite": "ALTER TABLE grupos ADD COLUMN campamento_con_comida BOOLEAN DEFAULT FALSE",
        "postgres": "ALTER TABLE grupos ADD COLUMN IF NOT EXISTS campamento_con_comida BOOLEAN DEFAULT FALSE",
    },
    {
        "name": "grupos.zacarias_acceso",
        "sqlite": "ALTER TABLE grupos ADD COLUMN zacarias_acceso BOOLEAN DEFAULT FALSE",
        "postgres": "ALTER TABLE grupos ADD COLUMN IF NOT EXISTS zacarias_acceso BOOLEAN DEFAULT FALSE",
    },
    {
        "name": "grupos.zacarias_con_comida",
        "sqlite": "ALTER TABLE grupos ADD COLUMN zacarias_con_comida BOOLEAN DEFAULT FALSE",
        "postgres": "ALTER TABLE grupos ADD COLUMN IF NOT EXISTS zacarias_con_comida BOOLEAN DEFAULT FALSE",
    },
    {
        "name": "grupos.pagantes_finales_campamento",
        "sqlite": "ALTER TABLE grupos ADD COLUMN pagantes_finales_campamento INTEGER",
        "postgres": "ALTER TABLE grupos ADD COLUMN IF NOT EXISTS pagantes_finales_campamento INTEGER",
    },
    {
        "name": "grupos.pagantes_finales_zacarias",
        "sqlite": "ALTER TABLE grupos ADD COLUMN pagantes_finales_zacarias INTEGER",
        "postgres": "ALTER TABLE grupos ADD COLUMN IF NOT EXISTS pagantes_finales_zacarias INTEGER",
    },
    {
        "name": "finanzas_empresa.precio_campamento_individual",
        "sqlite": "ALTER TABLE finanzas_empresa ADD COLUMN precio_campamento_individual INTEGER DEFAULT 0",
        "postgres": "ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS precio_campamento_individual INTEGER DEFAULT 0",
    },
    {
        "name": "finanzas_empresa.precio_campamento_con_comida",
        "sqlite": "ALTER TABLE finanzas_empresa ADD COLUMN precio_campamento_con_comida INTEGER DEFAULT 0",
        "postgres": "ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS precio_campamento_con_comida INTEGER DEFAULT 0",
    },
    {
        "name": "finanzas_empresa.precio_campamento_sin_comida",
        "sqlite": "ALTER TABLE finanzas_empresa ADD COLUMN precio_campamento_sin_comida INTEGER DEFAULT 0",
        "postgres": "ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS precio_campamento_sin_comida INTEGER DEFAULT 0",
    },
    {
        "name": "finanzas_empresa.precio_zacarias_individual",
        "sqlite": "ALTER TABLE finanzas_empresa ADD COLUMN precio_zacarias_individual INTEGER DEFAULT 0",
        "postgres": "ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS precio_zacarias_individual INTEGER DEFAULT 0",
    },
    {
        "name": "finanzas_empresa.precio_zacarias_con_comida",
        "sqlite": "ALTER TABLE finanzas_empresa ADD COLUMN precio_zacarias_con_comida INTEGER DEFAULT 0",
        "postgres": "ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS precio_zacarias_con_comida INTEGER DEFAULT 0",
    },
    {
        "name": "finanzas_empresa.precio_zacarias_sin_comida",
        "sqlite": "ALTER TABLE finanzas_empresa ADD COLUMN precio_zacarias_sin_comida INTEGER DEFAULT 0",
        "postgres": "ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS precio_zacarias_sin_comida INTEGER DEFAULT 0",
    },
    {
        "name": "finanzas_empresa.combo_campamento",
        "sqlite": "ALTER TABLE finanzas_empresa ADD COLUMN combo_campamento BOOLEAN DEFAULT FALSE",
        "postgres": "ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS combo_campamento BOOLEAN DEFAULT FALSE",
    },
    {
        "name": "finanzas_empresa.combo_zacarias",
        "sqlite": "ALTER TABLE finanzas_empresa ADD COLUMN combo_zacarias BOOLEAN DEFAULT FALSE",
        "postgres": "ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS combo_zacarias BOOLEAN DEFAULT FALSE",
    },
    {
        "name": "finanzas_empresa.campamento_liberados_ratio",
        "sqlite": "ALTER TABLE finanzas_empresa ADD COLUMN campamento_liberados_ratio INTEGER DEFAULT 0",
        "postgres": "ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS campamento_liberados_ratio INTEGER DEFAULT 0",
    },
    {
        "name": "finanzas_empresa.campamento_padres_gratis",
        "sqlite": "ALTER TABLE finanzas_empresa ADD COLUMN campamento_padres_gratis BOOLEAN DEFAULT FALSE",
        "postgres": "ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS campamento_padres_gratis BOOLEAN DEFAULT FALSE",
    },
    {
        "name": "finanzas_empresa.campamento_guias_gratis",
        "sqlite": "ALTER TABLE finanzas_empresa ADD COLUMN campamento_guias_gratis BOOLEAN DEFAULT FALSE",
        "postgres": "ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS campamento_guias_gratis BOOLEAN DEFAULT FALSE",
    },
    {
        "name": "finanzas_empresa.zacarias_liberados_ratio",
        "sqlite": "ALTER TABLE finanzas_empresa ADD COLUMN zacarias_liberados_ratio INTEGER DEFAULT 0",
        "postgres": "ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS zacarias_liberados_ratio INTEGER DEFAULT 0",
    },
    {
        "name": "finanzas_empresa.zacarias_padres_gratis",
        "sqlite": "ALTER TABLE finanzas_empresa ADD COLUMN zacarias_padres_gratis BOOLEAN DEFAULT FALSE",
        "postgres": "ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS zacarias_padres_gratis BOOLEAN DEFAULT FALSE",
    },
    {
        "name": "finanzas_empresa.zacarias_guias_gratis",
        "sqlite": "ALTER TABLE finanzas_empresa ADD COLUMN zacarias_guias_gratis BOOLEAN DEFAULT FALSE",
        "postgres": "ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS zacarias_guias_gratis BOOLEAN DEFAULT FALSE",
    },
    {
        "name": "grupos.pagantes_finales_campamento_p",
        "sqlite": "ALTER TABLE grupos ADD COLUMN pagantes_finales_campamento_p INTEGER",
        "postgres": "ALTER TABLE grupos ADD COLUMN IF NOT EXISTS pagantes_finales_campamento_p INTEGER",
    },
    {
        "name": "grupos.pagantes_finales_zacarias_p",
        "sqlite": "ALTER TABLE grupos ADD COLUMN pagantes_finales_zacarias_p INTEGER",
        "postgres": "ALTER TABLE grupos ADD COLUMN IF NOT EXISTS pagantes_finales_zacarias_p INTEGER",
    },
    {
        "name": "fechas_evento.show",
        "sqlite": "ALTER TABLE fechas_evento ADD COLUMN show VARCHAR",
        "postgres": "ALTER TABLE fechas_evento ADD COLUMN IF NOT EXISTS show VARCHAR",
    },
    {
        "name": "fechas_evento.animador",
        "sqlite": "ALTER TABLE fechas_evento ADD COLUMN animador VARCHAR",
        "postgres": "ALTER TABLE fechas_evento ADD COLUMN IF NOT EXISTS animador VARCHAR",
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


# =========================================================
# DIAGNÓSTICO Y LIMPIEZA DE ASIGNACIONES FUERA DE ESTADÍA
# =========================================================

@router.get("/diagnostico-asignaciones", summary="Detectar asignaciones fantasmas o fuera de estadía")
def diagnostico_asignaciones():
    """Analiza todas las asignaciones de la base de datos y las clasifica:
    1. Válidas normales (dentro de estadía)
    2. Zacarías día de salida con zacarias_ultimo_dia (válidas, NO borrar)
    3. Con vouchers generados (requiere revisar fechas del grupo antes de tocar)
    4. Fantasmas / huérfanas (fuera de estadía, candidatas a borrado)
    """
    from database import SessionLocal
    import models

    db = SessionLocal()
    try:
        asigs = db.query(models.Asignacion).all()
        total = len(asigs)

        zacarias_salida_validas = []
        con_vouchers = []
        fantasmas_borrables = []
        huerfanas = []

        for a in asigs:
            if not a.grupo or not a.fecha_evento:
                huerfanas.append({
                    "asignacion_id": a.id,
                    "grupo_id": a.grupo_id,
                    "fecha_evento_id": a.fecha_evento_id,
                    "motivo": "Grupo o FechaEvento inexistente"
                })
                continue

            g = a.grupo
            fe = a.fecha_evento
            ev = fe.evento
            tipo_ev = (ev.tipo or "").upper() if ev else ""

            # Caso Zacarías día de salida
            es_zac_salida = (
                tipo_ev == "ZACARIAS"
                and bool(getattr(g, "zacarias_ultimo_dia", False))
                and fe.fecha == g.fecha_salida
            )

            # En estadía normal
            en_estadia = (g.fecha_entrada <= fe.fecha < g.fecha_salida)

            if en_estadia:
                continue

            empresa_nom = g.empresa.nombre if g.empresa else "Sin Empresa"
            ev_nom = ev.nombre if ev else "Sin Evento"
            cant_vouchers = len(a.vouchers) if getattr(a, "vouchers", None) else 0

            info = {
                "asignacion_id": a.id,
                "empresa": empresa_nom,
                "grupo_id": g.id,
                "grupo_nombre": g.nombre,
                "evento_id": ev.id if ev else None,
                "evento_nombre": ev_nom,
                "evento_tipo": tipo_ev,
                "fecha_evento": str(fe.fecha),
                "fecha_entrada": str(g.fecha_entrada),
                "fecha_salida": str(g.fecha_salida),
                "zacarias_ultimo_dia": bool(getattr(g, "zacarias_ultimo_dia", False)),
                "cant_vouchers": cant_vouchers,
            }

            if es_zac_salida:
                zacarias_salida_validas.append(info)
            elif cant_vouchers > 0:
                con_vouchers.append(info)
            else:
                fantasmas_borrables.append(info)

        return {
            "total_asignaciones": total,
            "resumen": {
                "zacarias_salida_validas": len(zacarias_salida_validas),
                "con_vouchers_requieren_revision": len(con_vouchers),
                "fantasmas_borrables_sin_vouchers": len(fantasmas_borrables),
                "huerfanas": len(huerfanas),
            },
            "detalle": {
                "zacarias_salida_validas": zacarias_salida_validas,
                "con_vouchers": con_vouchers,
                "fantasmas_borrables": fantasmas_borrables,
                "huerfanas": huerfanas,
            }
        }
    finally:
        db.close()


@router.delete("/limpiar-asignacion/{asignacion_id}", summary="Eliminar una asignación y sus vouchers asociados")
def limpiar_asignacion(asignacion_id: int):
    """Elimina de forma segura y en cascada una asignación puntual y sus vouchers vinculados."""
    from database import SessionLocal
    import models

    db = SessionLocal()
    try:
        asig = db.get(models.Asignacion, asignacion_id)
        if not asig:
            raise HTTPException(404, f"Asignación #{asignacion_id} no encontrada")

        vouchers_borrados = 0
        if getattr(asig, "vouchers", None):
            vouchers_borrados = len(asig.vouchers)
            for v in list(asig.vouchers):
                db.delete(v)

        ev_nom = asig.fecha_evento.evento.nombre if (asig.fecha_evento and asig.fecha_evento.evento) else "Evento"
        g_nom = asig.grupo.nombre if asig.grupo else f"Grupo #{asig.grupo_id}"

        db.delete(asig)
        db.commit()

        return {
            "ok": True,
            "asignacion_id": asignacion_id,
            "grupo": g_nom,
            "evento": ev_nom,
            "vouchers_borrados": vouchers_borrados,
            "mensaje": f"Asignación #{asignacion_id} ({g_nom} en {ev_nom}) eliminada correctamente."
        }
    finally:
        db.close()
