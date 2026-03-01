from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models, schemas
from services import validar_estadia, validar_servicio, validar_capacidad

router = APIRouter(prefix="/asignaciones", tags=["Asignaciones"])


@router.post("/")
def asignar(data: schemas.AsignacionCreate, db: Session = Depends(get_db)):

    grupo = db.get(models.Grupo, data.grupo_id)
    fecha_evento = db.get(models.FechaEvento, data.fecha_evento_id)

    try:
        validar_estadia(grupo, fecha_evento.fecha)
        validar_servicio(grupo, fecha_evento.evento)
        validar_capacidad(db, fecha_evento, grupo)
    except Exception as e:
        raise HTTPException(400, str(e))

    a = models.Asignacion(**data.dict())
    db.add(a)
    db.commit()

    return {"ok": True}
