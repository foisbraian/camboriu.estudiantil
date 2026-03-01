from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
from schemas import TematicaCreate, TematicaOut

router = APIRouter(prefix="/tematicas", tags=["tematicas"])


@router.get("/", response_model=list[TematicaOut])
def listar_tematicas(db: Session = Depends(get_db)):
    return db.query(models.Tematica).all()


@router.post("/", response_model=TematicaOut)
def crear_tematica(data: TematicaCreate, db: Session = Depends(get_db)):
    # Verificar si ya existe una temática con ese nombre
    existe = db.query(models.Tematica).filter(models.Tematica.nombre == data.nombre).first()
    if existe:
        raise HTTPException(status_code=400, detail="Ya existe una temática con ese nombre")
    
    nueva = models.Tematica(nombre=data.nombre, descripcion=data.descripcion)
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva


@router.delete("/{tematica_id}")
def eliminar_tematica(tematica_id: int, db: Session = Depends(get_db)):
    tematica = db.query(models.Tematica).filter(models.Tematica.id == tematica_id).first()
    if not tematica:
        raise HTTPException(status_code=404, detail="Temática no encontrada")
    
    # Verificar si está en uso
    if tematica.fechas_evento:
        raise HTTPException(
            status_code=400, 
            detail=f"No se puede eliminar. Esta temática está asignada a {len(tematica.fechas_evento)} evento(s)"
        )
    
    db.delete(tematica)
    db.commit()
    return {"ok": True}
