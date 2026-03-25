from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from database import get_db
import models, schemas
from typing import List
from datetime import date

router = APIRouter(prefix="/finanzas", tags=["Finanzas"])

# =============================
# PRICING / CONFIGURATION
# =============================

@router.get("/config/{empresa_id}", response_model=schemas.FinanzasEmpresaOut)
def get_config(empresa_id: int, db: Session = Depends(get_db)):
    config = db.query(models.FinanzasEmpresa).filter(models.FinanzasEmpresa.empresa_id == empresa_id).first()
    if not config:
        # Create default config if not exists
        config = models.FinanzasEmpresa(empresa_id=empresa_id)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config

@router.post("/config", response_model=schemas.FinanzasEmpresaOut)
def save_config(data: schemas.FinanzasEmpresaCreate, db: Session = Depends(get_db)):
    config = db.query(models.FinanzasEmpresa).filter(models.FinanzasEmpresa.empresa_id == data.empresa_id).first()
    if not config:
        config = models.FinanzasEmpresa(**data.model_dump())
        db.add(config)
    else:
        for key, value in data.model_dump().items():
            setattr(config, key, value)
    db.commit()
    db.refresh(config)
    return config

# =============================
# PAYMENTS
# =============================

@router.get("/pagos/{empresa_id}", response_model=List[schemas.PagoOut])
def get_pagos(empresa_id: int, db: Session = Depends(get_db)):
    return db.query(models.Pago).filter(models.Pago.empresa_id == empresa_id).order_by(models.Pago.fecha.desc()).all()

@router.post("/pagos", response_model=schemas.PagoOut)
def create_pago(pago: schemas.PagoCreate, db: Session = Depends(get_db)):
    nuevo_pago = models.Pago(**pago.model_dump())
    db.add(nuevo_pago)
    db.commit()
    db.refresh(nuevo_pago)
    return nuevo_pago

@router.delete("/pagos/{pago_id}")
def delete_pago(pago_id: int, db: Session = Depends(get_db)):
    pago = db.query(models.Pago).filter(models.Pago.id == pago_id).first()
    if not pago:
        raise HTTPException(404, "Pago no encontrado")
    db.delete(pago)
    db.commit()
    return {"ok": True}

# =============================
# SUMMARY & DASHBOARD
# =============================

def calcular_pax_cobrar(grupo, ratio: int, padres_gratis: bool, guias_gratis: bool):
    """
    Calcula cuántos pax se deben cobrar basándose en liberados.
    - Ratio (X:1) libera 1 adulto por cada X estudiantes.
    - padres_gratis/guias_gratis libera a todo ese grupo.
    """
    estudiantes = (grupo.cantidad_estudiantes or 0)
    padres = (grupo.cantidad_padres or 0)
    guias = (grupo.cantidad_guias or 0)
    
    r = (ratio or 0)
    p_gratis = bool(padres_gratis)
    g_gratis = bool(guias_gratis)
    
    # Adultos que potencialmente pagan
    adultos_pagantes = 0
    if not p_gratis:
        adultos_pagantes += padres
    if not g_gratis:
        adultos_pagantes += guias
        
    # Aplicar ratio sobre los adultos que quedaron
    if r > 0 and estudiantes > 0:
        liberados_por_ratio = estudiantes // r
        adultos_pagantes = max(0, adultos_pagantes - liberados_por_ratio)
        
    return estudiantes + adultos_pagantes

def _get_pagantes_finales_por_servicio(grupo, servicio_key: str):
    legacy = grupo.pagantes_finales
    if servicio_key == "disco":
        return grupo.pagantes_finales_disco
    if servicio_key == "parque":
        return grupo.pagantes_finales_parque
    if servicio_key == "pool":
        return grupo.pagantes_finales_pool
    if servicio_key == "cena":
        return grupo.pagantes_finales_cena if grupo.pagantes_finales_cena is not None else legacy
    if servicio_key == "hielo":
        return grupo.pagantes_finales_hielo if grupo.pagantes_finales_hielo is not None else legacy
    if servicio_key == "combo":
        return grupo.pagantes_finales_combo
    return None

