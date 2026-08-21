"""Rutas del calendario."""
# pyright: reportGeneralTypeIssues=false

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
import models
from datetime import timedelta, date
import math
from pydantic import BaseModel
from typing import Optional, Any, cast
from collections import defaultdict

router = APIRouter(prefix="/calendario", tags=["Calendario"])

router = APIRouter(prefix="/calendario", tags=["Calendario"])


# =========================================================
# SCHEMAS
# =========================================================

class AsignarEventoBody(BaseModel):
    evento_id: Optional[int] = None
    fecha: date
    fecha_evento_id: Optional[int] = None



class EditarFechaEventoBody(BaseModel):
    evento_id: int
    fecha_nueva: date
    con_alcohol: bool
    es_mix_evento: bool = False  # Mix (pulsera)
    tematica_id: Optional[int] = None
    es_privado: bool = False
    empresa_privada_id: Optional[int] = None
    horario: Optional[str] = None


# =========================================================
# GET CALENDARIO
# =========================================================
@router.get("/")
def calendario(db: Session = Depends(get_db)):

    resources = []
    events = []

    # Fila superior para servicios/eventos globales
    resources.append({
        "id": "eventos",
        "title": "Servicios",
        "order": 0,
    })

    empresas = db.query(models.Empresa).join(models.Grupo).distinct().all()

    order_counter = 1
    for e in empresas:
        empresa_resource_id = f"empresa-{e.id}"
        resources.append({
            "id": empresa_resource_id,
            "title": e.nombre,
            "order": order_counter,
            "extendedProps": {
                "empresaNombre": e.nombre,
                "empresaId": e.id,
                "esEmpresa": True
            }
        })
        order_counter += 1

        for g in e.grupos:
            resources.append({
                "id": g.id,
                "parentId": empresa_resource_id,
                "title": g.nombre,
                "order": order_counter,
                "extendedProps": {
                    "empresaNombre": e.nombre,
                    "empresaId": e.id,
                    "grupoNombre": g.nombre,
                    "pax": g.cantidad_pax,
                    "fechaEntrada": g.fecha_entrada,
                    "fechaSalida": g.fecha_salida,
                    "permite_alcohol": g.permite_alcohol,
                }
            })
            order_counter += 1

    # =====================================================
    # EVENTOS GLOBALES
    # =====================================================
    fechas = db.query(models.FechaEvento).all()

    for f in fechas:

        color_map = {
            "DISCO": "yellow",
            "PARQUE": "green",
            "CAMPAMENTO": "#16a34a",
            "ZACARIAS": "#15803d",
            "BIENVENIDA": "#a855f7",
            "POOL": "skyblue",
            "CENA": "#e2e8f0",
            "HIELO": "#e0f2fe",
            "SURF": "#3b82f6",
            "UNIPRAIAS": "#10b981",
            "BETO": "#ec4899",
            "BARCO": "#8b5cf6",
            "SUNSET": "#f59e0b",
            "CRISTO": "#fcd34d",
            "MULTIPARQUE": "#22c55e"
        }

        # Mix (pulsera) → naranja; con alcohol → rojo; sin alcohol → amarillo (default)
        es_mix = getattr(f, 'es_mix_evento', False)
        if es_mix:
            color = "#f97316"  # Naranja Mix
        elif f.con_alcohol:
            color = "red"
        else:
            color = color_map.get(f.evento.tipo, "gray")
        
        if f.es_privado:
            color = "#ede9fe"
            text_color = "#4c1d95"
        else:
            # Text Color: Black si fondo claro
            text_color = "black" if color in ("yellow", "#e2e8f0", "#e0f2fe", "#f59e0b", "#fcd34d") else "white"
        
        capacidad = f.evento.capacidad_maxima
        ocupacion = 0
        turnos = 0

        if f.evento.tipo == "HIELO":
            turnos = len(f.asignaciones)
            for a in f.asignaciones:
                if a.pax_asignados is not None:
                    ocupacion += a.pax_asignados
                elif a.grupo:
                    ocupacion += a.grupo.cantidad_pax
        else:
            # Calcular ocupación (Sumar PAX de los grupos asignados)
            ocupacion = sum(a.grupo.cantidad_pax for a in f.asignaciones if a.grupo)

        # Desglose Comida
        con_comida = 0
        sin_comida = 0
        
        if f.evento.tipo == "PARQUE":
            con_comida = sum(a.grupo.cantidad_pax for a in f.asignaciones if a.grupo and a.grupo.parque_con_comida)
            sin_comida = sum(a.grupo.cantidad_pax for a in f.asignaciones if a.grupo and not a.grupo.parque_con_comida)
        elif f.evento.tipo == "CAMPAMENTO":
            con_comida = sum(a.grupo.cantidad_pax for a in f.asignaciones if a.grupo and getattr(a.grupo, "campamento_con_comida", False))
            sin_comida = sum(a.grupo.cantidad_pax for a in f.asignaciones if a.grupo and not getattr(a.grupo, "campamento_con_comida", False))
        elif f.evento.tipo == "ZACARIAS":
            con_comida = sum(a.grupo.cantidad_pax for a in f.asignaciones if a.grupo and getattr(a.grupo, "zacarias_con_comida", False))
            sin_comida = sum(a.grupo.cantidad_pax for a in f.asignaciones if a.grupo and not getattr(a.grupo, "zacarias_con_comida", False))
        elif f.evento.tipo == "POOL":
            con_comida = sum(a.grupo.cantidad_pax for a in f.asignaciones if a.grupo and a.grupo.pool_con_comida)
            sin_comida = sum(a.grupo.cantidad_pax for a in f.asignaciones if a.grupo and not a.grupo.pool_con_comida)

        # Título con temática si existe
        if f.evento.tipo == "HIELO":
            capacidad_turno = capacidad or 90
            titulo = f"{f.evento.nombre} (Turnos: {turnos} x {capacidad_turno})"
        else:
            titulo = f"{f.evento.nombre} ({ocupacion}/{capacidad})"
        
        horario_val = getattr(f, "horario", None)
        if horario_val:
            titulo += f" - {horario_val}"

        if f.tematica:
            titulo += f"\n{f.tematica.nombre}"
        
        titulo_extra = ""
        if f.es_privado and f.empresa_privada:
            titulo_extra = f"\nPrivado: {f.empresa_privada.nombre}"

        events.append({
            "id": f"id-{f.id}",
            "resourceId": "eventos",
            "start": f.fecha,
            "end": f.fecha + timedelta(days=1),
            "title": titulo + titulo_extra, 
            "backgroundColor": color,
            "textColor": text_color,
            "extendedProps": {
                "evento_id": f.evento_id,
                "evento_tipo": f.evento.tipo,
                "evento_nombre": f.evento.nombre,
                "con_alcohol": f.con_alcohol,
                "es_mix_evento": getattr(f, 'es_mix_evento', False),
                "horario": getattr(f, "horario", None),
                "ocupacion": ocupacion,
                "capacidad": capacidad,
                "con_comida": con_comida,
                "sin_comida": sin_comida,
                "turnos": turnos,
                "pax_total": ocupacion,
                "tematica_id": f.tematica_id,
                "tematica_nombre": f.tematica.nombre if f.tematica else None,
                "es_privado": f.es_privado,
                "empresa_privada_id": f.empresa_privada_id,
                "empresa_privada_nombre": f.empresa_privada.nombre if f.empresa_privada else None,
                "empresa_privada": f.empresa_privada.nombre if f.empresa_privada else None
            }
        })

    # =====================================================
    # RESUMEN GRUPOS POR DIA (CON / SIN / MIX ALCOHOL)
    # =====================================================
    resumen_discos = defaultdict(lambda: {
        "con": {"total": 0},
        "sin": {"total": 0},
        "mix": {"total": 0}
    })

    for empresa in empresas:
        for grupo in empresa.grupos:
            es_mix_g = getattr(grupo, 'es_mix_grupo', False)
            if es_mix_g:
                bucket = "mix"
            elif grupo.permite_alcohol:
                bucket = "con"
            else:
                bucket = "sin"
            estudiantes = grupo.cantidad_estudiantes or 0
            padres = grupo.cantidad_padres or 0
            guias = grupo.cantidad_guias or 0
            total = estudiantes + padres + guias

            current_date = grupo.fecha_entrada
            while current_date < grupo.fecha_salida:
                resumen_discos[current_date][bucket]["total"] += total
                current_date = current_date + timedelta(days=1)

    for fecha, totales in resumen_discos.items():
        if not (totales["con"]["total"] or totales["sin"]["total"] or totales["mix"]["total"]):
            continue

        con = totales["con"]
        sin = totales["sin"]
        mix = totales["mix"]

        titulo = (
            "Resumen grupos\n"
            f"TOTAL C/A: {con['total']}\n"
            f"TOTAL S/A: {sin['total']}\n"
            f"TOTAL MIX: {mix['total']}"
        )

        events.append({
            "id": f"resumen-disco-{fecha}",
            "resourceId": "eventos",
            "start": fecha,
            "end": fecha + timedelta(days=1),
            "title": titulo,
            "backgroundColor": "#f8fafc",
            "textColor": "#0f172a",
            "borderColor": "#e2e8f0",
            "extendedProps": {
                "tipo": "resumen_servicios",
                "resumen_tipo": "grupos"
            }
        })

    # =====================================================
    # GRUPOS (LOGICA SPLIT)
    # =====================================================
    for e in empresas:
        for g in e.grupos:

            # info extra para tooltip
            alcohol_txt = "MIX (pulsera)" if getattr(g, 'es_mix_grupo', False) else ("SI" if g.permite_alcohol else "NO")
            
            # Campamento Logic
            if getattr(g, 'campamento_acceso', False):
                campamento_txt = "SI (Con Comida)" if getattr(g, 'campamento_con_comida', False) else "SI (Sin Comida)"
            else:
                campamento_txt = "NO"

            # Zacarias Logic
            if getattr(g, 'zacarias_acceso', False):
                zacarias_txt = "SI (Con Comida)" if getattr(g, 'zacarias_con_comida', False) else "SI (Sin Comida)"
            else:
                zacarias_txt = "NO"

            # Pool Logic
            if g.pool_acceso:
                pool_txt = "SI (Con Comida)" if g.pool_con_comida else "SI (Sin Comida)"
            else:
                pool_txt = "NO"

            tooltip = (
                f"Empresa: {e.nombre}\n"
                f"Grupo: {g.nombre}\n"
                f"PAX: {g.cantidad_pax}\n"
                f"Entrada: {g.fecha_entrada}\n"
                f"Salida: {g.fecha_salida}\n"
                f"Discos Compradas: {g.discos_compradas}\n"
                f"----------------\n"
                f"Alcohol: {alcohol_txt}\n"
                f"Campamento: {campamento_txt}\n"
                f"Zacarias: {zacarias_txt}\n"
                f"Pool: {pool_txt}\n"
                f"Cena de Velas: {'SI' if getattr(g, 'cena_velas', False) else 'NO'}\n"
                f"Bar de hielo: {'SI' if g.bar_hielo else 'NO'}\n"
                f"Surf: {'SI' if getattr(g, 'surf_acceso', False) else 'NO'}\n"
                f"Unipraias: {'SI' if getattr(g, 'unipraias_acceso', False) else 'NO'}\n"
                f"Beto Carrero: {'SI' if getattr(g, 'beto_acceso', False) else 'NO'}\n"
                f"Barco Pirata: {'SI' if getattr(g, 'barco_acceso', False) else 'NO'}\n"
                f"Cristo Luz: {'SI' if getattr(g, 'cristo_acceso', False) else 'NO'}\n"
                f"Sunset: {'SI' if getattr(g, 'sunset_acceso', False) else 'NO'}\n"
                f"Multiparque: {'SI' if getattr(g, 'multiparque_acceso', False) else 'NO'}"
            )

            # Color del grupo según tipo de alcohol
            es_mix_g = getattr(g, 'es_mix_grupo', False)
            if es_mix_g:
                bg_color_grupo = "#f97316"  # Naranja Mix
                text_color_grupo = "white"
            elif g.permite_alcohol:
                bg_color_grupo = "#ef4444"  # Rojo Con Alcohol
                text_color_grupo = "white"
            else:
                bg_color_grupo = "#FFFF00"  # Amarillo Sin Alcohol
                text_color_grupo = "black"

            # Mapa de asignaciones por fecha (lista para soportar multiples)
            mapa_asignaciones = defaultdict(list)
            for a in g.asignaciones:
                mapa_asignaciones[a.fecha_evento.fecha].append(a)

            # Iterar dia por dia
            current_date = g.fecha_entrada
            while current_date < g.fecha_salida:
                next_date = current_date + timedelta(days=1)
                
                # Check si hay asignaciones (lista)
                asignaciones_dia = mapa_asignaciones.get(current_date, [])

                if asignaciones_dia:
                    # RENDERIZAR ASIGNACIONES (Iterar sobre la lista)
                    asignaciones_hielo = [a for a in asignaciones_dia if a.fecha_evento.evento.tipo == "HIELO"]
                    otras_asignaciones = [a for a in asignaciones_dia if a.fecha_evento.evento.tipo != "HIELO"]

                    for asignacion in otras_asignaciones:
                        color_map = {
                            "DISCO": "#000000",    # Negro
                            "PARQUE": "#16a34a",   # Verde
                            "CAMPAMENTO": "#16a34a",
                            "ZACARIAS": "#15803d",
                            "BIENVENIDA": "#a855f7",
                            "POOL": "#0ea5e9",     # Azul claro
                            "CENA": "#94a3b8",     # Gris
                            "HIELO": "#e0f2fe",    # Celeste claro
                            "SURF": "#3b82f6",     # Azul
                            "UNIPRAIAS": "#10b981",# Verde esmeralda
                            "BETO": "#ec4899",     # Rosa
                            "BARCO": "#8b5cf6",    # Morado
                            "SUNSET": "#f59e0b",   # Naranja dorado
                            "CRISTO": "#fcd34d",   # Amarillo/Dorado claro
                            "MULTIPARQUE": "#22c55e" # Verde brillante
                        }
                        bg_color_asig = color_map.get(asignacion.fecha_evento.evento.tipo, "gray")
                        text_color_asig = "black" if bg_color_asig in ["#e0f2fe", "#f59e0b", "#fcd34d"] else "white"

                        events.append({
                            "resourceId": g.id, # ID del Grupo ahora es la fila
                            "start": current_date,
                            "end": next_date,
                            "title": asignacion.fecha_evento.evento.nombre,
                            "backgroundColor": bg_color_asig,
                            "borderColor": "transparent",
                            "textColor": text_color_asig,
                            "extendedProps": {
                                "tipo": "asignacion",
                                "grupo_id": g.id,
                                "fecha": current_date,
                                "asignacion_id": asignacion.id,
                                "nombre_evento": asignacion.fecha_evento.evento.nombre,
                                "evento_id_num": asignacion.fecha_evento.evento.id,
                                "empresa_nombre": e.nombre,
                                "tooltip": f"Asignado: {asignacion.fecha_evento.evento.nombre}"
                            }
                        })

                    if asignaciones_hielo:
                        color_map = {
                            "HIELO": "#e0f2fe"
                        }
                        bg_color_asig = color_map.get("HIELO", "gray")
                        text_color_asig = "black"
                        turnos = len(asignaciones_hielo)
                        nombre_base = asignaciones_hielo[0].fecha_evento.evento.nombre
                        titulo = f"{nombre_base} {turnos} TURNOS" if turnos > 1 else nombre_base
                        events.append({
                            "resourceId": g.id,
                            "start": current_date,
                            "end": next_date,
                            "title": titulo,
                            "backgroundColor": bg_color_asig,
                            "borderColor": "transparent",
                            "textColor": text_color_asig,
                            "extendedProps": {
                                "tipo": "asignacion_hielo_resumen",
                                "grupo_id": g.id,
                                "fecha": current_date,
                                "turnos": turnos,
                                "empresa_nombre": e.nombre,
                                "tooltip": f"{nombre_base}: {turnos} TURNOS"
                            }
                        })

                else:
                    # RENDERIZAR FRAGMENTO DE GRUPO (Solo si no hay NINGUNA asignacion)
                    # OJO: Si queremos que se vea el fondo del grupo SIEMPRE detras, 
                    # FullCalendar lo superpondria.
                    # La logica original era: O asignacion O grupo.
                    # Ahora: Si hay asignaciones, mostramos las asignaciones.
                    # Si NO hay asignaciones, mostramos el placeholder del grupo.
                    # (Si quisieramos ver ambos, deberiamos usar background events o similar, 
                    # pero por ahora mantenemos la logica de "slot ocupado visualmente")
                    
                    events.append({
                        "resourceId": g.id, # ID del Grupo
                        "start": current_date,
                        "end": next_date,
                        "title": g.nombre,
                        "backgroundColor": bg_color_grupo,
                        "borderColor": bg_color_grupo,
                        "textColor": text_color_grupo,
                        "extendedProps": {
                            "tipo": "grupo",
                            "grupo_id": g.id,
                            "empresa_nombre": e.nombre,
                            "tooltip": tooltip
                        }
                    })

                current_date = next_date

    return {"resources": resources, "events": events}


