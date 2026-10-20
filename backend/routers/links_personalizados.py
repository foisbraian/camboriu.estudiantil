from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
import secrets
from datetime import datetime
from typing import Optional

from database import get_db
import models
import schemas

router = APIRouter(prefix="/links-personalizados", tags=["Links Personalizados"])


def serialize_link(link: models.LinkPersonalizado, db: Session) -> dict:
    servicios = [s.strip().upper() for s in (link.servicios_permitidos or "").split(",") if s.strip()]
    eventos = [int(x.strip()) for x in (link.eventos_permitidos or "").split(",") if x.strip().isdigit()] if link.eventos_permitidos else None
    grupos = [int(x.strip()) for x in (link.grupos_permitidos or "").split(",") if x.strip().isdigit()] if link.grupos_permitidos else None

    todas = False
    empresas_ids = []
    empresas_nombres = []

    if link.empresas_ids:
        if link.empresas_ids.strip() == "*":
            todas = True
            empresas_nombres = ["Todas las empresas"]
        else:
            empresas_ids = [int(x.strip()) for x in link.empresas_ids.split(",") if x.strip().isdigit()]
            if empresas_ids:
                emps = db.query(models.Empresa).filter(models.Empresa.id.in_(empresas_ids)).all()
                # Preservar orden o nombres
                map_nombres = {e.id: e.nombre for e in emps}
                empresas_nombres = [map_nombres[eid] for eid in empresas_ids if eid in map_nombres]
    elif link.empresa_id:
        empresas_ids = [link.empresa_id]
        if link.empresa:
            empresas_nombres = [link.empresa.nombre]
        else:
            emp = db.get(models.Empresa, link.empresa_id)
            if emp:
                empresas_nombres = [emp.nombre]

    if todas:
        nombre_display = "Todas las empresas"
    elif len(empresas_nombres) == 1:
        nombre_display = empresas_nombres[0]
    elif len(empresas_nombres) > 1:
        nombre_display = f"{len(empresas_nombres)} empresas ({', '.join(empresas_nombres[:2])}{'...' if len(empresas_nombres) > 2 else ''})"
    else:
        nombre_display = "Sin empresa asignada"

    return {
        "id": link.id,
        "token": link.token,
        "empresa_id": link.empresa_id,
        "empresa_nombre": nombre_display,
        "empresas_ids": empresas_ids if not todas else None,
        "todas_las_empresas": todas,
        "empresas_nombres": empresas_nombres,
        "nombre": link.nombre,
        "servicios_permitidos": servicios,
        "eventos_permitidos": eventos,
        "grupos_permitidos": grupos,
        "incluir_vouchers": bool(link.incluir_vouchers),
        "activo": bool(link.activo),
        "creado_en": link.creado_en,
    }


