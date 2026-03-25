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


# =========================================================
# SCHEMAS
# =========================================================

class AsignarEventoBody(BaseModel):
    evento_id: int
    fecha: date



class EditarFechaEventoBody(BaseModel):
    evento_id: int
    fecha_nueva: date
    con_alcohol: bool
    tematica_id: Optional[int] = None
    es_privado: bool = False
    empresa_privada_id: Optional[int] = None


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
            "POOL": "skyblue",
            "CENA": "#e2e8f0",
            "HIELO": "#e0f2fe"
        }

        color = "red" if f.con_alcohol else color_map.get(f.evento.tipo, "gray")
        
        if f.es_privado:
            color = "#ede9fe"
            text_color = "#4c1d95"
        else:
            # Text Color: Black if fondo claro
            text_color = "black" if color in ("yellow", "#e2e8f0", "#e0f2fe") else "white"
        
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
        elif f.evento.tipo == "POOL":
            con_comida = sum(a.grupo.cantidad_pax for a in f.asignaciones if a.grupo and a.grupo.pool_con_comida)
            sin_comida = sum(a.grupo.cantidad_pax for a in f.asignaciones if a.grupo and not a.grupo.pool_con_comida)

        # Título con temática si existe
        if f.evento.tipo == "HIELO":
            capacidad_turno = capacidad or 90
            titulo = f"{f.evento.nombre} (Turnos: {turnos} x {capacidad_turno})"
        else:
            titulo = f"{f.evento.nombre} ({ocupacion}/{capacidad})"
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
    # RESUMEN GRUPOS POR DIA (CON / SIN ALCOHOL)
    # =====================================================
    resumen_discos = defaultdict(lambda: {
        "con": {"total": 0},
        "sin": {"total": 0}
    })

    for empresa in empresas:
        for grupo in empresa.grupos:
            bucket = "con" if grupo.permite_alcohol else "sin"
            estudiantes = grupo.cantidad_estudiantes or 0
            padres = grupo.cantidad_padres or 0
            guias = grupo.cantidad_guias or 0
            total = estudiantes + padres + guias

            current_date = grupo.fecha_entrada
            while current_date < grupo.fecha_salida:
                resumen_discos[current_date][bucket]["total"] += total
                current_date = current_date + timedelta(days=1)

    for fecha, totales in resumen_discos.items():
        if not (totales["con"]["total"] or totales["sin"]["total"]):
            continue

        con = totales["con"]
        sin = totales["sin"]

        titulo = (
            "Resumen grupos\n"
            f"TOTAL C/A: {con['total']}\n"
            f"TOTAL S/A: {sin['total']}"
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
            alcohol_txt = "SI" if g.permite_alcohol else "NO"
            
            # Parque Logic
            if g.parque_acceso:
                parque_txt = "SI (Con Comida)" if g.parque_con_comida else "SI (Sin Comida)"
            else:
                parque_txt = "NO"

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
                f"Parque: {parque_txt}\n"
                f"Pool: {pool_txt}\n"
                f"Bar de hielo: {'SI' if g.bar_hielo else 'NO'}"
            )

            # Color Logic
            bg_color_grupo = "#ef4444" if g.permite_alcohol else "#FFFF00" # Amarillo Puro
            text_color_grupo = "black" if not g.permite_alcohol else "white"

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
                    for asignacion in asignaciones_dia:
                        color_map = {
                            "DISCO": "#000000",    # Negro
                            "PARQUE": "#16a34a",   # Verde
                            "POOL": "#0ea5e9",     # Azul claro
                            "CENA": "#94a3b8",     # Gris
                            "HIELO": "#e0f2fe"     # Celeste claro
                        }
                        bg_color_asig = color_map.get(asignacion.fecha_evento.evento.tipo, "gray")
                        text_color_asig = "black" if bg_color_asig == "#e0f2fe" else "white"

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
    for g in empresa.grupos:
        resources.append({
            "id": g.id,
            "parentId": f"empresa-{empresa.id}",
            "title": g.nombre,
            "extendedProps": {
                "empresaNombre": empresa.nombre,
                "empresaId": empresa.id,
                "grupoNombre": g.nombre,
                "pax": g.cantidad_pax,
                "fechaEntrada": g.fecha_entrada,
                "fechaSalida": g.fecha_salida,
            }
        })

    # 2. EVENTS
    
    # Recolectar ID de fechas de evento donde esta empresa tiene asignación
    # para filtrar la fila global.
    fechas_eventos_asignados_ids = set()

    from collections import defaultdict

    for g in empresa.grupos:
        # --- RENDERIZAR GRUPO (Background) y ASIGNACIONES ---
        
        alcohol_txt = "SI" if g.permite_alcohol else "NO"
        
        # Parque Logic
        if g.parque_acceso:
            parque_txt = "SI (Con Comida)" if g.parque_con_comida else "SI (Sin Comida)"
        else:
            parque_txt = "NO"

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
            f"Parque: {parque_txt}\n"
            f"Pool: {pool_txt}\n"
            f"Bar de hielo: {'SI' if g.bar_hielo else 'NO'}"
        )

        bg_color_grupo = "#ef4444" if g.permite_alcohol else "#FFFF00"
        text_color_grupo = "black" if not g.permite_alcohol else "white"

        mapa_asignaciones = defaultdict(list)
        for a in g.asignaciones:
            mapa_asignaciones[a.fecha_evento.fecha].append(a)
            fechas_eventos_asignados_ids.add(a.fecha_evento.id) # Guardar para filtro global

        current_date = g.fecha_entrada
        while current_date < g.fecha_salida:
            next_date = current_date + timedelta(days=1)
            
            asignaciones_dia = mapa_asignaciones.get(current_date, [])

            if asignaciones_dia:
                for asignacion in asignaciones_dia:
                    color_map = {"DISCO": "#000000", "PARQUE": "#16a34a", "POOL": "#0ea5e9", "CENA": "#94a3b8", "HIELO": "#e0f2fe"}
                    bg_color_asig = color_map.get(asignacion.fecha_evento.evento.tipo, "gray")
                    text_color_asig = "black" if bg_color_asig == "#e0f2fe" else "white"

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
                            "tipo": "asignacion_readonly",
                            "tooltip": f"Asignado: {asignacion.fecha_evento.evento.nombre}" # Tooltip en asignacion tambien
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
                    "extendedProps": {"tipo": "grupo_readonly", "tooltip": tooltip}
                })

            current_date = next_date

    # 3. GLOBAL ROW (Solo lo asignado)
    # Buscamos esas FechaEvento especificamente
    if fecha_eventos_asignados_ids := list(fechas_eventos_asignados_ids):
        fechas_globales = db.query(models.FechaEvento).filter(models.FechaEvento.id.in_(fecha_eventos_asignados_ids)).all()
        
        for f in fechas_globales:
            color_map = {"DISCO": "yellow", "PARQUE": "green", "POOL": "skyblue", "CENA": "#e2e8f0", "HIELO": "#e0f2fe"}
            color = "red" if f.con_alcohol else color_map.get(f.evento.tipo, "gray")
            text_color = "black" if color in ("yellow", "#e2e8f0", "#e0f2fe") else "white"
            if f.es_privado:
                color = "#ede9fe"
                text_color = "#4c1d95"

            # Opcional: Ocultar ocupacion real total? 
            # El usuario dijo: "vean solo su programación... con el nombre y todo"
            # No especificó si deben ver la ocupación global o no.
            # Por simplicidad y privacidad, mostraremos el nombre del evento.
            
            # Título con temática si existe
            titulo_portal = f"{f.evento.nombre}"
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
        if nuevo_evento_fecha.con_alcohol and not grupo.permite_alcohol:
            raise HTTPException(400, "El grupo no admite eventos con alcohol")

        if grupo.permite_alcohol and not nuevo_evento_fecha.con_alcohol:
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

    # Validacion POOL
    if tipo_nuevo == "POOL" and not grupo.pool_acceso:
        raise HTTPException(400, "El grupo no tiene acceso a POOL")

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
    setattr(f, "evento_id", body.evento_id)
    if body.fecha_nueva:
        setattr(f, "fecha", body.fecha_nueva)
    setattr(f, "con_alcohol", body.con_alcohol)
    setattr(f, "tematica_id", body.tematica_id)

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
    if f.con_alcohol != antiguo_con_alcohol:
        for asig in f.asignaciones:
            # Si ahora es CON ALCOHOL -> Quitar los que NO admiten alcohol
            if f.con_alcohol and not asig.grupo.permite_alcohol:
                db.delete(asig)
            # Si ahora es SIN ALCOHOL -> Quitar los que SÍ admiten alcohol (regla: grupo con alcohol debe ir a evento con alcohol)
            elif not f.con_alcohol and asig.grupo.permite_alcohol:
                db.delete(asig)

    db.commit()
    return {"ok": True}


# =========================================================
# ELIMINAR FECHA EVENTO GLOBAL (CASCADE)
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
