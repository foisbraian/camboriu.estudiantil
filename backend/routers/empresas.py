from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
import models
import schemas

router = APIRouter(prefix="/empresas", tags=["Empresas"])


# =====================================================
# CREAR EMPRESA
# =====================================================

@router.post("/", response_model=schemas.EmpresaOut)
def crear_empresa(data: schemas.EmpresaCreate, db: Session = Depends(get_db)):

    nombre_normalizado = data.nombre.strip().upper()

    existe = (
        db.query(models.Empresa)
        .filter(func.lower(models.Empresa.nombre) == nombre_normalizado.lower())
        .first()
    )

    if existe:
        raise HTTPException(
            status_code=400,
            detail="Ya existe una empresa con ese nombre"
        )

    empresa = models.Empresa(nombre=nombre_normalizado)

    db.add(empresa)
    db.commit()
    db.refresh(empresa)

    return empresa


# =====================================================
# LISTAR EMPRESAS (con buscador)
# /empresas?search=pan
# =====================================================

@router.get("/", response_model=list[schemas.EmpresaOut])
def listar_empresas(
    search: str | None = Query(None),
    db: Session = Depends(get_db)
):

    query = db.query(models.Empresa)

    if search:
        query = query.filter(
            func.lower(models.Empresa.nombre).contains(search.lower())
        )

    return query.order_by(models.Empresa.nombre.asc()).all()


# =====================================================
# OBTENER 1 EMPRESA
# =====================================================

@router.get("/{empresa_id}", response_model=schemas.EmpresaOut)
def obtener_empresa(empresa_id: int, db: Session = Depends(get_db)):

    empresa = db.get(models.Empresa, empresa_id)

    if not empresa:
        raise HTTPException(404, "Empresa no encontrada")

    return empresa


# =====================================================
# EDITAR EMPRESA
# =====================================================

@router.put("/{empresa_id}", response_model=schemas.EmpresaOut)
def editar_empresa(
    empresa_id: int,
    data: schemas.EmpresaCreate,
    db: Session = Depends(get_db)
):

    empresa = db.get(models.Empresa, empresa_id)

    if not empresa:
        raise HTTPException(404, "Empresa no encontrada")

    nuevo_nombre = data.nombre.strip().upper()

    existe = (
        db.query(models.Empresa)
        .filter(
            func.lower(models.Empresa.nombre) == nuevo_nombre.lower(),
            models.Empresa.id != empresa_id
        )
        .first()
    )

    if existe:
        raise HTTPException(400, "Ya existe otra empresa con ese nombre")

    empresa.nombre = nuevo_nombre

    db.commit()
    db.refresh(empresa)

    return empresa


# =====================================================
# ELIMINAR EMPRESA
# =====================================================

@router.delete("/{empresa_id}")
def eliminar_empresa(empresa_id: int, db: Session = Depends(get_db)):

    empresa = db.get(models.Empresa, empresa_id)

    if not empresa:
        raise HTTPException(404, "Empresa no encontrada")

    grupo_ids = [gid for (gid,) in db.query(models.Grupo.id).filter(models.Grupo.empresa_id == empresa_id).all()]
    if grupo_ids:
        asignacion_ids = [aid for (aid,) in db.query(models.Asignacion.id).filter(models.Asignacion.grupo_id.in_(grupo_ids)).all()]
        if asignacion_ids:
            db.query(models.Voucher).filter(models.Voucher.asignacion_id.in_(asignacion_ids)).delete(synchronize_session=False)
            db.query(models.Asignacion).filter(models.Asignacion.id.in_(asignacion_ids)).delete(synchronize_session=False)
        db.query(models.Grupo).filter(models.Grupo.id.in_(grupo_ids)).delete(synchronize_session=False)

    fecha_privada_ids = [fid for (fid,) in db.query(models.FechaEvento.id).filter(models.FechaEvento.empresa_privada_id == empresa_id).all()]
    if fecha_privada_ids:
        asignacion_privada_ids = [aid for (aid,) in db.query(models.Asignacion.id).filter(models.Asignacion.fecha_evento_id.in_(fecha_privada_ids)).all()]
        if asignacion_privada_ids:
            db.query(models.Voucher).filter(models.Voucher.asignacion_id.in_(asignacion_privada_ids)).delete(synchronize_session=False)
            db.query(models.Asignacion).filter(models.Asignacion.id.in_(asignacion_privada_ids)).delete(synchronize_session=False)
        db.query(models.FechaEvento).filter(models.FechaEvento.id.in_(fecha_privada_ids)).delete(synchronize_session=False)

    db.query(models.PagoHotel).filter(models.PagoHotel.empresa_id == empresa_id).delete(synchronize_session=False)
    db.query(models.ReservaHotel).filter(models.ReservaHotel.empresa_id == empresa_id).delete(synchronize_session=False)

    db.query(models.Pago).filter(models.Pago.empresa_id == empresa_id).delete(synchronize_session=False)
    db.query(models.FinanzasEmpresa).filter(models.FinanzasEmpresa.empresa_id == empresa_id).delete(synchronize_session=False)

    db.delete(empresa)
    db.commit()

    return {"ok": True}
