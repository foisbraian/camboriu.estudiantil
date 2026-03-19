from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models, schemas
from services import validar_estadia, validar_servicio, validar_capacidad
import math
from typing import cast
from sqlalchemy import text

router = APIRouter(prefix="/asignaciones", tags=["Asignaciones"])


@router.post("/migracion-pax-asignados")
def migracion_pax_asignados(db: Session = Depends(get_db)):
    db.execute(text("ALTER TABLE asignaciones ADD COLUMN IF NOT EXISTS pax_asignados INTEGER"))
    db.commit()
    return {"ok": True}


@router.post("/")
def asignar(data: schemas.AsignacionCreate, db: Session = Depends(get_db)):

    grupo = db.get(models.Grupo, data.grupo_id)
    fecha_evento = db.get(models.FechaEvento, data.fecha_evento_id)

    if not grupo or not fecha_evento:
        raise HTTPException(404, "Grupo o fecha de evento no encontrada")

    tipo = (fecha_evento.evento.tipo or "").upper()

    try:
        validar_estadia(grupo, fecha_evento.fecha)
        validar_servicio(grupo, fecha_evento.evento)
    except Exception as e:
        raise HTTPException(400, str(e))

    if tipo == "HIELO":
        existentes = db.query(models.Asignacion) \
            .filter(models.Asignacion.grupo_id == grupo.id) \
            .filter(models.Asignacion.fecha_evento_id == fecha_evento.id) \
            .count()

        if existentes > 0:
            raise HTTPException(400, "El grupo ya tiene Bar de Hielo asignado")

        capacidad_turno = cast(int, fecha_evento.evento.capacidad_maxima or 90)
        pax_total = cast(int, grupo.cantidad_pax or 0)
        if pax_total <= 0:
            raise HTTPException(400, "El grupo no tiene PAX cargados")

        turnos = math.ceil(pax_total / capacidad_turno)
        restante = pax_total
        asignaciones = []
        for _ in range(turnos):
            pax_turno = min(capacidad_turno, restante)
            restante -= pax_turno
            try:
                validar_capacidad(db, fecha_evento, grupo, pax_turno)
            except Exception as e:
                raise HTTPException(400, str(e))
            asignaciones.append(models.Asignacion(
                grupo_id=grupo.id,
                fecha_evento_id=fecha_evento.id,
                pax_asignados=pax_turno
            ))

        db.add_all(asignaciones)
        db.commit()

        return {"ok": True, "turnos": turnos}

    try:
        validar_capacidad(db, fecha_evento, grupo)
    except Exception as e:
        raise HTTPException(400, str(e))

    a = models.Asignacion(**data.dict())
    db.add(a)
    db.commit()

    return {"ok": True}
