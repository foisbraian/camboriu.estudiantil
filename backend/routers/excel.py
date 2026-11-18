import os
import tempfile
from datetime import datetime

from fastapi import APIRouter, Depends, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database import get_db
import models

from openpyxl import Workbook

router = APIRouter(prefix="/excel", tags=["Excel"])


# ==========================================
# EXPORTAR TODO EL SISTEMA A EXCEL
# ==========================================

def _cleanup_file(path: str):
    try:
        os.remove(path)
    except OSError:
        pass


@router.get("/exportar")
def exportar_excel(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):

    wb = Workbook()

    # =================================================
    # HOJA 1 → ASIGNACIONES (UNA FILA POR SERVICIO/FECHA)
    # =================================================

    ws = wb.active
    ws.title = "Asignaciones por Servicio"

    ws.append([
        "Fecha", "Servicio", "Complejo", "Temática", "Empresa", "Grupo", 
        "Check-in", "Check-out", 
        "Estudiantes", "Padres", "Guias", "Total Pax",
        "Alcohol Grupo", "Con Comida"
    ])

    # Obtener todas las asignaciones y ordenarlas por fecha
    asignaciones = db.query(models.Asignacion).all()
    asignaciones_por_tipo = {"CENA": set(), "HIELO": set()}
    asignaciones_sorted = sorted(
        asignaciones,
        key=lambda x: (
            x.fecha_evento.fecha if x.fecha_evento else datetime.max.date(),
            x.fecha_evento.evento.nombre if x.fecha_evento and x.fecha_evento.evento else ""
        )
    )

    for a in asignaciones:
        if not a.fecha_evento or not a.fecha_evento.evento:
            continue
        tipo = a.fecha_evento.evento.tipo
        if tipo in asignaciones_por_tipo and a.grupo_id:
            asignaciones_por_tipo[tipo].add(a.grupo_id)

    for a in asignaciones_sorted:
        grupo = a.grupo
        fecha_evento = a.fecha_evento
        evento = fecha_evento.evento if fecha_evento else None

        if not grupo or not fecha_evento or not evento:
            continue
        
        # Determinar si tiene comida según el tipo de servicio
        if evento.tipo == "PARQUE":
            con_comida = "SI" if grupo.parque_con_comida else "NO"
        elif evento.tipo == "CAMPAMENTO":
            con_comida = "SI" if getattr(grupo, "campamento_con_comida", False) else "NO"
        elif evento.tipo == "ZACARIAS":
            con_comida = "SI" if getattr(grupo, "zacarias_con_comida", False) else "NO"
        elif evento.tipo == "POOL":
            con_comida = "SI" if grupo.pool_con_comida else "NO"
        else:  # DISCO
            con_comida = "N/A"
        
        # Temática (solo para discos)
        tematica = fecha_evento.tematica.nombre if fecha_evento.tematica else ""
        
        ws.append([
            fecha_evento.fecha,
            evento.nombre,
            evento.complejo or "",
            tematica,
            grupo.empresa.nombre,
            grupo.nombre,
            grupo.fecha_entrada,
            grupo.fecha_salida,
            grupo.cantidad_estudiantes,
            grupo.cantidad_padres,
            grupo.cantidad_guias,
            grupo.cantidad_pax,
            "SI" if grupo.permite_alcohol else "NO",
            con_comida
        ])

    # =================================================
    # HOJA 2 → DISCOS
    # =================================================

    ws2 = wb.create_sheet("Discos")

    ws2.append(["Fecha", "Disco", "Complejo", "Temática", "Alcohol", "Pax total"])

    fechas = db.query(models.FechaEvento).all()

    for f in fechas:
        if f.evento.tipo != "DISCO":
            continue

        total = sum(a.grupo.cantidad_pax for a in f.asignaciones if a.grupo)
        tematica = f.tematica.nombre if f.tematica else ""

        ws2.append([
            f.fecha,
            f.evento.nombre,
            f.evento.complejo or "",
            tematica,
            "CON" if f.con_alcohol else "SIN",
            total
        ])

    # =================================================
    # HOJA 3 → PARQUE (POR EMPRESA)
    # =================================================

    ws3 = wb.create_sheet("Parque")

    ws3.append(["Fecha", "Empresa", "Pax con comida", "Pax sin comida"])

    for f in fechas:
        if f.evento.tipo != "PARQUE":
            continue

        empresas = {}

        for a in f.asignaciones:
            if not a.grupo or not a.grupo.empresa:
                continue
            empresa = a.grupo.empresa.nombre

            if empresa not in empresas:
                empresas[empresa] = {"con": 0, "sin": 0}

            if a.grupo.parque_con_comida:
                empresas[empresa]["con"] += a.grupo.cantidad_pax
            else:
                empresas[empresa]["sin"] += a.grupo.cantidad_pax

        for emp, datos in empresas.items():
            ws3.append([f.fecha, emp, datos["con"], datos["sin"]])

    # =================================================
    # HOJA CAMPAMENTO (POR EMPRESA)
    # =================================================
    ws_camp = wb.create_sheet("Campamento Americano")
    ws_camp.append(["Fecha", "Empresa", "Pax con comida", "Pax sin comida"])
    for f in fechas:
        if f.evento.tipo != "CAMPAMENTO":
            continue
        empresas = {}
        for a in f.asignaciones:
            if not a.grupo or not a.grupo.empresa:
                continue
            empresa = a.grupo.empresa.nombre
            if empresa not in empresas:
                empresas[empresa] = {"con": 0, "sin": 0}
            if getattr(a.grupo, "campamento_con_comida", False):
                empresas[empresa]["con"] += a.grupo.cantidad_pax
            else:
                empresas[empresa]["sin"] += a.grupo.cantidad_pax
        for emp, datos in empresas.items():
            ws_camp.append([f.fecha, emp, datos["con"], datos["sin"]])

    # =================================================
    # HOJA ZACARIAS (POR EMPRESA)
    # =================================================
    ws_zac = wb.create_sheet("Zacarias")
    ws_zac.append(["Fecha", "Empresa", "Pax con comida", "Pax sin comida"])
    for f in fechas:
        if f.evento.tipo != "ZACARIAS":
            continue
        empresas = {}
        for a in f.asignaciones:
            if not a.grupo or not a.grupo.empresa:
                continue
            empresa = a.grupo.empresa.nombre
            if empresa not in empresas:
                empresas[empresa] = {"con": 0, "sin": 0}
            if getattr(a.grupo, "zacarias_con_comida", False):
                empresas[empresa]["con"] += a.grupo.cantidad_pax
            else:
                empresas[empresa]["sin"] += a.grupo.cantidad_pax
        for emp, datos in empresas.items():
            ws_zac.append([f.fecha, emp, datos["con"], datos["sin"]])

    # =================================================
    # HOJA 4 → POOL (POR EMPRESA)
    # =================================================
    ws4 = wb.create_sheet("Pool")

    ws4.append(["Fecha", "Empresa", "Pax con comida", "Pax sin comida"])

    for f in fechas:
        if f.evento.tipo != "POOL":
            continue

        empresas = {}

        for a in f.asignaciones:
            if not a.grupo or not a.grupo.empresa:
                continue
            empresa = a.grupo.empresa.nombre

            if empresa not in empresas:
                empresas[empresa] = {"con": 0, "sin": 0}

            if a.grupo.pool_con_comida:
                empresas[empresa]["con"] += a.grupo.cantidad_pax
            else:
                empresas[empresa]["sin"] += a.grupo.cantidad_pax

        for emp, datos in empresas.items():
            ws4.append([f.fecha, emp, datos["con"], datos["sin"]])

    # =================================================
    # HOJA 5 → CENAS DE VELAS (POR GRUPO)
    # =================================================

    ws5 = wb.create_sheet("Cenas de Velas")
    ws5.append([
        "Empresa", "Grupo", "Check-in", "Check-out",
        "Estudiantes", "Padres", "Guias", "Total Pax"
    ])

    grupos = db.query(models.Grupo).all()
    for g in grupos:
        if not (g.cena_velas or g.id in asignaciones_por_tipo["CENA"]):
            continue
        ws5.append([
            g.empresa.nombre if g.empresa else "",
            g.nombre,
            g.fecha_entrada,
            g.fecha_salida,
            g.cantidad_estudiantes,
            g.cantidad_padres,
            g.cantidad_guias,
            g.cantidad_pax
        ])

    # =================================================
    # HOJA 6 → BAR DE HIELO (POR GRUPO)
    # =================================================

    ws6 = wb.create_sheet("Bar de Hielo")
    ws6.append([
        "Empresa", "Grupo", "Check-in", "Check-out",
        "Estudiantes", "Padres", "Guias", "Total Pax"
    ])

    for g in grupos:
        if not (g.bar_hielo or g.id in asignaciones_por_tipo["HIELO"]):
            continue
        ws6.append([
            g.empresa.nombre if g.empresa else "",
            g.nombre,
            g.fecha_entrada,
            g.fecha_salida,
            g.cantidad_estudiantes,
            g.cantidad_padres,
            g.cantidad_guias,
            g.cantidad_pax
        ])

    # =================================================
    # HOJA 7 → QUINTA COMIDA (POR GRUPO)
    # =================================================

    ws7 = wb.create_sheet("Quinta Comida")
    ws7.append([
        "Empresa", "Grupo", "Check-in", "Check-out",
        "Estudiantes", "Padres", "Guias", "Total Pax"
    ])

    for g in grupos:
        if not g.quinta_comida_acceso:
            continue
        ws7.append([
            g.empresa.nombre if g.empresa else "",
            g.nombre,
            g.fecha_entrada,
            g.fecha_salida,
            g.cantidad_estudiantes,
            g.cantidad_padres,
            g.cantidad_guias,
            g.cantidad_pax
        ])

    # =================================================
    # GUARDAR
    # =================================================

    filename = f"reporte_eventos_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        filepath = tmp.name

    wb.save(filepath)
    background_tasks.add_task(_cleanup_file, filepath)

    return FileResponse(
        filepath,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


# ==========================================
# EXPORTAR REPORTE FINANCIERO DE UNA EMPRESA
# ==========================================

# ==========================================
# EXPORTAR RESUMEN FINANCIERO DE TODAS
# ==========================================

@router.get("/finanzas/todas")
def exportar_finanzas_todas(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    from routers.finanzas import get_resumen_empresa

    wb = Workbook()
    ws = wb.active
    ws.title = "Resumen Empresas"

    ws.append([
        "Empresa",
        "Total PAX",
        "Total Cobrado USD",
        "Saldo USD",
        "Total a Pagar USD",
        "Total Cobrado BRL",
        "Saldo BRL",
        "Total a Pagar BRL"
    ])

    empresas = db.query(models.Empresa).all()
    for e in empresas:
        res = get_resumen_empresa(e.id, db)
        total_pax = sum(g.get("pax", 0) for g in res.get("grupos", []))
        total_pagado = res.get("total_pagado", 0)
        saldo = res.get("saldo", 0)
        total_venta = res.get("total_venta", 0)
        
        ws.append([
            e.nombre,
            total_pax,
            res.get("total_pagado_usd", 0),
            res.get("saldo_usd_equivalente", saldo),
            res.get("total_venta_usd", 0),
            res.get("total_pagado_brl", 0),
            res.get("saldo_brl_equivalente", 0),
            res.get("total_venta_brl", 0)
        ])

    filename = f"reporte_financiero_todas_{datetime.now().strftime('%Y%m%d')}.xlsx"
    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        filepath = tmp.name

    wb.save(filepath)
    background_tasks.add_task(_cleanup_file, filepath)

    return FileResponse(
        filepath,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


@router.get("/finanzas/{empresa_id:int}")
def exportar_finanzas(empresa_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    from routers.finanzas import get_resumen_empresa
    
    res = get_resumen_empresa(empresa_id, db)
    
    wb = Workbook()
    ws = wb.active
    ws.title = "Resumen Financiero"
    
    ws.append(["REPORTE FINANCIERO - " + res["empresa"]])
    ws.append([])
    
    # Detalle de grupos
    ws.append(["Grupo", "Servicio", "Moneda", "Detalle", "Precio Unit.", "Cant.", "Estud.", "Padres", "Guias", "Total PAX", "Pagantes", "Subtotal Orig.", "Subtotal (USD)"])
    for g in res["grupos"]:
        # Fila de encabezado de grupo
        ws.append([g["nombre"], "", "", "", "", "", g["estudiantes"], g["padres"], g["guias"], g["pax"], "", "", g["subtotal"]])
        # Filas de detalles de servicios
        for s in g["servicios"]:
            ws.append([
                "", 
                s["servicio"], 
                s.get("moneda", "USD"),
                s["descripcion"], 
                s["precio_u"], 
                s["cantidad"], 
                s["estudiantes"],
                s["padres"],
                s["guias"],
                s["pax_original"],
                s["pax"], # Este es el 'pax_cobrar'
                s.get("subtotal_original", s["subtotal"]),
                s["subtotal"]
            ])
    
    ws.append([])
    ws.append(["TASA DE CAMBIO PACTADA (1 USD = X BRL)", res.get("tasa_cambio", 5.3)])
    ws.append(["TOTAL SERVICIOS EN DÓLARES (USD)", res.get("total_venta_usd", 0)])
    ws.append(["TOTAL SERVICIOS EN REALES (BRL)", res.get("total_venta_brl", 0)])
    ws.append(["TOTAL VENTA CONSOLIDADO (USD)", res["total_venta"]])
    ws.append(["TOTAL COBRADO EN DÓLARES (USD)", res.get("total_pagado_usd", 0)])
    ws.append(["TOTAL COBRADO EN REALES (BRL)", res.get("total_pagado_brl", 0)])
    ws.append(["TOTAL COBRADO CONSOLIDADO (USD)", res["total_pagado"]])
    ws.append(["SALDO PENDIENTE (USD)", res["saldo"]])
    ws.append(["SALDO PENDIENTE EQUIVALENTE (BRL)", res.get("saldo_brl_equivalente", 0)])
    
    ws.append([])
    ws.append(["HISTORIAL DE PAGOS"])
    ws.append(["Fecha", "Monto Orig.", "Moneda", "Tasa Cambio", "Monto Eq. (USD)", "Método", "Nota"])
    
    pagos = db.query(models.Pago).filter(models.Pago.empresa_id == empresa_id).all()
    tasa_def = res.get("tasa_cambio", 5.3)
    for p in pagos:
        m_pago = getattr(p, "moneda", "USD") or "USD"
        t_pago = p.tasa_cambio or tasa_def
        conv = p.monto_convertido if p.monto_convertido is not None else (round(p.monto / t_pago, 2) if m_pago == "BRL" else p.monto)
        ws.append([p.fecha, p.monto, m_pago, t_pago, conv, p.metodo, p.nota])
        
    filename = f"reporte_financiero_{res['empresa']}_{datetime.now().strftime('%Y%m%d')}.xlsx"
    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        filepath = tmp.name

    wb.save(filepath)
    background_tasks.add_task(_cleanup_file, filepath)
    
    return FileResponse(
        filepath,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

@router.get("/empresas-informadas")
def exportar_empresas_informadas(anio: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    wb = Workbook()
    ws = wb.active
    ws.title = f"Empresas Informadas {anio}"

    ws.append(["ID", "Empresa", "Contacto", "Años Informados"])

    empresas = db.query(models.Empresa).all()
    
    for emp in empresas:
        if emp.anios_informados and anio in emp.anios_informados:
            ws.append([emp.id, emp.nombre, emp.numero_contacto or "", emp.anios_informados])

    filename = f"empresas_informadas_{anio}.xlsx"
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        filepath = tmp.name

    wb.save(filepath)
    background_tasks.add_task(_cleanup_file, filepath)

    return FileResponse(
        filepath,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
