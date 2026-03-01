from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models, schemas
from typing import List

router = APIRouter(prefix="/proveedores", tags=["Proveedores"])

@router.get("/", response_model=List[schemas.ProveedorOut])
def listar_proveedores(db: Session = Depends(get_db)):
    return db.query(models.Proveedor).all()

@router.post("/", response_model=schemas.ProveedorOut)
def crear_proveedor(data: schemas.ProveedorCreate, db: Session = Depends(get_db)):
    p = models.Proveedor(nombre=data.nombre)
    if data.data:
        p.data = data.data
    db.add(p)
    db.commit()
    db.refresh(p)
    return p

@router.get("/{proveedor_id}", response_model=schemas.ProveedorOut)
def obtener_proveedor(proveedor_id: int, db: Session = Depends(get_db)):
    p = db.get(models.Proveedor, proveedor_id)
    if not p:
        raise HTTPException(404, "Proveedor no encontrado")
    return p

@router.put("/{proveedor_id}", response_model=schemas.ProveedorOut)
def actualizar_proveedor(proveedor_id: int, data: schemas.ProveedorCreate, db: Session = Depends(get_db)):
    p = db.get(models.Proveedor, proveedor_id)
    if not p:
        raise HTTPException(404, "Proveedor no encontrado")
    
    p.nombre = data.nombre
    if data.data:
        p.data = data.data
        
    db.commit()
    db.refresh(p)
    return p

@router.delete("/{proveedor_id}")
def eliminar_proveedor(proveedor_id: int, db: Session = Depends(get_db)):
    p = db.get(models.Proveedor, proveedor_id)
    if not p:
        raise HTTPException(404, "Proveedor no encontrado")
    
    db.delete(p)
    db.commit()
    return {"ok": True}
