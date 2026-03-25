from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
import models, schemas

router = APIRouter(prefix="/grupos", tags=["Grupos"])


@router.post("/")
def crear_grupo(data: schemas.GrupoCreate, db: Session = Depends(get_db)):
    g = models.Grupo(**data.dict())
    db.add(g)
    db.commit()
    return g

@router.get("/empresa/{empresa_id}")
def grupos_por_empresa(empresa_id: int, db: Session = Depends(get_db)):
    return db.query(models.Grupo).filter(
        models.Grupo.empresa_id == empresa_id
    ).all()


@router.put("/{grupo_id}")
def editar_grupo(grupo_id: int, data: schemas.GrupoUpdate, db: Session = Depends(get_db)):
    grupo = db.get(models.Grupo, grupo_id)
    if not grupo:
        from fastapi import HTTPException
        raise HTTPException(404, "Grupo no encontrado")

    # Update fields
    grupo.nombre = data.nombre
    # grupo.empresa_id = data.empresa_id # No permitimos mover de empresa por ahora, o si? Mejor no tocarlo si no hace falta.
    # Pero el schema lo trae. Si el usuario lo manda distinto, podria romper.
    # Asumimos que el front manda el mismo empresa_id.
    
    grupo.cantidad_estudiantes = data.cantidad_estudiantes
    grupo.cantidad_padres = data.cantidad_padres
    grupo.cantidad_guias = data.cantidad_guias
    
    grupo.fecha_entrada = data.fecha_entrada
    grupo.fecha_salida = data.fecha_salida
    
    grupo.discos_compradas = data.discos_compradas
    grupo.permite_alcohol = data.permite_alcohol
    
    grupo.parque_acceso = data.parque_acceso
    grupo.parque_con_comida = data.parque_con_comida
    
    grupo.pool_acceso = data.pool_acceso
    grupo.pool_con_comida = data.pool_con_comida
    grupo.cena_velas = data.cena_velas
    grupo.bar_hielo = data.bar_hielo
    grupo.pagantes_finales = data.pagantes_finales

    db.commit()
    db.refresh(grupo)
    return grupo

@router.delete("/{grupo_id}")
def eliminar_grupo(grupo_id: int, db: Session = Depends(get_db)):
    grupo = db.get(models.Grupo, grupo_id)
    if not grupo:
        from fastapi import HTTPException
        raise HTTPException(404, "Grupo no encontrado")
    
    db.delete(grupo)
    db.commit()
    return {"ok": True}