# =========================================================
# GET CALENDARIO PORTAL (READ ONLY - FILTRADO)
# =========================================================
@router.get("/portal/{codigo_acceso}")
def calendario_portal(codigo_acceso: str, db: Session = Depends(get_db)):

    codigo_normalizado = codigo_acceso.strip().lower()
    empresa = db.query(models.Empresa).filter(
        func.lower(models.Empresa.codigo_acceso) == codigo_normalizado
    ).first()
    if not empresa:
        raise HTTPException(404, "Código de acceso inválido")

    resources = []
    events = []

    # Fila superior para servicios/eventos globales
    resources.append({
        "id": "eventos",
        "title": "Servicios",
        "order": 0,
    })

    # Empresa
    resources.append({
        "id": f"empresa-{empresa.id}",
        "title": empresa.nombre,
        "order": 1,
        "extendedProps": {
            "empresaNombre": empresa.nombre,
            "empresaId": empresa.id,
            "esEmpresa": True
        }
    })

    # Grupos
    order_counter = 2
    for g in empresa.grupos:
        resources.append({
            "id": g.id,
            "parentId": f"empresa-{empresa.id}",
            "title": g.nombre,
            "order": order_counter,
            "extendedProps": {
                "empresaNombre": empresa.nombre,
                "empresaId": empresa.id,
                "grupoNombre": g.nombre,
                "pax": g.cantidad_pax,
                "fechaEntrada": g.fecha_entrada,
                "fechaSalida": g.fecha_salida,
                "permite_alcohol": g.permite_alcohol,
                "es_mix_grupo": getattr(g, 'es_mix_grupo', False),
            }
        })
        order_counter += 1

    # 2. EVENTS
    
    # Recolectar ID de fechas de evento donde esta empresa tiene asignación
    # para filtrar la fila global.
    fechas_eventos_asignados_ids = set()

    from collections import defaultdict

    for g in empresa.grupos:
        # --- RENDERIZAR GRUPO (Background) y ASIGNACIONES ---
        
        alcohol_txt = "MIX (pulsera)" if getattr(g, 'es_mix_grupo', False) else ("SI" if g.permite_alcohol else "NO")
        
        # Campamento Logic
        if getattr(g, 'campamento_acceso', False):
            campamento_txt = "SI (Con Comida)" if getattr(g, 'campamento_con_comida', False) else "SI (Sin Comida)"
        else:
            campamento_txt = "NO"

        # Zacarias Logic
        if getattr(g, 'zacarias_acceso', False):
            zacarias_txt = "SI (Con Comida)" if getattr(g, 'zacarias_con_comida', False) else "SI (Sin Comida)"
        else:
            zacarias_txt = "NO"

        # Pool Logic
        if g.pool_acceso:
            pool_txt = "SI (Con Comida)" if g.pool_con_comida else "SI (Sin Comida)"
        else:
            pool_txt = "NO"

        tooltip = (
            f"Empresa: {empresa.nombre}\n"
            f"Grupo: {g.nombre}\n"
            f"PAX: {g.cantidad_pax}\n"
            f"Entrada: {g.fecha_entrada}\n"
            f"Salida: {g.fecha_salida}\n"
            f"Discos Compradas: {g.discos_compradas}\n"
            f"----------------\n"
            f"Alcohol: {alcohol_txt}\n"
            f"Campamento: {campamento_txt}\n"
            f"Zacarias: {zacarias_txt}\n"
            f"Pool: {pool_txt}\n"
            f"Cena de Velas: {'SI' if getattr(g, 'cena_velas', False) else 'NO'}\n"
            f"Bar de hielo: {'SI' if g.bar_hielo else 'NO'}\n"
            f"Surf: {'SI' if getattr(g, 'surf_acceso', False) else 'NO'}\n"
            f"Unipraias: {'SI' if getattr(g, 'unipraias_acceso', False) else 'NO'}\n"
            f"Beto Carrero: {'SI' if getattr(g, 'beto_acceso', False) else 'NO'}\n"
            f"Barco Pirata: {'SI' if getattr(g, 'barco_acceso', False) else 'NO'}\n"
            f"Cristo Luz: {'SI' if getattr(g, 'cristo_acceso', False) else 'NO'}\n"
            f"Sunset: {'SI' if getattr(g, 'sunset_acceso', False) else 'NO'}\n"
            f"Multiparque: {'SI' if getattr(g, 'multiparque_acceso', False) else 'NO'}"
        )

        # Color del grupo según tipo de alcohol
        es_mix_g = getattr(g, 'es_mix_grupo', False)
        if es_mix_g:
            bg_color_grupo = "#f97316"  # Naranja Mix
            text_color_grupo = "white"
        elif g.permite_alcohol:
            bg_color_grupo = "#ef4444"  # Rojo Con Alcohol
            text_color_grupo = "white"
        else:
            bg_color_grupo = "#FFFF00"  # Amarillo Sin Alcohol
            text_color_grupo = "black"

        mapa_asignaciones = defaultdict(list)
        for a in g.asignaciones:
            mapa_asignaciones[a.fecha_evento.fecha].append(a)
            fechas_eventos_asignados_ids.add(a.fecha_evento.id) # Guardar para filtro global

        current_date = g.fecha_entrada
        while current_date < g.fecha_salida:
            next_date = current_date + timedelta(days=1)
            
            asignaciones_dia = mapa_asignaciones.get(current_date, [])


            if asignaciones_dia:
                asignaciones_hielo = [a for a in asignaciones_dia if a.fecha_evento.evento.tipo == "HIELO"]
                otras_asignaciones = [a for a in asignaciones_dia if a.fecha_evento.evento.tipo != "HIELO"]

                for asignacion in otras_asignaciones:
                    color_map = {"DISCO": "#000000", "PARQUE": "#16a34a", "CAMPAMENTO": "#16a34a", "ZACARIAS": "#15803d", "BIENVENIDA": "#a855f7", "POOL": "#0ea5e9", "CENA": "#94a3b8", "HIELO": "#e0f2fe", "SURF": "#3b82f6", "UNIPRAIAS": "#10b981", "BETO": "#ec4899", "BARCO": "#8b5cf6", "SUNSET": "#f59e0b", "CRISTO": "#fcd34d", "MULTIPARQUE": "#22c55e"}
                    bg_color_asig = color_map.get(asignacion.fecha_evento.evento.tipo, "gray")
                    text_color_asig = "black" if bg_color_asig in ["#e0f2fe", "#f59e0b", "#fcd34d"] else "white"

                    events.append({
                        "resourceId": g.id, 
                        "start": current_date,
                        "end": next_date,
                        "title": asignacion.fecha_evento.evento.nombre,
                        "backgroundColor": bg_color_asig,
                        "borderColor": "transparent",
                        "textColor": text_color_asig,
                        # Sin extendedProps complejas porque es read-only, pero dejamos tipo
                        "extendedProps": {
                            "tipo": "asignacion",
                            "tooltip": f"Asignado: {asignacion.fecha_evento.evento.nombre}" # Tooltip en asignacion tambien
                        } 
                    })
                if asignaciones_hielo:
                    color_map = {"HIELO": "#e0f2fe"}
                    bg_color_asig = color_map.get("HIELO", "gray")
                    text_color_asig = "black"
                    turnos = len(asignaciones_hielo)
                    nombre_base = asignaciones_hielo[0].fecha_evento.evento.nombre
                    titulo = f"{nombre_base} {turnos} TURNOS" if turnos > 1 else nombre_base

                    events.append({
                        "resourceId": g.id,
                        "start": current_date,
                        "end": next_date,
                        "title": titulo,
                        "backgroundColor": bg_color_asig,
                        "borderColor": "transparent",
                        "textColor": text_color_asig,
                        "extendedProps": {
                            "tipo": "asignacion",
                            "tooltip": f"{nombre_base}: {turnos} TURNOS"
                        }
                    })
            else:
                events.append({
                    "resourceId": g.id,
                    "start": current_date,
                    "end": next_date,
                    "title": g.nombre,
                    "backgroundColor": bg_color_grupo,
                    "borderColor": bg_color_grupo,
                    "textColor": text_color_grupo,
                    "extendedProps": {"tipo": "grupo", "tooltip": tooltip}
                })

            current_date = next_date

    # 3. GLOBAL ROW (Solo lo asignado)
    # Buscamos esas FechaEvento especificamente
    if fecha_eventos_asignados_ids := list(fechas_eventos_asignados_ids):
        fechas_globales = db.query(models.FechaEvento).filter(models.FechaEvento.id.in_(fecha_eventos_asignados_ids)).all()
        
        for f in fechas_globales:
            color_map = {"DISCO": "yellow", "PARQUE": "green", "CAMPAMENTO": "#16a34a", "ZACARIAS": "#15803d", "BIENVENIDA": "#a855f7", "POOL": "skyblue", "CENA": "#e2e8f0", "HIELO": "#e0f2fe", "SURF": "#3b82f6", "UNIPRAIAS": "#10b981", "BETO": "#ec4899", "BARCO": "#8b5cf6", "SUNSET": "#f59e0b", "CRISTO": "#fcd34d", "MULTIPARQUE": "#22c55e"}
            es_mix = getattr(f, 'es_mix_evento', False)
            if es_mix:
                color = "#f97316"  # Naranja Mix
            elif f.con_alcohol:
                color = "red"
            else:
                color = color_map.get(f.evento.tipo, "gray")
            text_color = "black" if color in ("yellow", "#e2e8f0", "#e0f2fe", "#f59e0b", "#fcd34d", "#f97316") else "white"
            if f.es_privado:
                color = "#ede9fe"
                text_color = "#4c1d95"

            # Opcional: Ocultar ocupacion real total? 
            # El usuario dijo: "vean solo su programación... con el nombre y todo"
            # No especificó si deben ver la ocupación global o no.
            # Por simplicidad y privacidad, mostraremos el nombre del evento.
            
            # Calcular ocupación solo para esta empresa
            pax_empresa = 0
            turnos_empresa = 0
            if f.evento.tipo == "HIELO":
                turnos_empresa = sum(1 for a in f.asignaciones if a.grupo and a.grupo.empresa_id == empresa.id)
                for a in f.asignaciones:
                    if a.grupo and a.grupo.empresa_id == empresa.id:
                        if a.pax_asignados is not None:
                            pax_empresa += a.pax_asignados
                        else:
                            pax_empresa += a.grupo.cantidad_pax
                titulo_portal = f"{f.evento.nombre} ({pax_empresa} PAX - {turnos_empresa} Turnos)"
            else:
                pax_empresa = sum(a.grupo.cantidad_pax for a in f.asignaciones if a.grupo and a.grupo.empresa_id == empresa.id)
                titulo_portal = f"{f.evento.nombre} ({pax_empresa} PAX)"

            if getattr(f, "horario", None):
                titulo_portal += f" - {f.horario}"

            if f.tematica:
                titulo_portal += f"\n{f.tematica.nombre}"
            
            titulo_extra = ""
            if f.es_privado and f.empresa_privada:
                titulo_extra = f"\nPrivado: {f.empresa_privada.nombre}"

            events.append({
                "id": f"id-{f.id}",
                "resourceId": "eventos",
                "start": f.fecha,
                "end": f.fecha + timedelta(days=1),
                "title": titulo_portal + titulo_extra, 
                "backgroundColor": color,
                "textColor": text_color,
                "extendedProps": {"tipo": "global_readonly"}
            })

    return {"resources": resources, "events": events}


