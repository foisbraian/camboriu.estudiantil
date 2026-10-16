"""
Router de Gastos de la Empresa.

Endpoints:
  GET    /gastos                → lista con filtros opcionales
  GET    /gastos/{id}           → detalle
  POST   /gastos                → crear uno
  POST   /gastos/bulk           → cargar varios a la vez (seed / importación)
  PATCH  /gastos/{id}           → editar parcialmente
  DELETE /gastos/{id}           → eliminar
  GET    /gastos/resumen        → totales agrupados por concepto y mes
"""

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

import models
import schemas
from database import get_db

router = APIRouter(prefix="/gastos", tags=["gastos"])


# ─────────────────────────────────────────────
# LISTAR con filtros
# ─────────────────────────────────────────────
@router.get("", response_model=list[schemas.GastoOut])
def listar_gastos(
    concepto: Optional[str] = Query(None, description="Filtrar por concepto (parcial, sin case)"),
    categoria: Optional[str] = Query(None, description="Filtrar por categoría (parcial)"),
    desde: Optional[date] = Query(None, description="Fecha mínima (YYYY-MM-DD)"),
    hasta: Optional[date] = Query(None, description="Fecha máxima (YYYY-MM-DD)"),
    sin_fecha: Optional[bool] = Query(None, description="True = solo gastos sin fecha"),
    db: Session = Depends(get_db),
):
    q = db.query(models.GastoEmpresa)

    if concepto:
        q = q.filter(models.GastoEmpresa.concepto.ilike(f"%{concepto}%"))
    if categoria:
        q = q.filter(models.GastoEmpresa.categoria.ilike(f"%{categoria}%"))
    if desde:
        q = q.filter(models.GastoEmpresa.fecha >= desde)
    if hasta:
        q = q.filter(models.GastoEmpresa.fecha <= hasta)
    if sin_fecha is True:
        q = q.filter(models.GastoEmpresa.fecha.is_(None))
    elif sin_fecha is False:
        q = q.filter(models.GastoEmpresa.fecha.isnot(None))

    return q.order_by(
        models.GastoEmpresa.fecha.asc().nullsfirst(),
        models.GastoEmpresa.id.asc(),
    ).all()


# ─────────────────────────────────────────────
# RESUMEN por concepto / mes
# ─────────────────────────────────────────────
@router.get("/resumen")
def resumen_gastos(db: Session = Depends(get_db)):
    """
    Devuelve totales USD agrupados por concepto y por mes.
    Útil para el dashboard de gastos.
    """
    # Totales por concepto
    por_concepto = (
        db.query(
            models.GastoEmpresa.concepto,
            func.count(models.GastoEmpresa.id).label("cantidad"),
            func.coalesce(func.sum(models.GastoEmpresa.total_reales), 0).label("total_reales"),
            func.coalesce(func.sum(models.GastoEmpresa.total_dolares), 0).label("total_dolares"),
        )
        .group_by(models.GastoEmpresa.concepto)
        .order_by(func.sum(models.GastoEmpresa.total_dolares).desc())
        .all()
    )

    # Total general
    total_reales = db.query(
        func.coalesce(func.sum(models.GastoEmpresa.total_reales), 0)
    ).scalar()
    total_dolares = db.query(
        func.coalesce(func.sum(models.GastoEmpresa.total_dolares), 0)
    ).scalar()

    return {
        "total_reales": float(total_reales),
        "total_dolares": float(total_dolares),
        "por_concepto": [
            {
                "concepto": r.concepto,
                "cantidad": r.cantidad,
                "total_reales": float(r.total_reales),
                "total_dolares": float(r.total_dolares),
            }
            for r in por_concepto
        ],
    }


# ─────────────────────────────────────────────
# OBTENER uno
# ─────────────────────────────────────────────
@router.get("/{gasto_id}", response_model=schemas.GastoOut)
def obtener_gasto(gasto_id: int, db: Session = Depends(get_db)):
    gasto = db.get(models.GastoEmpresa, gasto_id)
    if not gasto:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    return gasto


# ─────────────────────────────────────────────
# CREAR uno
# ─────────────────────────────────────────────
@router.post("", response_model=schemas.GastoOut, status_code=201)
def crear_gasto(body: schemas.GastoCreate, db: Session = Depends(get_db)):
    gasto = models.GastoEmpresa(**body.model_dump())
    db.add(gasto)
    db.commit()
    db.refresh(gasto)
    return gasto


# ─────────────────────────────────────────────
# BULK INSERT (seed / importación masiva)
# ─────────────────────────────────────────────
@router.post("/bulk", status_code=201)
def bulk_crear_gastos(body: schemas.GastoBulkCreate, db: Session = Depends(get_db)):
    """
    Inserta múltiples gastos en una sola llamada.
    Devuelve la cantidad insertada y los ids generados.
    """
    nuevos = [models.GastoEmpresa(**g.model_dump()) for g in body.gastos]
    db.add_all(nuevos)
    db.commit()
    for n in nuevos:
        db.refresh(n)
    return {"insertados": len(nuevos), "ids": [n.id for n in nuevos]}


# ─────────────────────────────────────────────
# EDITAR parcialmente
# ─────────────────────────────────────────────
@router.patch("/{gasto_id}", response_model=schemas.GastoOut)
def editar_gasto(gasto_id: int, body: schemas.GastoUpdate, db: Session = Depends(get_db)):
    gasto = db.get(models.GastoEmpresa, gasto_id)
    if not gasto:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")

    cambios = body.model_dump(exclude_unset=True)
    for campo, valor in cambios.items():
        setattr(gasto, campo, valor)

    db.commit()
    db.refresh(gasto)
    return gasto


# ─────────────────────────────────────────────
# ELIMINAR
# ─────────────────────────────────────────────
@router.delete("/{gasto_id}", status_code=204)
def eliminar_gasto(gasto_id: int, db: Session = Depends(get_db)):
    gasto = db.get(models.GastoEmpresa, gasto_id)
    if not gasto:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    db.delete(gasto)
    db.commit()