def _aplicar_pagantes_override(pax_base: int, grupo, servicio_key: str):
    override = _get_pagantes_finales_por_servicio(grupo, servicio_key)
    return override if override is not None else pax_base

@router.get("/resumen/{empresa_id}")
def get_resumen_empresa(empresa_id: int, db: Session = Depends(get_db)):
    empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    if not empresa:
        raise HTTPException(404, "Empresa no encontrada")
    
    config = get_config(empresa_id, db)
    grupos = db.query(models.Grupo).filter(models.Grupo.empresa_id == empresa_id).all()
    pagos = db.query(models.Pago).filter(models.Pago.empresa_id == empresa_id).all()
    
    total_venta = 0
    detalle_grupos = []
    
    for g in grupos:
        costo_grupo = 0
        servicios_detalle = []
        
        # OJO: El "pax" original del grupo para mostrar, 
        # pero para cobrar usaremos el calculado por servicio.
        total_pax_grupo = g.cantidad_pax 
        
        if config.es_combo:
            # Combo usa la lógica de "disco" para liberados por defecto o una mixta?
            # El usuario no especificó combo liberados, pero asumamos disco_ratio si es combo.
            pax_cobrar = calcular_pax_cobrar(g, config.disco_liberados_ratio, config.disco_padres_gratis, config.disco_guias_gratis)
            pax_cobrar = _aplicar_pagantes_override(pax_cobrar, g, "combo")
            c_combo = (config.precio_combo or 0)
            costo_grupo = pax_cobrar * c_combo
            servicios_detalle.append({
                "servicio": "Combo",
                "servicio_key": "combo",
                "descripcion": f"({config.combo_discos} D + {'P' if config.combo_parque else ''} + {'W' if config.combo_pool else ''})",
                "precio_u": c_combo,
                "cantidad": 1,
                "pax": pax_cobrar,
                "subtotal": costo_grupo,
                "pax_original": total_pax_grupo,
                "estudiantes": g.cantidad_estudiantes or 0,
                "padres": g.cantidad_padres or 0,
                "guias": g.cantidad_guias or 0
            })
        else:
            # Precio individual por cada servicio
            # Discos
            if g.discos_compradas > 0:
                pax_cobrar = calcular_pax_cobrar(g, config.disco_liberados_ratio, config.disco_padres_gratis, config.disco_guias_gratis)
                pax_cobrar = _aplicar_pagantes_override(pax_cobrar, g, "disco")
                p_disco = (config.precio_disco_individual or 0)
                costo_discos = pax_cobrar * p_disco * g.discos_compradas
                costo_grupo += costo_discos
                servicios_detalle.append({
                    "servicio": "Discotecas",
                    "servicio_key": "disco",
                    "descripcion": f"{g.discos_compradas} unidades",
                    "precio_u": p_disco,
                    "cantidad": g.discos_compradas,
                    "pax": pax_cobrar,
                    "subtotal": costo_discos,
                    "pax_original": total_pax_grupo,
                    "estudiantes": g.cantidad_estudiantes or 0,
                    "padres": g.cantidad_padres or 0,
                    "guias": g.cantidad_guias or 0
                })
            
            # Parque
            if g.parque_con_comida or db.query(models.FechaEvento).join(models.Asignacion).filter(models.Asignacion.grupo_id == g.id).join(models.Evento).filter(models.Evento.tipo == "PARQUE").first():
                pax_cobrar = calcular_pax_cobrar(g, config.parque_liberados_ratio, config.parque_padres_gratis, config.parque_guias_gratis)
                pax_cobrar = _aplicar_pagantes_override(pax_cobrar, g, "parque")
                if g.parque_con_comida:
                    p_parque = (config.precio_parque_con_comida or 0) or (config.precio_parque_individual or 0)
                    descripcion_parque = "Acceso con comida"
                else:
                    p_parque = (config.precio_parque_sin_comida or 0) or (config.precio_parque_individual or 0)
                    descripcion_parque = "Acceso sin comida"
                costo_parque = pax_cobrar * p_parque
                costo_grupo += costo_parque
                servicios_detalle.append({
                    "servicio": "Parque",
                    "servicio_key": "parque",
                    "descripcion": descripcion_parque,
                    "precio_u": p_parque,
                    "cantidad": 1,
                    "pax": pax_cobrar,
                    "subtotal": costo_parque,
                    "pax_original": total_pax_grupo,
                    "estudiantes": g.cantidad_estudiantes or 0,
                    "padres": g.cantidad_padres or 0,
                    "guias": g.cantidad_guias or 0
                })
                
            # Pool
            if g.pool_con_comida or db.query(models.FechaEvento).join(models.Asignacion).filter(models.Asignacion.grupo_id == g.id).join(models.Evento).filter(models.Evento.tipo == "POOL").first():
                pax_cobrar = calcular_pax_cobrar(g, config.pool_liberados_ratio, config.pool_padres_gratis, config.pool_guias_gratis)
                pax_cobrar = _aplicar_pagantes_override(pax_cobrar, g, "pool")
                if g.pool_con_comida:
                    p_pool = (config.precio_pool_con_comida or 0) or (config.precio_pool_individual or 0)
                    descripcion_pool = "Acceso con comida"
                else:
                    p_pool = (config.precio_pool_sin_comida or 0) or (config.precio_pool_individual or 0)
                    descripcion_pool = "Acceso sin comida"
                costo_pool = pax_cobrar * p_pool
                costo_grupo += costo_pool
                servicios_detalle.append({
                    "servicio": "Pool / Water",
                    "servicio_key": "pool",
                    "descripcion": descripcion_pool,
                    "precio_u": p_pool,
                    "cantidad": 1,
                    "pax": pax_cobrar,
                    "subtotal": costo_pool,
                    "pax_original": total_pax_grupo,
                    "estudiantes": g.cantidad_estudiantes or 0,
                    "padres": g.cantidad_padres or 0,
                    "guias": g.cantidad_guias or 0
                })

        tiene_cena = g.cena_velas or db.query(models.FechaEvento).join(models.Asignacion).filter(models.Asignacion.grupo_id == g.id).join(models.Evento).filter(models.Evento.tipo == "CENA").first()
        if tiene_cena:
            pax_cena = _aplicar_pagantes_override(total_pax_grupo, g, "cena")
            p_cena = (config.precio_cena_velas or 0)
            costo_cena = pax_cena * p_cena
            costo_grupo += costo_cena
            servicios_detalle.append({
                "servicio": "Cena de velas",
                "servicio_key": "cena",
                "descripcion": "Servicio adicional",
                "precio_u": p_cena,
                "cantidad": 1,
                "pax": pax_cena,
                "subtotal": costo_cena,
                "pax_original": total_pax_grupo,
                "estudiantes": g.cantidad_estudiantes or 0,
                "padres": g.cantidad_padres or 0,
                "guias": g.cantidad_guias or 0
            })

        tiene_hielo = g.bar_hielo or db.query(models.FechaEvento).join(models.Asignacion).filter(models.Asignacion.grupo_id == g.id).join(models.Evento).filter(models.Evento.tipo == "HIELO").first()
        if tiene_hielo:
            pax_hielo = _aplicar_pagantes_override(total_pax_grupo, g, "hielo")
            p_hielo = (config.precio_bar_hielo or 0)
            costo_hielo = pax_hielo * p_hielo
            costo_grupo += costo_hielo
            servicios_detalle.append({
                "servicio": "Bar de hielo",
                "servicio_key": "hielo",
                "descripcion": "Servicio adicional",
                "precio_u": p_hielo,
                "cantidad": 1,
                "pax": pax_hielo,
                "subtotal": costo_hielo,
                "pax_original": total_pax_grupo,
                "estudiantes": g.cantidad_estudiantes or 0,
                "padres": g.cantidad_padres or 0,
                "guias": g.cantidad_guias or 0
            })
            
        total_venta += costo_grupo
        detalle_grupos.append({
            "id": g.id,
            "nombre": g.nombre,
            "pax": total_pax_grupo,
            "pagantes_finales": g.pagantes_finales,
            "pagantes_finales_servicios": {
                "disco": _get_pagantes_finales_por_servicio(g, "disco"),
                "parque": _get_pagantes_finales_por_servicio(g, "parque"),
                "pool": _get_pagantes_finales_por_servicio(g, "pool"),
                "cena": _get_pagantes_finales_por_servicio(g, "cena"),
                "hielo": _get_pagantes_finales_por_servicio(g, "hielo"),
                "combo": _get_pagantes_finales_por_servicio(g, "combo"),
            },
            "estudiantes": g.cantidad_estudiantes or 0,
            "padres": g.cantidad_padres or 0,
            "guias": g.cantidad_guias or 0,
            "servicios": servicios_detalle,
            "subtotal": costo_grupo
        })
        
    total_pagado = sum(p.monto for p in pagos)
    
    return {
        "empresa": empresa.nombre,
        "config": config,
        "grupos": detalle_grupos,
        "total_venta": total_venta,
        "total_pagado": total_pagado,
        "saldo": total_venta - total_pagado,
        "porcentaje_pagado": (total_pagado / total_venta * 100) if total_venta > 0 else 0
    }