# =========================================================
# ASIGNAR EVENTO A GRUPO
# =========================================================
@router.post("/grupo/{grupo_id}/asignar")
def asignar_evento(grupo_id: int, body: AsignarEventoBody, db: Session = Depends(get_db)):

    fecha = body.fecha
    evento_id = body.evento_id

    grupo_obj = db.get(models.Grupo, grupo_id)
    if not grupo_obj:
        raise HTTPException(404, "Grupo no encontrado")
    grupo = cast(Any, grupo_obj)

    if not (grupo.fecha_entrada <= fecha < grupo.fecha_salida):
        raise HTTPException(400, "Fuera de estadía")

    # Obtener evento a asignar
    if body.fecha_evento_id:
        nuevo_evento_fecha = db.get(models.FechaEvento, body.fecha_evento_id)
    else:
        nuevo_evento_fecha = db.query(models.FechaEvento) \
            .filter_by(evento_id=evento_id, fecha=fecha).first()
            
    if not nuevo_evento_fecha:
        raise HTTPException(400, "No existe evento ese día")

    if nuevo_evento_fecha.es_privado:
        if not nuevo_evento_fecha.empresa_privada_id:
            raise HTTPException(400, "Este evento privado no tiene empresa asociada")
        if grupo.empresa_id != nuevo_evento_fecha.empresa_privada_id:
            raise HTTPException(400, "Evento privado reservado para otra empresa")

    tipo_nuevo = nuevo_evento_fecha.evento.tipo

    # Validacion Alcohol (Solo para DISCOS)
    if tipo_nuevo == "DISCO":
        es_mix_evento = getattr(nuevo_evento_fecha, 'es_mix_evento', False)
        es_mix_grupo = getattr(grupo, 'es_mix_grupo', False)

        if es_mix_evento:
            # Evento MIX: acepta tanto grupos con como sin alcohol, y también grupos mix
            pass  # Sin restricción de alcohol
        elif nuevo_evento_fecha.con_alcohol:
            # Evento CON ALCOHOL: solo acepta grupos con alcohol o mix
            if not grupo.permite_alcohol and not es_mix_grupo:
                raise HTTPException(400, "El grupo no admite eventos con alcohol")
        else:
            # Evento SIN ALCOHOL: solo acepta grupos sin alcohol o mix
            if grupo.permite_alcohol and not es_mix_grupo:
                raise HTTPException(400, "El grupo con alcohol debe asistir a eventos con alcohol")
            
        # NUEVA VALIDACION: Capacidad de compras DISCO
        # Contar cuantas asignaciones de tipo DISCO tiene ya el grupo
        discos_asignadas_count = db.query(models.Asignacion)\
            .join(models.FechaEvento)\
            .join(models.Evento)\
            .filter(models.Asignacion.grupo_id == grupo_id)\
            .filter(models.Evento.tipo == "DISCO")\
            .count()

            
        if discos_asignadas_count >= grupo.discos_compradas:
             raise HTTPException(400, f"El grupo ya agotó sus {grupo.discos_compradas} discos compradas")


    # Validacion PARQUE
    if tipo_nuevo == "PARQUE" and not grupo.parque_acceso:
        raise HTTPException(400, "El grupo no tiene acceso a PARQUE")

    # Validacion CENA DE VELAS
    if tipo_nuevo == "CENA" and not getattr(grupo, "cena_velas", False):
        raise HTTPException(400, "El grupo no tiene Cena de Velas")

    # Validacion CAMPAMENTO
    if tipo_nuevo == "CAMPAMENTO" and not getattr(grupo, "campamento_acceso", False):
        raise HTTPException(400, "El grupo no tiene acceso a CAMPAMENTO AMERICANO")

    # Validacion ZACARIAS
    if tipo_nuevo == "ZACARIAS" and not getattr(grupo, "zacarias_acceso", False):
        raise HTTPException(400, "El grupo no tiene acceso a ZACARIAS")

    # Validacion POOL
    if tipo_nuevo == "POOL" and not grupo.pool_acceso:
        raise HTTPException(400, "El grupo no tiene acceso a POOL")

    # Validacion Nuevos Eventos
    if tipo_nuevo == "SURF" and not getattr(grupo, "surf_acceso", False):
        raise HTTPException(400, "El grupo no tiene acceso a SURF")
    if tipo_nuevo == "UNIPRAIAS" and not getattr(grupo, "unipraias_acceso", False):
        raise HTTPException(400, "El grupo no tiene acceso a PARQUE UNIPRAIAS")
    if tipo_nuevo == "BETO" and not getattr(grupo, "beto_acceso", False):
        raise HTTPException(400, "El grupo no tiene acceso a BETO CARRERO")
    if tipo_nuevo == "BARCO" and not getattr(grupo, "barco_acceso", False):
        raise HTTPException(400, "El grupo no tiene acceso a BARCO PIRATA")
    if tipo_nuevo == "CRISTO" and not getattr(grupo, "cristo_acceso", False):
        raise HTTPException(400, "El grupo no tiene acceso a CRISTO LUZ")
    if tipo_nuevo == "SUNSET" and not getattr(grupo, "sunset_acceso", False):
        raise HTTPException(400, "El grupo no tiene acceso a SUNSET")
    if tipo_nuevo == "MULTIPARQUE" and not getattr(grupo, "multiparque_acceso", False):
        raise HTTPException(400, "El grupo no tiene acceso a MULTIPARQUE")

    # Validacion BAR DE HIELO
    if tipo_nuevo == "HIELO":
        if not grupo.bar_hielo:
            raise HTTPException(400, "El grupo no tiene Bar de Hielo")

        existentes_hielo = db.query(models.Asignacion) \
            .join(models.FechaEvento) \
            .join(models.Evento) \
            .filter(models.Asignacion.grupo_id == grupo_id) \
            .filter(models.FechaEvento.fecha == fecha) \
            .filter(models.Evento.tipo == "HIELO") \
            .count()

        if existentes_hielo > 0:
            raise HTTPException(400, "El grupo ya tiene Bar de Hielo asignado ese día")

        capacidad_turno = nuevo_evento_fecha.evento.capacidad_maxima or 90
        pax_total = grupo.cantidad_pax or 0
        if pax_total <= 0:
            raise HTTPException(400, "El grupo no tiene PAX cargados")

        turnos = math.ceil(pax_total / capacidad_turno)
        restante = pax_total
        asignaciones = []
        for _ in range(turnos):
            pax_turno = min(capacidad_turno, restante)
            restante -= pax_turno
            asignaciones.append(models.Asignacion(
                grupo_id=grupo_id,
                fecha_evento_id=nuevo_evento_fecha.id,
                pax_asignados=pax_turno
            ))

        db.add_all(asignaciones)
        db.commit()
        return {"ok": True, "turnos": turnos}


    # Buscar asignaciones existente en el mismo día
    asignaciones_existentes = db.query(models.Asignacion) \
        .join(models.FechaEvento) \
        .filter(
            models.Asignacion.grupo_id == grupo_id,
            models.FechaEvento.fecha == fecha
        ).all()

    # Validar lógica: NO dos discos el mismo día
    for asig in asignaciones_existentes:
        tipo_existente = asig.fecha_evento.evento.tipo
        
        if tipo_nuevo == "DISCO" and tipo_existente == "DISCO":
            raise HTTPException(400, "El grupo ya tiene una DISCO asignada ese día")

    # Si pasa validación, crear
    asignacion = models.Asignacion(
        grupo_id=grupo_id,
        fecha_evento_id=nuevo_evento_fecha.id
    )

    db.add(asignacion)
    db.commit()

    return {"ok": True}


