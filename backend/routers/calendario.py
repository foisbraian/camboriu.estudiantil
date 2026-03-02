from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
from datetime import timedelta, date
from pydantic import BaseModel

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
    tematica_id: int = None


# =========================================================
# GET CALENDARIO
# =========================================================
@router.get("/")
def calendario(db: Session = Depends(get_db)):

    resources = []
    events = []

    empresas = db.query(models.Empresa).all()

    # fila superior
    resources.append({
        "id": "eventos",
        "title": "Eventos",
        "order": 0
    })

    # empresas (COMO CARPETAS/PADRES)
    for i, e in enumerate(empresas, 1):
        resources.append({
            "id": f"empresa-{e.id}", # ID unico para empresa
            "title": e.nombre,
            "order": i,
            # "children": [] # FullCalendar puede usar children o parentId. Usaremos parentId en los hijos.
        })

        # GRUPOS (HIJOS)
        for g in e.grupos:
            resources.append({
                "id": g.id, # El ID del recurso es el ID del GRUPO (int)
                "parentId": f"empresa-{e.id}",
                "title": g.nombre,
                # "eventColor": ... opcional
            })

    # =====================================================
    # EVENTOS GLOBALES
    # =====================================================
    fechas = db.query(models.FechaEvento).all()

    for f in fechas:

        color_map = {
            "DISCO": "yellow",
            "PARQUE": "green",
            "POOL": "skyblue",
            "CENA": "#e2e8f0"
        }

        color = "red" if f.con_alcohol else color_map.get(f.evento.tipo, "gray")
        
        # Text Color: Black if fondo claro
        text_color = "black" if color in ("yellow", "#e2e8f0") else "white"

        # Calcular ocupación (Sumar PAX de los grupos asignados)
        ocupacion = sum(a.grupo.cantidad_pax for a in f.asignaciones if a.grupo)
        capacidad = f.evento.capacidad_maxima

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
        titulo = f"{f.evento.nombre} ({ocupacion}/{capacidad})"
        if f.tematica:
            titulo += f"\n{f.tematica.nombre}"
        
        events.append({
            "id": f"id-{f.id}",
            "resourceId": "eventos",
            "start": f.fecha,
            "end": f.fecha + timedelta(days=1),
            "title": titulo, 
            "backgroundColor": color,
            "textColor": text_color,
            "extendedProps": {
                "evento_id": f.evento_id,
                "con_alcohol": f.con_alcohol,
                "ocupacion": ocupacion,
                "capacidad": capacidad,
                "con_comida": con_comida,
                "sin_comida": sin_comida,
                "tematica_id": f.tematica_id,
                "tematica_nombre": f.tematica.nombre if f.tematica else None
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
                f"Pool: {pool_txt}"
            )

            # Color Logic
            bg_color_grupo = "#ef4444" if g.permite_alcohol else "#FFFF00" # Amarillo Puro
            text_color_grupo = "black" if not g.permite_alcohol else "white"

            # Mapa de asignaciones por fecha (lista para soportar multiples)
            from collections import defaultdict
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
                            "CENA": "#94a3b8"      # Gris
                        }
                        bg_color_asig = color_map.get(asignacion.fecha_evento.evento.tipo, "gray")

                        events.append({
                            "resourceId": g.id, # ID del Grupo ahora es la fila
                            "start": current_date,
                            "end": next_date,
                            "title": asignacion.fecha_evento.evento.nombre,
                            "backgroundColor": bg_color_asig,
                            "borderColor": "transparent",
                            "textColor": "white",
                            "extendedProps": {
                                "tipo": "asignacion",
                                "grupo_id": g.id,
                                "fecha": current_date,
                                "asignacion_id": asignacion.id,
                                "nombre_evento": asignacion.fecha_evento.evento.nombre,
                                "evento_id_num": asignacion.fecha_evento.evento.id,
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
    
    empresa = db.query(models.Empresa).filter(models.Empresa.codigo_acceso == codigo_acceso).first()
    if not empresa:
        raise HTTPException(404, "Código de acceso inválido")

    resources = []
    events = []

    # 1. RESOURCES
    # Fila superior
    resources.append({
        "id": "eventos",
        "title": "Eventos (Asignados)",
        "order": 0
    })

    # Empresa
    resources.append({
        "id": f"empresa-{empresa.id}",
        "title": empresa.nombre,
        "order": 1,
    })

    # Grupos
    for g in empresa.grupos:
        resources.append({
            "id": g.id,
            "parentId": f"empresa-{empresa.id}",
            "title": g.nombre,
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
            f"Pool: {pool_txt}"
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
                    color_map = {"DISCO": "#000000", "PARQUE": "#16a34a", "POOL": "#0ea5e9", "CENA": "#94a3b8"}
                    bg_color_asig = color_map.get(asignacion.fecha_evento.evento.tipo, "gray")

                    events.append({
                        "resourceId": g.id, 
                        "start": current_date,
                        "end": next_date,
                        "title": asignacion.fecha_evento.evento.nombre,
                        "backgroundColor": bg_color_asig,
                        "borderColor": "transparent",
                        "textColor": "white",
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
            color_map = {"DISCO": "yellow", "PARQUE": "green", "POOL": "skyblue", "CENA": "#e2e8f0"}
            color = "red" if f.con_alcohol else color_map.get(f.evento.tipo, "gray")
            text_color = "black" if color in ("yellow", "#e2e8f0") else "white"

            # Opcional: Ocultar ocupacion real total? 
            # El usuario dijo: "vean solo su programación... con el nombre y todo"
            # No especificó si deben ver la ocupación global o no.
            # Por simplicidad y privacidad, mostraremos el nombre del evento.
            
            # Título con temática si existe
            titulo_portal = f"{f.evento.nombre}"
            if f.tematica:
                titulo_portal += f"\n{f.tematica.nombre}"
            
            events.append({
                "id": f"id-{f.id}",
                "resourceId": "eventos",
                "start": f.fecha,
                "end": f.fecha + timedelta(days=1),
                "title": titulo_portal, 
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

    grupo = db.get(models.Grupo, grupo_id)

    if not (grupo.fecha_entrada <= fecha < grupo.fecha_salida):
        raise HTTPException(400, "Fuera de estadía")

    # Obtener evento a asignar
    nuevo_evento_fecha = db.query(models.FechaEvento) \
        .filter_by(evento_id=evento_id, fecha=fecha).first()

    if not nuevo_evento_fecha:
        raise HTTPException(400, "No existe evento ese día")

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
    f = db.get(models.FechaEvento, fecha_evento_id)
    if not f:
        raise HTTPException(404, "FechaEvento no encontrada")

    # Actualizar campos
    antiguo_con_alcohol = f.con_alcohol
    f.evento_id = body.evento_id
    if body.fecha_nueva:
        f.fecha = body.fecha_nueva
    f.con_alcohol = body.con_alcohol
    f.tematica_id = body.tematica_id

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