def get_asignaciones_pagadas(empresa_id: int, db: Session):
    try:
        config = get_config(empresa_id, db)
        pagos = db.query(models.Pago).filter(models.Pago.empresa_id == empresa_id).all()
        total_pagado = sum(p.monto for p in pagos)
        
        grupos = db.query(models.Grupo).filter(models.Grupo.empresa_id == empresa_id).all()
        items = []
        
        for g in grupos:
            asigs_grupo = db.query(models.Asignacion).filter(models.Asignacion.grupo_id == g.id).all()
            for a in asigs_grupo:
                if not a.fecha_evento:
                    print(f"ALERTA: Asignacion {a.id} sin fecha_evento")
                    continue
                
                tipo = a.fecha_evento.evento.tipo
                costo = 0
                if tipo == "HIELO":
                    pax = _aplicar_pagantes_override((g.cantidad_pax or 0), g, "hielo")
                    costo = pax * (config.precio_bar_hielo or 0)
                elif config.es_combo:
                    asigs_g_sorted = sorted(asigs_grupo, key=lambda x: x.fecha_evento.fecha if x.fecha_evento else date.max)
                    if asigs_g_sorted and a.id == asigs_g_sorted[0].id:
                        pax = calcular_pax_cobrar(g, config.disco_liberados_ratio, config.disco_padres_gratis, config.disco_guias_gratis)
                        pax = _aplicar_pagantes_override(pax, g, "combo")
                        costo = pax * (config.precio_combo or 0)
                else:
                    ratio, p_gratis, g_gratis = 0, False, False
                    precio_u = 0
                    if tipo == "DISCO":
                        ratio, p_gratis, g_gratis = config.disco_liberados_ratio, config.disco_padres_gratis, config.disco_guias_gratis
                        precio_u = config.precio_disco_individual or 0
                    elif tipo == "PARQUE":
                        ratio, p_gratis, g_gratis = config.parque_liberados_ratio, config.parque_padres_gratis, config.parque_guias_gratis
                        if g.parque_con_comida:
                            precio_u = (config.precio_parque_con_comida or 0) or (config.precio_parque_individual or 0)
                        else:
                            precio_u = (config.precio_parque_sin_comida or 0) or (config.precio_parque_individual or 0)
                    elif tipo == "POOL":
                        ratio, p_gratis, g_gratis = config.pool_liberados_ratio, config.pool_padres_gratis, config.pool_guias_gratis
                        if g.pool_con_comida:
                            precio_u = (config.precio_pool_con_comida or 0) or (config.precio_pool_individual or 0)
                        else:
                            precio_u = (config.precio_pool_sin_comida or 0) or (config.precio_pool_individual or 0)
                    elif tipo == "CENA":
                        ratio, p_gratis, g_gratis = 0, False, False
                        precio_u = config.precio_cena_velas or 0
                    elif tipo == "HIELO":
                        ratio, p_gratis, g_gratis = 0, False, False
                        precio_u = config.precio_bar_hielo or 0
                    
                    pax = calcular_pax_cobrar(g, ratio, p_gratis, g_gratis)
                    if tipo == "DISCO":
                        pax = _aplicar_pagantes_override(pax, g, "disco")
                    elif tipo == "PARQUE":
                        pax = _aplicar_pagantes_override(pax, g, "parque")
                    elif tipo == "POOL":
                        pax = _aplicar_pagantes_override(pax, g, "pool")
                    elif tipo == "CENA":
                        pax = _aplicar_pagantes_override((g.cantidad_pax or 0), g, "cena")
                    elif tipo == "HIELO":
                        pax = _aplicar_pagantes_override((g.cantidad_pax or 0), g, "hielo")
                    costo = pax * precio_u
                
                items.append({
                    "id": a.id,
                    "fecha": a.fecha_evento.fecha,
                    "costo": costo
                })
                    
        items.sort(key=lambda x: x["fecha"] if x["fecha"] else date.max)
        
        balance = total_pagado
        habilitados = {}
        for it in items:
            if balance >= it["costo"]:
                habilitados[it["id"]] = True
                balance -= it["costo"]
            else:
                habilitados[it["id"]] = False
        return habilitados
    except Exception as e:
        import traceback
        with open("error_finanzas.log", "a") as f:
            f.write(f"\nERROR en get_asignaciones_pagadas: {e}\n")
            f.write(traceback.format_exc())
        return {}

