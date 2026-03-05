import json
import os
import tempfile
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from database import get_db
import models, schemas
from typing import List
from openpyxl import Workbook

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

def _cleanup_file(path: str):
    try:
        os.remove(path)
    except OSError:
        pass


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


@router.get("/{proveedor_id}/excel")
def exportar_planilla_proveedor(proveedor_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    p = db.get(models.Proveedor, proveedor_id)
    if not p:
        raise HTTPException(404, "Proveedor no encontrado")

    try:
        payload = json.loads(p.data or "{}")
    except json.JSONDecodeError:
        payload = {}

    headers = payload.get("headers")
    if not isinstance(headers, list):
        headers = []
    rows = payload.get("rows")
    if not isinstance(rows, list):
        rows = []

    wb = Workbook()
    ws = wb.active
    ws.title = "Planilla"

    if headers:
        ws.append([str(h) if h is not None else "" for h in headers])
    else:
        ws.append(["Columna 1"])

    for row in rows:
        if isinstance(row, list):
            ws.append([str(cell) if cell is not None else "" for cell in row])
        else:
            ws.append([str(row)])

    filename = f"planilla_{p.nombre}_{datetime.now().strftime('%Y%m%d_%H%M%S')}".replace(" ", "_")
    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        filepath = tmp.name

    wb.save(filepath)
    background_tasks.add_task(_cleanup_file, filepath)

    return FileResponse(
        filepath,
        filename=f"{filename}.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
