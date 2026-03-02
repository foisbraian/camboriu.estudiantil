from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models, schemas

router = APIRouter(prefix="/eventos", tags=["Eventos"])


# =====================================
# LISTAR EVENTOS (para modal)
# =====================================
@router.get("/")
def listar_eventos(db: Session = Depends(get_db)):
    return db.query(models.Evento).all()


# =====================================
# CREAR EVENTO BASE
# =====================================
@router.post("/")
def crear_evento(data: schemas.EventoCreate, db: Session = Depends(get_db)):
    e = models.Evento(**data.dict())
    db.add(e)
    db.commit()
    db.refresh(e)
    return e


# =====================================
# CREAR FECHA EVENTO GLOBAL
# =====================================
@router.post("/fecha")
def crear_fecha_evento(data: schemas.FechaEventoCreate, db: Session = Depends(get_db)):
    f = models.FechaEvento(**data.dict())
    db.add(f)
    db.commit()
    db.refresh(f)
    return f


# =====================================
# ELIMINAR FECHA EVENTO (FIX 404)
# =====================================
@router.delete("/fecha/{fecha_evento_id}")
def eliminar_fecha_evento(fecha_evento_id: int, db: Session = Depends(get_db)):
    f = db.get(models.FechaEvento, fecha_evento_id)

    if not f:
        raise HTTPException(404)

    db.delete(f)
    db.commit()

    return {"ok": True}

# =====================================
# ELIMINAR EVENTO (Definición)
# =====================================
@router.delete("/{evento_id}")
def eliminar_evento(evento_id: int, db: Session = Depends(get_db)):
    e = db.get(models.Evento, evento_id)
    if not e:
        raise HTTPException(404, "Evento no encontrado")

    # PRECAUCIÓN: Esto fallará si hay fecha_evento (fechas) asociados
    # por la ForeignKey. Deberiamos borrar las fechas primero?
    # O permitimos que falle si tiene uso.
    # Dado que es una app pequeña, mejor borramos todo (Cascade manual).
    
    # 1. Borrar asignaciones de las fechas de este evento
    # (Muy costoso si hay miles, pero ok por ahora)
    # Join con FechaEvento
    # db.query(models.Asignacion).join(models.FechaEvento).filter(models.FechaEvento.evento_id == evento_id).delete()
    
    # Simpler: Borrar Fechas (y dejar que SQLAlchemy cascade si está configurado, o hacerlo manual)
    # models.py no tiene cascade="all, delete", asi que manual.
    fechas = db.query(models.FechaEvento).filter_by(evento_id=evento_id).all()
    for f in fechas:
        asignaciones_ids = [a.id for a in db.query(models.Asignacion.id).filter_by(fecha_evento_id=f.id).all()]
        if asignaciones_ids:
            db.query(models.Voucher).filter(models.Voucher.asignacion_id.in_(asignaciones_ids)).delete(synchronize_session=False)
            db.query(models.Asignacion).filter(models.Asignacion.id.in_(asignaciones_ids)).delete(synchronize_session=False)
        db.delete(f)

    db.delete(e)
    db.commit()

    return {"ok": True}