@router.get("/asignaciones/{grupo_id}")
def get_asignaciones_grupo(grupo_id: int, db: Session = Depends(get_db)):
    print(f"DEBUG: Cargando asignaciones para grupo_id={grupo_id}")
    grupo = db.query(models.Grupo).filter(models.Grupo.id == grupo_id).first()
    if not grupo:
        print(f"ALERTA: Grupo {grupo_id} no encontrado")
        raise HTTPException(404, "Grupo no encontrado")
        
    asignaciones = db.query(models.Asignacion).filter(models.Asignacion.grupo_id == grupo_id).all()
    print(f"DEBUG: Encontradas {len(asignaciones)} asignaciones para grupo {grupo_id}")
    
    habilitados = get_asignaciones_pagadas(grupo.empresa_id, db)
    print(f"DEBUG: Habilitados calculados para empresa {grupo.empresa_id}")
    
    return [{
        "id": a.id,
        "fecha": str(a.fecha_evento.fecha) if a.fecha_evento else "Sin fecha",
        "servicio": a.fecha_evento.evento.nombre if a.fecha_evento and a.fecha_evento.evento else "Sin servicio",
        "tipo": a.fecha_evento.evento.tipo if a.fecha_evento and a.fecha_evento.evento else "N/A",
        "pax": a.pax_asignados if a.pax_asignados is not None else (a.grupo.cantidad_pax if a.grupo else 0),
        "habilitado": habilitados.get(a.id, False),
        "voucher_usado": db.query(models.Voucher).filter(models.Voucher.asignacion_id == a.id).first().usado if db.query(models.Voucher).filter(models.Voucher.asignacion_id == a.id).first() else False,
        "voucher_fecha_uso": db.query(models.Voucher).filter(models.Voucher.asignacion_id == a.id).first().fecha_uso if db.query(models.Voucher).filter(models.Voucher.asignacion_id == a.id).first() else None
    } for a in asignaciones]