@router.get("/", response_model=list[schemas.LinkPersonalizadoOut])
def listar_links(
    empresa_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    links = db.query(models.LinkPersonalizado).order_by(models.LinkPersonalizado.id.desc()).all()

    if empresa_id is not None:
        resultado = []
        for l in links:
            if l.empresas_ids == "*":
                resultado.append(l)
            elif l.empresas_ids:
                ids = [int(x.strip()) for x in l.empresas_ids.split(",") if x.strip().isdigit()]
                if empresa_id in ids:
                    resultado.append(l)
            elif l.empresa_id == empresa_id:
                resultado.append(l)
        return [serialize_link(l, db) for l in resultado]

    return [serialize_link(l, db) for l in links]


@router.get("/{link_id}", response_model=schemas.LinkPersonalizadoOut)
def obtener_link(link_id: int, db: Session = Depends(get_db)):
    link = db.get(models.LinkPersonalizado, link_id)
    if not link:
        raise HTTPException(404, "Link personalizado no encontrado")
    return serialize_link(link, db)


@router.post("/", response_model=schemas.LinkPersonalizadoOut)
def crear_link(
    data: schemas.LinkPersonalizadoCreate,
    db: Session = Depends(get_db)
):
    if not data.nombre or not data.nombre.strip():
        raise HTTPException(400, "El nombre del link es obligatorio")

    servicios_limpios = [s.strip().upper() for s in data.servicios_permitidos if s.strip()]
    if not servicios_limpios:
        raise HTTPException(400, "Debe seleccionar al menos un servicio permitido")

    todas = bool(data.todas_las_empresas)
    empresa_id_principal = None
    empresas_ids_csv = None

    if todas:
        empresas_ids_csv = "*"
        primera_emp = db.query(models.Empresa).first()
        empresa_id_principal = primera_emp.id if primera_emp else None
    elif data.empresas_ids and len(data.empresas_ids) > 0:
        empresas_ids_csv = ",".join(str(e) for e in data.empresas_ids)
        empresa_id_principal = data.empresas_ids[0]
    elif data.empresa_id:
        empresas_ids_csv = str(data.empresa_id)
        empresa_id_principal = data.empresa_id
    else:
        raise HTTPException(400, "Debe seleccionar al menos una empresa o marcar 'Todas las empresas'")

    servicios_csv = ",".join(servicios_limpios)
    eventos_csv = ",".join(str(e) for e in data.eventos_permitidos) if data.eventos_permitidos else None
    grupos_csv = ",".join(str(g) for g in data.grupos_permitidos) if data.grupos_permitidos else None

    # Generar token único
    token = secrets.token_hex(6)
    while db.query(models.LinkPersonalizado).filter(models.LinkPersonalizado.token == token).first():
        token = secrets.token_hex(6)

    nuevo_link = models.LinkPersonalizado(
        token=token,
        empresa_id=empresa_id_principal,
        empresas_ids=empresas_ids_csv,
        nombre=data.nombre.strip(),
        servicios_permitidos=servicios_csv,
        eventos_permitidos=eventos_csv,
        grupos_permitidos=grupos_csv,
        incluir_vouchers=data.incluir_vouchers,
        activo=True,
        creado_en=datetime.now().isoformat(),
    )

    db.add(nuevo_link)
    db.commit()
    db.refresh(nuevo_link)

    return serialize_link(nuevo_link, db)


@router.put("/{link_id}", response_model=schemas.LinkPersonalizadoOut)
def editar_link(
    link_id: int,
    data: schemas.LinkPersonalizadoUpdate,
    db: Session = Depends(get_db)
):
    link = db.get(models.LinkPersonalizado, link_id)
    if not link:
        raise HTTPException(404, "Link personalizado no encontrado")

    if data.nombre is not None:
        if not data.nombre.strip():
            raise HTTPException(400, "El nombre no puede estar vacío")
        link.nombre = data.nombre.strip()

    if data.todas_las_empresas is not None:
        if data.todas_las_empresas:
            link.empresas_ids = "*"
        elif data.empresas_ids:
            link.empresas_ids = ",".join(str(e) for e in data.empresas_ids)
            link.empresa_id = data.empresas_ids[0]
        elif data.empresa_id:
            link.empresas_ids = str(data.empresa_id)
            link.empresa_id = data.empresa_id
    elif data.empresas_ids is not None:
        if len(data.empresas_ids) > 0:
            link.empresas_ids = ",".join(str(e) for e in data.empresas_ids)
            link.empresa_id = data.empresas_ids[0]
        else:
            raise HTTPException(400, "Debe seleccionar al menos una empresa")
    elif data.empresa_id is not None:
        link.empresa_id = data.empresa_id
        link.empresas_ids = str(data.empresa_id)

    if data.servicios_permitidos is not None:
        servicios_limpios = [s.strip().upper() for s in data.servicios_permitidos if s.strip()]
        if not servicios_limpios:
            raise HTTPException(400, "Debe seleccionar al menos un servicio permitido")
        link.servicios_permitidos = ",".join(servicios_limpios)

    if data.eventos_permitidos is not None:
        link.eventos_permitidos = ",".join(str(e) for e in data.eventos_permitidos) if data.eventos_permitidos else None

    if data.grupos_permitidos is not None:
        link.grupos_permitidos = ",".join(str(g) for g in data.grupos_permitidos) if data.grupos_permitidos else None

    if data.incluir_vouchers is not None:
        link.incluir_vouchers = data.incluir_vouchers

    if data.activo is not None:
        link.activo = data.activo

    db.commit()
    db.refresh(link)

    return serialize_link(link, db)


@router.delete("/{link_id}")
def eliminar_link(link_id: int, db: Session = Depends(get_db)):
    link = db.get(models.LinkPersonalizado, link_id)
    if not link:
        raise HTTPException(404, "Link personalizado no encontrado")

    db.delete(link)
    db.commit()
    return {"ok": True, "mensaje": "Link personalizado eliminado"}


@router.post("/{link_id}/regenerar", response_model=schemas.LinkPersonalizadoOut)
def regenerar_token(link_id: int, db: Session = Depends(get_db)):
    link = db.get(models.LinkPersonalizado, link_id)
    if not link:
        raise HTTPException(404, "Link personalizado no encontrado")

    token = secrets.token_hex(6)
    while db.query(models.LinkPersonalizado).filter(models.LinkPersonalizado.token == token).first():
        token = secrets.token_hex(6)

    link.token = token
    db.commit()
    db.refresh(link)

    return serialize_link(link, db)
