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
    grupo.pagantes_finales_disco = data.pagantes_finales_disco
    grupo.pagantes_finales_parque = data.pagantes_finales_parque
    grupo.pagantes_finales_pool = data.pagantes_finales_pool
    grupo.pagantes_finales_cena = data.pagantes_finales_cena
    grupo.pagantes_finales_hielo = data.pagantes_finales_hielo
    grupo.pagantes_finales_combo = data.pagantes_finales_combo

    grupo.surf_acceso = data.surf_acceso
    grupo.unipraias_acceso = data.unipraias_acceso
    grupo.beto_acceso = data.beto_acceso
    grupo.barco_acceso = data.barco_acceso
    grupo.cristo_acceso = data.cristo_acceso
    grupo.sunset_acceso = data.sunset_acceso

    grupo.pagantes_finales_surf = data.pagantes_finales_surf
    grupo.pagantes_finales_unipraias = data.pagantes_finales_unipraias
    grupo.pagantes_finales_beto = data.pagantes_finales_beto
    grupo.pagantes_finales_barco = data.pagantes_finales_barco
    grupo.pagantes_finales_cristo = data.pagantes_finales_cristo
    grupo.pagantes_finales_sunset = data.pagantes_finales_sunset

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

@router.post("/migracion-nuevos-eventos")
def migracion_nuevos_eventos(db: Session = Depends(get_db)):
    from sqlalchemy import text
    comandos = [
        "ALTER TABLE grupos ADD COLUMN surf_acceso BOOLEAN DEFAULT FALSE",
        "ALTER TABLE grupos ADD COLUMN unipraias_acceso BOOLEAN DEFAULT FALSE",
        "ALTER TABLE grupos ADD COLUMN beto_acceso BOOLEAN DEFAULT FALSE",
        "ALTER TABLE grupos ADD COLUMN barco_acceso BOOLEAN DEFAULT FALSE",
        "ALTER TABLE grupos ADD COLUMN cristo_acceso BOOLEAN DEFAULT FALSE",
        "ALTER TABLE grupos ADD COLUMN sunset_acceso BOOLEAN DEFAULT FALSE",
        "ALTER TABLE grupos ADD COLUMN pagantes_finales_surf INTEGER",
        "ALTER TABLE grupos ADD COLUMN pagantes_finales_unipraias INTEGER",
        "ALTER TABLE grupos ADD COLUMN pagantes_finales_beto INTEGER",
        "ALTER TABLE grupos ADD COLUMN pagantes_finales_barco INTEGER",
        "ALTER TABLE grupos ADD COLUMN pagantes_finales_cristo INTEGER",
        "ALTER TABLE grupos ADD COLUMN pagantes_finales_sunset INTEGER",
        "ALTER TABLE finanzas_empresa ADD COLUMN precio_surf INTEGER DEFAULT 0",
        "ALTER TABLE finanzas_empresa ADD COLUMN precio_unipraias INTEGER DEFAULT 0",
        "ALTER TABLE finanzas_empresa ADD COLUMN precio_beto INTEGER DEFAULT 0",
        "ALTER TABLE finanzas_empresa ADD COLUMN precio_barco INTEGER DEFAULT 0",
        "ALTER TABLE finanzas_empresa ADD COLUMN precio_cristo INTEGER DEFAULT 0",
        "ALTER TABLE finanzas_empresa ADD COLUMN precio_sunset INTEGER DEFAULT 0",
        "ALTER TABLE finanzas_empresa ADD COLUMN combo_surf BOOLEAN DEFAULT FALSE",
        "ALTER TABLE finanzas_empresa ADD COLUMN combo_unipraias BOOLEAN DEFAULT FALSE",
        "ALTER TABLE finanzas_empresa ADD COLUMN combo_beto BOOLEAN DEFAULT FALSE",
        "ALTER TABLE finanzas_empresa ADD COLUMN combo_barco BOOLEAN DEFAULT FALSE",
        "ALTER TABLE finanzas_empresa ADD COLUMN combo_cristo BOOLEAN DEFAULT FALSE",
        "ALTER TABLE finanzas_empresa ADD COLUMN combo_sunset BOOLEAN DEFAULT FALSE",
    ]
    for c in comandos:
        try:
            db.execute(text(c))
        except Exception as e:
            print(f"Skipping {c}: {e}")
    db.commit()
    return {"ok": True}