@router.get("/dashboard")
def get_dashboard(db: Session = Depends(get_db)):
    empresas = db.query(models.Empresa).join(models.Grupo).distinct().all()
    resumen_global = []
    
    for e in empresas:
        res = get_resumen_empresa(e.id, db)
        resumen_global.append({
            "id": e.id,
            "nombre": e.nombre,
            "moneda": res["config"].moneda,
            "total_venta": res["total_venta"],
            "total_pagado": res["total_pagado"],
            "saldo": res["saldo"],
            "porcentaje_pagado": res["porcentaje_pagado"]
        })
        
    return resumen_global


@router.post("/migracion-parque-precios")
def migracion_parque_precios(db: Session = Depends(get_db)):
    db.execute(text("ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS moneda VARCHAR DEFAULT 'ARS'"))
    db.execute(text("ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS precio_parque_con_comida INTEGER DEFAULT 0"))
    db.execute(text("ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS precio_parque_sin_comida INTEGER DEFAULT 0"))
    db.execute(text("ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS precio_pool_con_comida INTEGER DEFAULT 0"))
    db.execute(text("ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS precio_pool_sin_comida INTEGER DEFAULT 0"))
    db.execute(text("ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS precio_cena_velas INTEGER DEFAULT 0"))
    db.execute(text("ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS precio_bar_hielo INTEGER DEFAULT 0"))
    db.execute(text("ALTER TABLE grupos ADD COLUMN IF NOT EXISTS cena_velas BOOLEAN DEFAULT FALSE"))
    db.execute(text("ALTER TABLE grupos ADD COLUMN IF NOT EXISTS bar_hielo BOOLEAN DEFAULT FALSE"))
    db.execute(text("UPDATE finanzas_empresa SET moneda = 'ARS' WHERE moneda IS NULL"))
    db.commit()
    return {"ok": True}