# =========================================================
# ELIMINAR ASIGNACION DE GRUPO
# =========================================================
@router.delete("/grupo/{grupo_id}/asignar")
def eliminar_asignacion(grupo_id: int, body: AsignarEventoBody, db: Session = Depends(get_db)):
    # Nota: Usamos body para recibir fecha y evento, o podriamos recibir solo fecha.
    
    fecha = body.fecha
    evento_id = body.evento_id

    # Buscar la fecha_evento especifica
    fecha_evt = db.query(models.FechaEvento).filter_by(evento_id=evento_id, fecha=fecha).first()
    if not fecha_evt:
         raise HTTPException(404, "Evento no encontrado en esa fecha")

    asignacion = db.query(models.Asignacion).filter_by(
        grupo_id=grupo_id,
        fecha_evento_id=fecha_evt.id
    ).first()

    if not asignacion:
        raise HTTPException(404, "Asignación no encontrada")

    db.delete(asignacion)
    db.commit()

    return {"ok": True}


# =========================================================
# EDITAR FECHA EVENTO GLOBAL
# =========================================================
@router.put("/fecha/{fecha_evento_id}")
def editar_fecha_evento(fecha_evento_id: int, body: EditarFechaEventoBody, db: Session = Depends(get_db)):
    f_obj = db.get(models.FechaEvento, fecha_evento_id)
    if not f_obj:
        raise HTTPException(404, "FechaEvento no encontrada")
    f = cast(Any, f_obj)

    # Actualizar campos
    antiguo_con_alcohol = f.con_alcohol
    antiguo_es_mix = getattr(f, 'es_mix_evento', False)
    setattr(f, "evento_id", body.evento_id)
    if body.fecha_nueva:
        setattr(f, "fecha", body.fecha_nueva)
    setattr(f, "con_alcohol", body.con_alcohol)
    setattr(f, "es_mix_evento", body.es_mix_evento)
    setattr(f, "tematica_id", body.tematica_id)
    setattr(f, "horario", body.horario)

    # Solo cambiar es_privado/empresa_privada_id si hay un cambio real
    # NO borrar asignaciones al marcar como privado
    if body.es_privado:
        if not body.empresa_privada_id:
            raise HTTPException(400, "Selecciona una empresa para eventos privados")
        empresa = db.get(models.Empresa, body.empresa_privada_id)
        if not empresa:
            raise HTTPException(400, "Empresa no válida")
        setattr(f, "es_privado", True)
        setattr(f, "empresa_privada_id", body.empresa_privada_id)
    else:
        # Si se está quitando lo privado, verificar que no haya grupos de otras empresas
        if f.es_privado and f.empresa_privada_id:
            for asig in f.asignaciones:
                if asig.grupo and asig.grupo.empresa_id != f.empresa_privada_id:
                    raise HTTPException(400, "Hay grupos de otra empresa asignados. Eliminá esas asignaciones antes de quitar lo privado.")
        setattr(f, "es_privado", False)
        setattr(f, "empresa_privada_id", None)

    # Lógica: Si cambia el estado de alcohol, quitar grupos incompatibles
    nuevo_es_mix = getattr(f, 'es_mix_evento', False)
    estado_cambio = (f.con_alcohol != antiguo_con_alcohol) or (nuevo_es_mix != antiguo_es_mix)
    if estado_cambio:
        for asig in f.asignaciones:
            es_mix_g = getattr(asig.grupo, 'es_mix_grupo', False)
            if nuevo_es_mix:
                # Ahora es MIX → acepta todos, no quitar nadie
                pass
            elif f.con_alcohol:
                # Ahora es CON ALCOHOL → quitar grupos que NO admiten alcohol y no son mix
                if not asig.grupo.permite_alcohol and not es_mix_g:
                    db.delete(asig)
            else:
                # Ahora es SIN ALCOHOL → quitar grupos que SÍ tienen alcohol y no son mix
                if asig.grupo.permite_alcohol and not es_mix_g:
                    db.delete(asig)

    db.commit()
    return {"ok": True}



# =========================================================
@router.delete("/fecha/{fecha_evento_id}")
def eliminar_fecha_evento_global(fecha_evento_id: int, db: Session = Depends(get_db)):
    f = db.get(models.FechaEvento, fecha_evento_id)
    if not f:
        raise HTTPException(404, "FechaEvento no encontrada")

    # Borrar vouchers y asignaciones asociadas primero (Cascade manual por seguridad)
    asignaciones_ids = [a.id for a in db.query(models.Asignacion.id).filter_by(fecha_evento_id=f.id).all()]
    if asignaciones_ids:
        db.query(models.Voucher).filter(models.Voucher.asignacion_id.in_(asignaciones_ids)).delete(synchronize_session=False)
        db.query(models.Asignacion).filter(models.Asignacion.id.in_(asignaciones_ids)).delete(synchronize_session=False)

    db.delete(f)
    db.commit()

    return {"ok": True}