# =============================
# PAGANTES FINALES POR GRUPO
# =============================

@router.put("/grupo/{grupo_id}/pagantes")
def actualizar_pagantes_finales(grupo_id: int, body: schemas.GrupoPagantesUpdate, db: Session = Depends(get_db)):
    grupo = db.get(models.Grupo, grupo_id)
    if not grupo:
        raise HTTPException(404, "Grupo no encontrado")

    pagantes = body.pagantes_finales
    servicio = body.servicio
    if servicio is not None:
        servicio = servicio.lower()
    valid_servicios = {"disco", "parque", "pool", "cena", "hielo", "combo"}
    if servicio and servicio not in valid_servicios:
        raise HTTPException(400, "Servicio inválido")
    if pagantes is not None:
        if pagantes < 0:
            raise HTTPException(400, "Pagantes finales no puede ser negativo")
        total = grupo.cantidad_pax or 0
        if total > 0 and pagantes > total:
            raise HTTPException(400, "Pagantes finales no puede superar el total de PAX")

    if servicio is None:
        grupo.pagantes_finales = pagantes
    else:
        if servicio == "disco":
            grupo.pagantes_finales_disco = pagantes
        elif servicio == "parque":
            grupo.pagantes_finales_parque = pagantes
        elif servicio == "pool":
            grupo.pagantes_finales_pool = pagantes
        elif servicio == "cena":
            grupo.pagantes_finales_cena = pagantes
        elif servicio == "hielo":
            grupo.pagantes_finales_hielo = pagantes
        elif servicio == "combo":
            grupo.pagantes_finales_combo = pagantes
    db.commit()
    db.refresh(grupo)
    return {"ok": True, "pagantes_finales": pagantes, "servicio": servicio}
