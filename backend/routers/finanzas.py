from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from database import get_db
import models, schemas
from typing import List
from datetime import date
import json

router = APIRouter(prefix="/finanzas", tags=["Finanzas"])

# =============================
# PRICING / CONFIGURATION
# =============================

def obtener_moneda_servicio(servicio_key: str, config) -> str:
    """
    Retorna la moneda asignada al servicio ('USD' o 'BRL').
    Si no está configurada, utiliza la moneda principal de liquidación de la empresa (o 'USD').
    """
    if not config:
        return "USD"
    try:
        mapping = {}
        if isinstance(config.servicios_monedas, str) and config.servicios_monedas.strip():
            mapping = json.loads(config.servicios_monedas)
        elif isinstance(config.servicios_monedas, dict):
            mapping = config.servicios_monedas
        
        if servicio_key in mapping:
            return mapping[servicio_key]
        if servicio_key.startswith("parque") and "parque" in mapping:
            return mapping["parque"]
        if servicio_key.startswith("campamento") and "campamento" in mapping:
            return mapping["campamento"]
        if servicio_key.startswith("zacarias") and "zacarias" in mapping:
            return mapping["zacarias"]
        if servicio_key.startswith("pool") and "pool" in mapping:
            return mapping["pool"]
        if servicio_key.startswith("comida_") or servicio_key in ("almuerzo", "cena", "cena_restaurante"):
            if "almuerzo" in mapping and "almuerzo" in servicio_key:
                return mapping["almuerzo"]
            if "cena" in mapping and "cena" in servicio_key:
                return mapping["cena"]
            if "comida" in mapping:
                return mapping["comida"]
    except Exception:
        pass

    moneda_base = getattr(config, "moneda_liquidacion", None) or (config.moneda if config.moneda and config.moneda != "ARS" else "USD")
    return moneda_base or "USD"

def convertir_moneda(monto: float, moneda_origen: str, moneda_destino: str, tasa_cambio: float) -> float:
    """
    Convierte montos entre USD y BRL usando la tasa de cambio especificada.
    Por ejemplo, tasa_cambio = 5.3 significa que 1 USD = 5.3 BRL.
    """
    if not tasa_cambio or tasa_cambio <= 0:
        tasa_cambio = 5.3
    if not moneda_origen or not moneda_destino or moneda_origen == moneda_destino:
        return round(float(monto), 2)
    if moneda_origen == "BRL" and moneda_destino == "USD":
        return round(float(monto) / tasa_cambio, 2)
    if moneda_origen == "USD" and moneda_destino == "BRL":
        return round(float(monto) * tasa_cambio, 2)
    return round(float(monto), 2)

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

def obtener_precio_servicio_grupo(grupo, servicio_key: str, precio_base: int, config) -> int:
    """
    Determina si hay un precio mensual configurado para el mes de entrada del grupo.
    De lo contrario, retorna el precio base.
    """
    if not grupo or not grupo.fecha_entrada:
        return precio_base
    mes = grupo.fecha_entrada.month
    
    # Intenta buscar coincidencia exacta
    for override in getattr(config, "precios_mensuales", []):
        if override.servicio == servicio_key and override.mes == mes:
            return override.precio
            
    # Fallback si es parque_con_comida o parque_sin_comida a "parque"
    if servicio_key in ("parque_con_comida", "parque_sin_comida"):
        for override in getattr(config, "precios_mensuales", []):
            if override.servicio == "parque" and override.mes == mes:
                return override.precio
                
    # Fallback si es campamento_con_comida o campamento_sin_comida a "campamento"
    if servicio_key in ("campamento_con_comida", "campamento_sin_comida"):
        for override in getattr(config, "precios_mensuales", []):
            if override.servicio == "campamento" and override.mes == mes:
                return override.precio

    # Fallback si es zacarias_con_comida o zacarias_sin_comida a "zacarias"
    if servicio_key in ("zacarias_con_comida", "zacarias_sin_comida"):
        for override in getattr(config, "precios_mensuales", []):
            if override.servicio == "zacarias" and override.mes == mes:
                return override.precio
                
    # Fallback si es pool_con_comida o pool_sin_comida a "pool"
    if servicio_key in ("pool_con_comida", "pool_sin_comida"):
        for override in getattr(config, "precios_mensuales", []):
            if override.servicio == "pool" and override.mes == mes:
                return override.precio
                
    return precio_base

@router.get("/config/{empresa_id}/mensuales", response_model=List[schemas.PrecioServicioMensualOut])
def get_precios_mensuales(empresa_id: int, db: Session = Depends(get_db)):
    config = db.query(models.FinanzasEmpresa).filter(models.FinanzasEmpresa.empresa_id == empresa_id).first()
    if not config:
        return []
    return config.precios_mensuales

@router.post("/config/mensuales", response_model=schemas.PrecioServicioMensualOut)
def save_precio_mensual(data: schemas.PrecioServicioMensualCreate, empresa_id: int, db: Session = Depends(get_db)):
    config = db.query(models.FinanzasEmpresa).filter(models.FinanzasEmpresa.empresa_id == empresa_id).first()
    if not config:
        raise HTTPException(404, "Configuración de finanzas no encontrada para la empresa")
    
    # Check if override already exists for this service and month
    override = db.query(models.PrecioServicioMensual).filter(
        models.PrecioServicioMensual.finanzas_empresa_id == config.id,
        models.PrecioServicioMensual.servicio == data.servicio,
        models.PrecioServicioMensual.mes == data.mes
    ).first()
    
    if override:
        override.precio = data.precio
    else:
        override = models.PrecioServicioMensual(
            finanzas_empresa_id=config.id,
            servicio=data.servicio,
            mes=data.mes,
            precio=data.precio
        )
        db.add(override)
        
    db.commit()
    db.refresh(override)
    return override

@router.delete("/config/mensuales/{override_id}")
def delete_precio_mensual(override_id: int, db: Session = Depends(get_db)):
    override = db.query(models.PrecioServicioMensual).filter(models.PrecioServicioMensual.id == override_id).first()
    if not override:
        raise HTTPException(404, "Precio mensual no encontrado")
    db.delete(override)
    db.commit()
    return {"ok": True}

# =============================
# PAYMENTS
# =============================
@router.get("/pagos/{empresa_id}", response_model=List[schemas.PagoOut])
def get_pagos(empresa_id: int, db: Session = Depends(get_db)):
    pagos = db.query(models.Pago).filter(models.Pago.empresa_id == empresa_id).order_by(models.Pago.fecha.desc()).all()
    config = db.query(models.FinanzasEmpresa).filter(models.FinanzasEmpresa.empresa_id == empresa_id).first()
    tasa_def = float(config.tasa_cambio) if (config and config.tasa_cambio and config.tasa_cambio > 0) else 5.3
    moneda_liq = getattr(config, "moneda_liquidacion", None) or (config.moneda if config and config.moneda and config.moneda != "ARS" else "USD") if config else "USD"
    for p in pagos:
        if not getattr(p, "moneda", None):
            p.moneda = "USD"
        if not getattr(p, "tasa_cambio", None) or p.tasa_cambio <= 0:
            p.tasa_cambio = tasa_def
        if getattr(p, "monto_convertido", None) is None:
            p.monto_convertido = convertir_moneda(p.monto, p.moneda, moneda_liq, p.tasa_cambio)
    return pagos

@router.post("/pagos", response_model=schemas.PagoOut)
def create_pago(pago: schemas.PagoCreate, db: Session = Depends(get_db)):
    config = db.query(models.FinanzasEmpresa).filter(models.FinanzasEmpresa.empresa_id == pago.empresa_id).first()
    tasa = pago.tasa_cambio or (float(config.tasa_cambio) if (config and config.tasa_cambio and config.tasa_cambio > 0) else 5.3)
    moneda_liq = getattr(config, "moneda_liquidacion", None) or (config.moneda if config and config.moneda and config.moneda != "ARS" else "USD") if config else "USD"
    
    moneda_pago = pago.moneda or "USD"
    monto_convertido = pago.monto_convertido
    if monto_convertido is None:
        monto_convertido = convertir_moneda(pago.monto, moneda_pago, moneda_liq, tasa)

    datos = pago.model_dump()
    datos["tasa_cambio"] = tasa
    datos["moneda"] = moneda_pago
    datos["monto_convertido"] = monto_convertido
    nuevo_pago = models.Pago(**datos)
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
    if servicio_key == "campamento":
        return getattr(grupo, "pagantes_finales_campamento", None)
    if servicio_key == "zacarias":
        return getattr(grupo, "pagantes_finales_zacarias", None)
    if servicio_key == "pool":
        return grupo.pagantes_finales_pool
    if servicio_key == "cena":
        return grupo.pagantes_finales_cena if grupo.pagantes_finales_cena is not None else legacy
    if servicio_key == "hielo":
        return grupo.pagantes_finales_hielo if grupo.pagantes_finales_hielo is not None else legacy
    if servicio_key == "combo":
        return grupo.pagantes_finales_combo
    if servicio_key == "surf":
        return grupo.pagantes_finales_surf if getattr(grupo, "pagantes_finales_surf", None) is not None else legacy
    if servicio_key == "unipraias":
        return grupo.pagantes_finales_unipraias if getattr(grupo, "pagantes_finales_unipraias", None) is not None else legacy
    if servicio_key == "beto":
        return grupo.pagantes_finales_beto if getattr(grupo, "pagantes_finales_beto", None) is not None else legacy
    if servicio_key == "barco":
        return grupo.pagantes_finales_barco if getattr(grupo, "pagantes_finales_barco", None) is not None else legacy
    if servicio_key == "cristo":
        return grupo.pagantes_finales_cristo if getattr(grupo, "pagantes_finales_cristo", None) is not None else legacy
    if servicio_key == "sunset":
        return grupo.pagantes_finales_sunset if getattr(grupo, "pagantes_finales_sunset", None) is not None else legacy
    if servicio_key == "quinta_comida":
        return grupo.pagantes_finales_quinta_comida if getattr(grupo, "pagantes_finales_quinta_comida", None) is not None else legacy
    if servicio_key == "multiparque":
        return grupo.pagantes_finales_multiparque if getattr(grupo, "pagantes_finales_multiparque", None) is not None else legacy
    if servicio_key == "disco_opcional":
        return getattr(grupo, "pagantes_finales_disco_opcional", None)
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
    
    tasa = float(config.tasa_cambio) if (getattr(config, "tasa_cambio", None) and config.tasa_cambio > 0) else 5.3
    moneda_liq = getattr(config, "moneda_liquidacion", None) or (config.moneda if config.moneda and config.moneda != "ARS" else "USD")

    total_venta = 0
    total_venta_usd = 0
    total_venta_brl = 0
    detalle_grupos = []
    
    for g in grupos:
        costo_grupo = 0
        servicios_detalle = []
        
        # OJO: El "pax" original del grupo para mostrar, 
        # pero para cobrar usaremos el calculado por servicio.
        total_pax_grupo = g.cantidad_pax

        def agregar_servicio(s_nombre, s_key, s_desc, p_u, cant, pax, s_extra=None):
            nonlocal costo_grupo, total_venta_usd, total_venta_brl
            moneda_s = obtener_moneda_servicio(s_key, config)
            subtotal_orig = round(pax * p_u * cant, 2)
            subtotal_conv = convertir_moneda(subtotal_orig, moneda_s, moneda_liq, tasa)
            costo_grupo += subtotal_conv

            if moneda_s == "USD":
                total_venta_usd += subtotal_orig
            elif moneda_s == "BRL":
                total_venta_brl += subtotal_orig

            item = {
                "servicio": s_nombre,
                "servicio_key": s_key,
                "descripcion": s_desc,
                "precio_u": p_u,
                "cantidad": cant,
                "pax": pax,
                "moneda": moneda_s,
                "subtotal": subtotal_conv,
                "subtotal_original": subtotal_orig,
                "tasa_cambio": tasa,
                "pax_original": total_pax_grupo,
                "estudiantes": g.cantidad_estudiantes or 0,
                "padres": g.cantidad_padres or 0,
                "guias": g.cantidad_guias or 0
            }
            if s_extra:
                item.update(s_extra)
            servicios_detalle.append(item)
        
        if config.es_combo:
            pax_cobrar = calcular_pax_cobrar(g, config.disco_liberados_ratio, config.disco_padres_gratis, config.disco_guias_gratis)
            pax_cobrar = _aplicar_pagantes_override(pax_cobrar, g, "combo")
            c_combo = obtener_precio_servicio_grupo(g, "combo", config.precio_combo or 0, config)
            desc_combo = f"({config.combo_discos} D + {'P' if config.combo_parque else ''} + {'Ca' if getattr(config, 'combo_campamento', False) else ''} + {'Z' if getattr(config, 'combo_zacarias', False) else ''} + {'W' if config.combo_pool else ''} + {'C' if config.combo_cena_velas else ''} + {'H' if config.combo_bar_hielo else ''} + {'Su' if getattr(config, 'combo_surf', False) else ''} + {'U' if getattr(config, 'combo_unipraias', False) else ''} + {'Be' if getattr(config, 'combo_beto', False) else ''} + {'Ba' if getattr(config, 'combo_barco', False) else ''} + {'Cr' if getattr(config, 'combo_cristo', False) else ''} + {'St' if getattr(config, 'combo_sunset', False) else ''})"
            agregar_servicio("Combo", "combo", desc_combo, c_combo, 1, pax_cobrar)
        else:
            # Precio individual por cada servicio
            # Discos incluidas
            if g.discos_compradas > 0:
                pax_cobrar = calcular_pax_cobrar(g, config.disco_liberados_ratio, config.disco_padres_gratis, config.disco_guias_gratis)
                pax_cobrar = _aplicar_pagantes_override(pax_cobrar, g, "disco")
                p_disco = obtener_precio_servicio_grupo(g, "disco", config.precio_disco_individual or 0, config)
                agregar_servicio("Discotecas", "disco", f"{g.discos_compradas} unidades", p_disco, g.discos_compradas, pax_cobrar)

            # Discos opcionales (compra extra, precio diferente)
            discos_opcionales = getattr(g, "discos_opcionales", 0) or 0
            if discos_opcionales > 0:
                pax_cobrar_opc = calcular_pax_cobrar(g, config.disco_liberados_ratio, config.disco_padres_gratis, config.disco_guias_gratis)
                pax_cobrar_opc = _aplicar_pagantes_override(pax_cobrar_opc, g, "disco_opcional")
                p_disco_opc = obtener_precio_servicio_grupo(g, "disco_opcional", getattr(config, "precio_disco_opcional", 0) or 0, config)
                agregar_servicio("Discotecas Opcionales", "disco_opcional", f"{discos_opcionales} unidades (opcional vendida)", p_disco_opc, discos_opcionales, pax_cobrar_opc)
            
            # Parque
            if g.parque_con_comida or db.query(models.FechaEvento).join(models.Asignacion).filter(models.Asignacion.grupo_id == g.id).join(models.Evento).filter(models.Evento.tipo == "PARQUE").first():
                pax_cobrar = calcular_pax_cobrar(g, config.parque_liberados_ratio, config.parque_padres_gratis, config.parque_guias_gratis)
                pax_cobrar = _aplicar_pagantes_override(pax_cobrar, g, "parque")
                if g.parque_con_comida:
                    base_parque = (config.precio_parque_con_comida or 0) or (config.precio_parque_individual or 0)
                    p_parque = obtener_precio_servicio_grupo(g, "parque_con_comida", base_parque, config)
                    descripcion_parque = "Acceso con comida"
                    s_key_parque = "parque_con_comida"
                else:
                    base_parque = (config.precio_parque_sin_comida or 0) or (config.precio_parque_individual or 0)
                    p_parque = obtener_precio_servicio_grupo(g, "parque_sin_comida", base_parque, config)
                    descripcion_parque = "Acceso sin comida"
                    s_key_parque = "parque_sin_comida"
                agregar_servicio("Parque", s_key_parque, descripcion_parque, p_parque, 1, pax_cobrar)
                
            # Campamento
            if getattr(g, 'campamento_con_comida', False) or getattr(g, 'campamento_acceso', False) or db.query(models.FechaEvento).join(models.Asignacion).filter(models.Asignacion.grupo_id == g.id).join(models.Evento).filter(models.Evento.tipo == "CAMPAMENTO").first():
                pax_cobrar = calcular_pax_cobrar(g, getattr(config, 'campamento_liberados_ratio', 0), getattr(config, 'campamento_padres_gratis', False), getattr(config, 'campamento_guias_gratis', False))
                pax_cobrar = _aplicar_pagantes_override(pax_cobrar, g, "campamento")
                if getattr(g, 'campamento_con_comida', False):
                    base_campamento = (getattr(config, 'precio_campamento_con_comida', 0) or 0) or (getattr(config, 'precio_campamento_individual', 0) or 0)
                    p_campamento = obtener_precio_servicio_grupo(g, "campamento_con_comida", base_campamento, config)
                    descripcion_campamento = "Acceso con comida"
                    s_key_camp = "campamento_con_comida"
                else:
                    base_campamento = (getattr(config, 'precio_campamento_sin_comida', 0) or 0) or (getattr(config, 'precio_campamento_individual', 0) or 0)
                    p_campamento = obtener_precio_servicio_grupo(g, "campamento_sin_comida", base_campamento, config)
                    descripcion_campamento = "Acceso sin comida"
                    s_key_camp = "campamento_sin_comida"
                agregar_servicio("Campamento Americano", s_key_camp, descripcion_campamento, p_campamento, 1, pax_cobrar)

            # Zacarias
            if getattr(g, 'zacarias_con_comida', False) or getattr(g, 'zacarias_acceso', False) or db.query(models.FechaEvento).join(models.Asignacion).filter(models.Asignacion.grupo_id == g.id).join(models.Evento).filter(models.Evento.tipo == "ZACARIAS").first():
                pax_cobrar = calcular_pax_cobrar(g, getattr(config, 'zacarias_liberados_ratio', 0), getattr(config, 'zacarias_padres_gratis', False), getattr(config, 'zacarias_guias_gratis', False))
                pax_cobrar = _aplicar_pagantes_override(pax_cobrar, g, "zacarias")
                if getattr(g, 'zacarias_con_comida', False):
                    base_zacarias = (getattr(config, 'precio_zacarias_con_comida', 0) or 0) or (getattr(config, 'precio_zacarias_individual', 0) or 0)
                    p_zacarias = obtener_precio_servicio_grupo(g, "zacarias_con_comida", base_zacarias, config)
                    descripcion_zacarias = "Acceso con comida"
                    s_key_zac = "zacarias_con_comida"
                else:
                    base_zacarias = (getattr(config, 'precio_zacarias_sin_comida', 0) or 0) or (getattr(config, 'precio_zacarias_individual', 0) or 0)
                    p_zacarias = obtener_precio_servicio_grupo(g, "zacarias_sin_comida", base_zacarias, config)
                    descripcion_zacarias = "Acceso sin comida"
                    s_key_zac = "zacarias_sin_comida"
                agregar_servicio("Zacarias", s_key_zac, descripcion_zacarias, p_zacarias, 1, pax_cobrar)
                
            # Pool
            if g.pool_con_comida or db.query(models.FechaEvento).join(models.Asignacion).filter(models.Asignacion.grupo_id == g.id).join(models.Evento).filter(models.Evento.tipo == "POOL").first():
                pax_cobrar = calcular_pax_cobrar(g, config.pool_liberados_ratio, config.pool_padres_gratis, config.pool_guias_gratis)
                pax_cobrar = _aplicar_pagantes_override(pax_cobrar, g, "pool")
                if g.pool_con_comida:
                    base_pool = (config.precio_pool_con_comida or 0) or (config.precio_pool_individual or 0)
                    p_pool = obtener_precio_servicio_grupo(g, "pool_con_comida", base_pool, config)
                    descripcion_pool = "Acceso con comida"
                    s_key_pool = "pool_con_comida"
                else:
                    base_pool = (config.precio_pool_sin_comida or 0) or (config.precio_pool_individual or 0)
                    p_pool = obtener_precio_servicio_grupo(g, "pool_sin_comida", base_pool, config)
                    descripcion_pool = "Acceso sin comida"
                    s_key_pool = "pool_sin_comida"
                agregar_servicio("Pool / Water", s_key_pool, descripcion_pool, p_pool, 1, pax_cobrar)

        tiene_cena = g.cena_velas or db.query(models.FechaEvento).join(models.Asignacion).filter(models.Asignacion.grupo_id == g.id).join(models.Evento).filter(models.Evento.tipo == "CENA").first()
        if tiene_cena and not (config.es_combo and config.combo_cena_velas):
            pax_cena = _aplicar_pagantes_override(total_pax_grupo, g, "cena")
            p_cena = obtener_precio_servicio_grupo(g, "cena", config.precio_cena_velas or 0, config)
            agregar_servicio("Cena de velas", "cena", "Servicio adicional", p_cena, 1, pax_cena)

        tiene_hielo = g.bar_hielo or db.query(models.FechaEvento).join(models.Asignacion).filter(models.Asignacion.grupo_id == g.id).join(models.Evento).filter(models.Evento.tipo == "HIELO").first()
        if tiene_hielo and not (config.es_combo and config.combo_bar_hielo):
            pax_hielo = _aplicar_pagantes_override(total_pax_grupo, g, "hielo")
            p_hielo = obtener_precio_servicio_grupo(g, "hielo", config.precio_bar_hielo or 0, config)
            agregar_servicio("Bar de hielo", "hielo", "Servicio adicional", p_hielo, 1, pax_hielo)
            
        # NUEVOS EVENTOS
        nuevos_eventos = [
            ("surf_acceso", "SURF", "surf", "precio_surf", "combo_surf", "Surf"),
            ("unipraias_acceso", "UNIPRAIAS", "unipraias", "precio_unipraias", "combo_unipraias", "Parque Unipraias"),
            ("beto_acceso", "BETO", "beto", "precio_beto", "combo_beto", "Beto Carrero"),
            ("barco_acceso", "BARCO", "barco", "precio_barco", "combo_barco", "Barco Pirata"),
            ("cristo_acceso", "CRISTO", "cristo", "precio_cristo", "combo_cristo", "Cristo Luz"),
            ("sunset_acceso", "SUNSET", "sunset", "precio_sunset", "combo_sunset", "Sunset"),
            ("quinta_comida_acceso", "QUINTA_COMIDA", "quinta_comida", "precio_quinta_comida", "combo_quinta_comida", "Quinta Comida"),
            ("multiparque_acceso", "MULTIPARQUE", "multiparque", "precio_multiparque", "combo_multiparque", "Multiparque"),
        ]
        
        for (g_attr, tipo_db, s_key, precio_attr, combo_attr, s_name) in nuevos_eventos:
            tiene_acceso = getattr(g, g_attr, False)
            tiene_evento = db.query(models.FechaEvento).join(models.Asignacion).filter(models.Asignacion.grupo_id == g.id).join(models.Evento).filter(models.Evento.tipo == tipo_db).first()
            if (tiene_acceso or tiene_evento) and not (config.es_combo and getattr(config, combo_attr, False)):
                pax_ev = _aplicar_pagantes_override(total_pax_grupo, g, s_key)
                p_ev = obtener_precio_servicio_grupo(g, s_key, getattr(config, precio_attr, 0) or 0, config)
                agregar_servicio(s_name, s_key, "Servicio", p_ev, 1, pax_ev)

        # ── Almuerzos y Cenas vendidos en restaurantes ──────────────────────
        anotacion_g = db.query(models.AnotacionGrupo).filter(
            models.AnotacionGrupo.grupo_id == g.id
        ).first()
        if anotacion_g:
            for comida in anotacion_g.comidas:
                pax_comida = comida.cant_pax if (comida.cant_pax and comida.cant_pax > 0) else (total_pax_grupo or 0)
                if pax_comida <= 0:
                    continue

                tipo = (comida.tipo_comida or "").strip().lower()
                # Si tiene precio específico mayor a 0, usarlo.
                # De lo contrario, usar el precio global configurado en Finanzas para la empresa.
                if comida.precio_unitario is not None and float(comida.precio_unitario) > 0:
                    p_comida = float(comida.precio_unitario)
                elif tipo == "almuerzo":
                    p_comida = float(getattr(config, "precio_almuerzo", 0) or 0)
                elif tipo == "cena":
                    p_comida = float(getattr(config, "precio_cena", 0) or 0)
                else:
                    p_comida = float(getattr(config, "precio_almuerzo", 0) or 0)

                tipo_label = "🍽️ Almuerzo" if tipo == "almuerzo" else ("🍷 Cena" if tipo == "cena" else f"🍴 {comida.tipo_comida}")
                s_key_comida = f"comida_{comida.id}"
                desc_comida = f"{comida.fecha or ''}{' · ' + comida.hora if comida.hora else ''} · {comida.lugar or 'Restaurante'}"
                agregar_servicio(
                    f"{tipo_label} — {comida.lugar or 'Restaurante'}",
                    s_key_comida,
                    desc_comida,
                    p_comida,
                    1,
                    pax_comida,
                    s_extra={"es_comida": True, "comida_id": comida.id}
                )

        total_venta += costo_grupo
        detalle_grupos.append({
            "id": g.id,
            "nombre": g.nombre,
            "pax": total_pax_grupo,
            "pagantes_finales": g.pagantes_finales,
            "pagantes_finales_servicios": {
                "disco": _get_pagantes_finales_por_servicio(g, "disco"),
                "parque": _get_pagantes_finales_por_servicio(g, "parque"),
                "campamento": _get_pagantes_finales_por_servicio(g, "campamento"),
                "zacarias": _get_pagantes_finales_por_servicio(g, "zacarias"),
                "pool": _get_pagantes_finales_por_servicio(g, "pool"),
                "cena": _get_pagantes_finales_por_servicio(g, "cena"),
                "hielo": _get_pagantes_finales_por_servicio(g, "hielo"),
                "combo": _get_pagantes_finales_por_servicio(g, "combo"),
                "surf": _get_pagantes_finales_por_servicio(g, "surf"),
                "unipraias": _get_pagantes_finales_por_servicio(g, "unipraias"),
                "beto": _get_pagantes_finales_por_servicio(g, "beto"),
                "barco": _get_pagantes_finales_por_servicio(g, "barco"),
                "cristo": _get_pagantes_finales_por_servicio(g, "cristo"),
                "sunset": _get_pagantes_finales_por_servicio(g, "sunset"),
                "quinta_comida": _get_pagantes_finales_por_servicio(g, "quinta_comida"),
                "multiparque": _get_pagantes_finales_por_servicio(g, "multiparque"),
                "disco_opcional": _get_pagantes_finales_por_servicio(g, "disco_opcional"),
            },
            "estudiantes": g.cantidad_estudiantes or 0,
            "padres": g.cantidad_padres or 0,
            "guias": g.cantidad_guias or 0,
            "servicios": servicios_detalle,
            "subtotal": round(costo_grupo, 2)
        })
        
    total_pagado = 0
    total_pagado_usd = 0
    total_pagado_brl = 0
    for p in pagos:
        m_pago = getattr(p, "moneda", "USD") or "USD"
        tasa_p = float(p.tasa_cambio) if (getattr(p, "tasa_cambio", None) and p.tasa_cambio > 0) else tasa
        if m_pago == "USD":
            total_pagado_usd += p.monto
        elif m_pago == "BRL":
            total_pagado_brl += p.monto

        if getattr(p, "monto_convertido", None) is not None and p.monto_convertido > 0:
            conv = p.monto_convertido
        else:
            conv = convertir_moneda(p.monto, m_pago, moneda_liq, tasa_p)
        total_pagado += conv
    
    total_venta = round(total_venta, 2)
    total_pagado = round(total_pagado, 2)
    saldo = round(total_venta - total_pagado, 2)
    saldo_brl_eq = round(saldo * tasa, 2) if moneda_liq == "USD" else saldo
    saldo_usd_eq = saldo if moneda_liq == "USD" else round(saldo / tasa, 2)

    return {
        "empresa": empresa.nombre,
        "config": config,
        "grupos": detalle_grupos,
        "total_venta": total_venta,
        "total_venta_usd": round(total_venta_usd, 2),
        "total_venta_brl": round(total_venta_brl, 2),
        "tasa_cambio": tasa,
        "moneda_liquidacion": moneda_liq,
        "total_pagado": total_pagado,
        "total_pagado_usd": round(total_pagado_usd, 2),
        "total_pagado_brl": round(total_pagado_brl, 2),
        "saldo": saldo,
        "saldo_brl_equivalente": saldo_brl_eq,
        "saldo_usd_equivalente": saldo_usd_eq,
        "porcentaje_pagado": (total_pagado / total_venta * 100) if total_venta > 0 else 0
    }

def get_asignaciones_pagadas(empresa_id: int, db: Session):
    try:
        config = get_config(empresa_id, db)
        pagos = db.query(models.Pago).filter(models.Pago.empresa_id == empresa_id).all()
        tasa = float(config.tasa_cambio) if (getattr(config, "tasa_cambio", None) and config.tasa_cambio > 0) else 5.3
        moneda_liq = getattr(config, "moneda_liquidacion", None) or (config.moneda if config and config.moneda and config.moneda != "ARS" else "USD")
        total_pagado = 0
        for p in pagos:
            m_pago = getattr(p, "moneda", "USD") or "USD"
            tasa_p = float(p.tasa_cambio) if (getattr(p, "tasa_cambio", None) and p.tasa_cambio > 0) else tasa
            if getattr(p, "monto_convertido", None) is not None and p.monto_convertido > 0:
                total_pagado += p.monto_convertido
            else:
                total_pagado += convertir_moneda(p.monto, m_pago, moneda_liq, tasa_p)
        
        grupos = db.query(models.Grupo).filter(models.Grupo.empresa_id == empresa_id).all()
        items = []
        
        for g in grupos:
            asigs_grupo = db.query(models.Asignacion).filter(models.Asignacion.grupo_id == g.id).all()

            # ── PRE-CÁLCULO PARA COMBO ────────────────────────────────────────────────
            # Si la empresa usa combo, distribuimos el costo TOTAL del combo en partes
            # iguales entre todos los eventos combo asignados al grupo.
            #
            # Ejemplo: combo $60/PAX, 250 PAX, 6 discos → $15.000 total
            #          → $2.500 por evento
            #          Con seña de $4.000: habilita evento 1 ✅, evento 2 ❌
            combo_costo_por_evento = 0
            combo_tipos = set()
            if config.es_combo:
                # Tipos de evento incluidos en el combo
                combo_tipos = {"DISCO"}
                if config.combo_parque:                           combo_tipos.add("PARQUE")
                if getattr(config, "combo_campamento", False):   combo_tipos.add("CAMPAMENTO")
                if getattr(config, "combo_zacarias", False):     combo_tipos.add("ZACARIAS")
                if config.combo_pool:                             combo_tipos.add("POOL")
                if config.combo_cena_velas:                      combo_tipos.add("CENA")
                if config.combo_bar_hielo:                       combo_tipos.add("HIELO")
                if getattr(config, "combo_surf", False):         combo_tipos.add("SURF")
                if getattr(config, "combo_unipraias", False):    combo_tipos.add("UNIPRAIAS")
                if getattr(config, "combo_beto", False):         combo_tipos.add("BETO")
                if getattr(config, "combo_barco", False):        combo_tipos.add("BARCO")
                if getattr(config, "combo_cristo", False):       combo_tipos.add("CRISTO")
                if getattr(config, "combo_sunset", False):       combo_tipos.add("SUNSET")
                if getattr(config, "combo_quinta_comida", False):combo_tipos.add("QUINTA_COMIDA")
                if getattr(config, "combo_multiparque", False):  combo_tipos.add("MULTIPARQUE")

                pax_combo = calcular_pax_cobrar(g, config.disco_liberados_ratio, config.disco_padres_gratis, config.disco_guias_gratis)
                pax_combo = _aplicar_pagantes_override(pax_combo, g, "combo")
                c_combo = obtener_precio_servicio_grupo(g, "combo", (config.precio_combo or 0), config)
                total_costo_combo = pax_combo * c_combo

                # Cuántos eventos combo tiene asignados este grupo
                num_combo_eventos = sum(
                    1 for a2 in asigs_grupo
                    if a2.fecha_evento and a2.fecha_evento.evento and a2.fecha_evento.evento.tipo in combo_tipos and not getattr(a2, "es_opcional", False)
                )
                combo_costo_por_evento = (total_costo_combo / num_combo_eventos) if num_combo_eventos > 0 else total_costo_combo
            # ─────────────────────────────────────────────────────────────────────────

            for a in asigs_grupo:
                if not a.fecha_evento:
                    print(f"ALERTA: Asignacion {a.id} sin fecha_evento")
                    continue
                
                tipo = a.fecha_evento.evento.tipo
                costo = 0

                # Si es disco opcional vendida, costo según precio_disco_opcional
                if getattr(a, "es_opcional", False) and tipo == "DISCO":
                    pax_opc = calcular_pax_cobrar(g, config.disco_liberados_ratio, config.disco_padres_gratis, config.disco_guias_gratis)
                    pax_opc = _aplicar_pagantes_override(pax_opc, g, "disco_opcional")
                    p_opc = obtener_precio_servicio_grupo(g, "disco_opcional", getattr(config, "precio_disco_opcional", 0) or 0, config)
                    costo = pax_opc * p_opc
                # Resolucion de combo (eventos incluidos en combo que no sean opcionales)
                elif config.es_combo and not getattr(a, "es_opcional", False):
                    if tipo in combo_tipos:
                        # Evento incluido en el combo → costo proporcional
                        costo = combo_costo_por_evento
                    else:
                        # Evento ADICIONAL fuera del combo → precio individual
                        es_adicional = False
                        precio_u = 0
                        s_key = None
                        
                        if tipo == "HIELO" and not config.combo_bar_hielo:
                            es_adicional = True
                            s_key = "hielo"
                            precio_u = config.precio_bar_hielo or 0
                        elif tipo == "CENA" and not config.combo_cena_velas:
                            es_adicional = True
                            s_key = "cena"
                            precio_u = config.precio_cena_velas or 0
                        elif tipo == "SURF" and not getattr(config, "combo_surf", False):
                            es_adicional = True
                            s_key = "surf"
                            precio_u = getattr(config, "precio_surf", 0) or 0
                        elif tipo == "UNIPRAIAS" and not getattr(config, "combo_unipraias", False):
                            es_adicional = True
                            s_key = "unipraias"
                            precio_u = getattr(config, "precio_unipraias", 0) or 0
                        elif tipo == "BETO" and not getattr(config, "combo_beto", False):
                            es_adicional = True
                            s_key = "beto"
                            precio_u = getattr(config, "precio_beto", 0) or 0
                        elif tipo == "BARCO" and not getattr(config, "combo_barco", False):
                            es_adicional = True
                            s_key = "barco"
                            precio_u = getattr(config, "precio_barco", 0) or 0
                        elif tipo == "CRISTO" and not getattr(config, "combo_cristo", False):
                            es_adicional = True
                            s_key = "cristo"
                            precio_u = getattr(config, "precio_cristo", 0) or 0
                        elif tipo == "SUNSET" and not getattr(config, "combo_sunset", False):
                            es_adicional = True
                            s_key = "sunset"
                            precio_u = getattr(config, "precio_sunset", 0) or 0
                        elif tipo == "QUINTA_COMIDA" and not getattr(config, "combo_quinta_comida", False):
                            es_adicional = True
                            s_key = "quinta_comida"
                            precio_u = getattr(config, "precio_quinta_comida", 0) or 0
                            
                        if es_adicional and s_key:
                            pax = _aplicar_pagantes_override((g.cantidad_pax or 0), g, s_key)
                            precio_u = obtener_precio_servicio_grupo(g, s_key, precio_u, config)
                            costo = pax * precio_u
                else:
                    # Sin combo: precios individuales
                    ratio, p_gratis, g_gratis = 0, False, False
                    precio_u = 0
                    s_key = None
                    
                    if tipo == "DISCO":
                        ratio, p_gratis, g_gratis = config.disco_liberados_ratio, config.disco_padres_gratis, config.disco_guias_gratis
                        precio_u = obtener_precio_servicio_grupo(g, "disco", config.precio_disco_individual or 0, config)
                        s_key = "disco"
                    elif tipo == "PARQUE":
                        ratio, p_gratis, g_gratis = config.parque_liberados_ratio, config.parque_padres_gratis, config.parque_guias_gratis
                        if g.parque_con_comida:
                            precio_u = obtener_precio_servicio_grupo(g, "parque_con_comida", (config.precio_parque_con_comida or 0) or (config.precio_parque_individual or 0), config)
                        else:
                            precio_u = obtener_precio_servicio_grupo(g, "parque_sin_comida", (config.precio_parque_sin_comida or 0) or (config.precio_parque_individual or 0), config)
                        s_key = "parque"
                    elif tipo == "CAMPAMENTO":
                        ratio, p_gratis, g_gratis = getattr(config, "campamento_liberados_ratio", 0), getattr(config, "campamento_padres_gratis", False), getattr(config, "campamento_guias_gratis", False)
                        if getattr(g, "campamento_con_comida", False):
                            precio_u = obtener_precio_servicio_grupo(g, "campamento_con_comida", (getattr(config, "precio_campamento_con_comida", 0) or 0) or (getattr(config, "precio_campamento_individual", 0) or 0), config)
                        else:
                            precio_u = obtener_precio_servicio_grupo(g, "campamento_sin_comida", (getattr(config, "precio_campamento_sin_comida", 0) or 0) or (getattr(config, "precio_campamento_individual", 0) or 0), config)
                        s_key = "campamento"
                    elif tipo == "ZACARIAS":
                        ratio, p_gratis, g_gratis = getattr(config, "zacarias_liberados_ratio", 0), getattr(config, "zacarias_padres_gratis", False), getattr(config, "zacarias_guias_gratis", False)
                        if getattr(g, "zacarias_con_comida", False):
                            precio_u = obtener_precio_servicio_grupo(g, "zacarias_con_comida", (getattr(config, "precio_zacarias_con_comida", 0) or 0) or (getattr(config, "precio_zacarias_individual", 0) or 0), config)
                        else:
                            precio_u = obtener_precio_servicio_grupo(g, "zacarias_sin_comida", (getattr(config, "precio_zacarias_sin_comida", 0) or 0) or (getattr(config, "precio_zacarias_individual", 0) or 0), config)
                        s_key = "zacarias"
                    elif tipo == "POOL":
                        ratio, p_gratis, g_gratis = config.pool_liberados_ratio, config.pool_padres_gratis, config.pool_guias_gratis
                        if g.pool_con_comida:
                            precio_u = obtener_precio_servicio_grupo(g, "pool_con_comida", (config.precio_pool_con_comida or 0) or (config.precio_pool_individual or 0), config)
                        else:
                            precio_u = obtener_precio_servicio_grupo(g, "pool_sin_comida", (config.precio_pool_sin_comida or 0) or (config.precio_pool_individual or 0), config)
                        s_key = "pool"
                    elif tipo == "CENA":
                        precio_u = obtener_precio_servicio_grupo(g, "cena", config.precio_cena_velas or 0, config)
                        s_key = "cena"
                    elif tipo == "HIELO":
                        precio_u = obtener_precio_servicio_grupo(g, "hielo", config.precio_bar_hielo or 0, config)
                        s_key = "hielo"
                    elif tipo == "SURF":
                        precio_u = obtener_precio_servicio_grupo(g, "surf", getattr(config, "precio_surf", 0) or 0, config)
                        s_key = "surf"
                    elif tipo == "UNIPRAIAS":
                        precio_u = obtener_precio_servicio_grupo(g, "unipraias", getattr(config, "precio_unipraias", 0) or 0, config)
                        s_key = "unipraias"
                    elif tipo == "BETO":
                        precio_u = obtener_precio_servicio_grupo(g, "beto", getattr(config, "precio_beto", 0) or 0, config)
                        s_key = "beto"
                    elif tipo == "BARCO":
                        precio_u = obtener_precio_servicio_grupo(g, "barco", getattr(config, "precio_barco", 0) or 0, config)
                        s_key = "barco"
                    elif tipo == "CRISTO":
                        precio_u = obtener_precio_servicio_grupo(g, "cristo", getattr(config, "precio_cristo", 0) or 0, config)
                        s_key = "cristo"
                    elif tipo == "SUNSET":
                        precio_u = obtener_precio_servicio_grupo(g, "sunset", getattr(config, "precio_sunset", 0) or 0, config)
                        s_key = "sunset"
                    elif tipo == "QUINTA_COMIDA":
                        precio_u = obtener_precio_servicio_grupo(g, "quinta_comida", getattr(config, "precio_quinta_comida", 0) or 0, config)
                        s_key = "quinta_comida"
                    
                    if s_key in ("disco", "parque", "campamento", "zacarias", "pool"):
                        pax = calcular_pax_cobrar(g, ratio, p_gratis, g_gratis)
                        pax = _aplicar_pagantes_override(pax, g, s_key)
                    else:
                        pax = _aplicar_pagantes_override((g.cantidad_pax or 0), g, s_key)
                        
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

def _get_pax_asignacion(a, grupo):
    if a.pax_asignados is not None and a.pax_asignados > 0:
        return a.pax_asignados
    if getattr(a, "es_opcional", False) and a.fecha_evento and a.fecha_evento.evento:
        tipo_u = (a.fecha_evento.evento.tipo or "").upper()
        TIPO_A_CAMPO_PAX = {
            "HIELO":         "pagantes_finales_hielo",
            "CENA":          "pagantes_finales_cena",
            "POOL":          "pagantes_finales_pool",
            "ZACARIAS":      "pagantes_finales_zacarias",
            "PARQUE":        "pagantes_finales_parque",
            "CAMPAMENTO":    "pagantes_finales_campamento",
            "SURF":          "pagantes_finales_surf",
            "UNIPRAIAS":     "pagantes_finales_unipraias",
            "BETO":          "pagantes_finales_beto",
            "BARCO":         "pagantes_finales_barco",
            "CRISTO":        "pagantes_finales_cristo",
            "SUNSET":        "pagantes_finales_sunset",
            "QUINTA_COMIDA": "pagantes_finales_quinta_comida",
            "MULTIPARQUE":   "pagantes_finales_multiparque",
            "DISCO":         "pagantes_finales_disco_opcional",
        }
        campo = TIPO_A_CAMPO_PAX.get(tipo_u)
        if campo:
            val = getattr(grupo, campo, None)
            if val is not None and val > 0:
                return val
    return (grupo.cantidad_pax if grupo else 0) or 0

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
    
    items = [{
        "id": a.id,
        "fecha": str(a.fecha_evento.fecha) if a.fecha_evento else "Sin fecha",
        "servicio": a.fecha_evento.evento.nombre if a.fecha_evento and a.fecha_evento.evento else "Sin servicio",
        "tipo": a.fecha_evento.evento.tipo if a.fecha_evento and a.fecha_evento.evento else "N/A",
        "pax": _get_pax_asignacion(a, grupo),
        "es_opcional": getattr(a, "es_opcional", False),
        "habilitado": habilitados.get(a.id, False),
        "voucher_usado": db.query(models.Voucher).filter(models.Voucher.asignacion_id == a.id).first().usado if db.query(models.Voucher).filter(models.Voucher.asignacion_id == a.id).first() else False,
        "voucher_fecha_uso": db.query(models.Voucher).filter(models.Voucher.asignacion_id == a.id).first().fecha_uso if db.query(models.Voucher).filter(models.Voucher.asignacion_id == a.id).first() else None,
        "es_comida": False,
    } for a in asignaciones]

    # Incluir comidas registradas para el grupo
    anotacion = db.query(models.AnotacionGrupo).filter(models.AnotacionGrupo.grupo_id == grupo_id).first()
    if anotacion:
        for c in anotacion.comidas:
            tipo_label = "Almuerzo" if (c.tipo_comida or "").lower() == "almuerzo" else ("Cena" if (c.tipo_comida or "").lower() == "cena" else (c.tipo_comida or "Comida").capitalize())
            items.append({
                "id": f"comida_{c.id}",
                "comida_id": c.id,
                "fecha": str(c.fecha) if c.fecha else "Sin fecha",
                "servicio": f"🍽️ {tipo_label} - {c.lugar or 'Restaurante'}",
                "tipo": "COMIDA",
                "pax": c.cant_pax if (c.cant_pax and c.cant_pax > 0) else (grupo.cantidad_pax or 0),
                "es_opcional": False,
                "habilitado": True,
                "voucher_usado": bool(c.usado),
                "voucher_fecha_uso": c.fecha_uso,
                "es_comida": True,
            })

    return items

@router.get("/asignaciones-empresa/{empresa_id}")
def get_asignaciones_empresa(empresa_id: int, db: Session = Depends(get_db)):
    """
    Devuelve todas las asignaciones de todos los grupos de una empresa,
    con su estado habilitado (igual estructura que /asignaciones/{grupo_id}).
    """
    empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    if not empresa:
        raise HTTPException(404, "Empresa no encontrada")

    grupos = db.query(models.Grupo).filter(models.Grupo.empresa_id == empresa_id).all()
    habilitados = get_asignaciones_pagadas(empresa_id, db)

    result = []
    for grupo in grupos:
        asignaciones = db.query(models.Asignacion).filter(models.Asignacion.grupo_id == grupo.id).all()
        for a in asignaciones:
            if not a.fecha_evento:
                continue
            v = db.query(models.Voucher).filter(models.Voucher.asignacion_id == a.id).first()
            result.append({
                "id": a.id,
                "grupo_id": grupo.id,
                "grupo_nombre": grupo.nombre,
                "fecha": str(a.fecha_evento.fecha) if a.fecha_evento else "Sin fecha",
                "servicio": a.fecha_evento.evento.nombre if a.fecha_evento and a.fecha_evento.evento else "Sin servicio",
                "tipo": a.fecha_evento.evento.tipo if a.fecha_evento and a.fecha_evento.evento else "N/A",
                "pax": _get_pax_asignacion(a, grupo),
                "es_opcional": getattr(a, "es_opcional", False),
                "habilitado": habilitados.get(a.id, False),
                "voucher_usado": v.usado if v else False,
                "voucher_fecha_uso": v.fecha_uso if v else None,
            })

    # Ordenar por fecha ascendente
    result.sort(key=lambda x: x["fecha"])
    return result


@router.get("/dashboard")
def get_dashboard(db: Session = Depends(get_db)):
    empresas = db.query(models.Empresa).join(models.Grupo).distinct().all()
    resumen_global = []
    
    for e in empresas:
        res = get_resumen_empresa(e.id, db)
        resumen_global.append({
            "id": e.id,
            "nombre": e.nombre,
            "moneda": res["moneda_liquidacion"],
            "tasa_cambio": res["tasa_cambio"],
            "total_venta": res["total_venta"],
            "total_venta_usd": res["total_venta_usd"],
            "total_venta_brl": res["total_venta_brl"],
            "total_pagado": res["total_pagado"],
            "total_pagado_usd": res["total_pagado_usd"],
            "total_pagado_brl": res["total_pagado_brl"],
            "saldo": res["saldo"],
            "saldo_brl_equivalente": res["saldo_brl_equivalente"],
            "saldo_usd_equivalente": res["saldo_usd_equivalente"],
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

@router.post("/migracion-nuevos-eventos")
def migracion_nuevos_eventos(db: Session = Depends(get_db)):
    # finanzas_empresa
    db.execute(text("ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS precio_surf INTEGER DEFAULT 0"))
    db.execute(text("ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS precio_unipraias INTEGER DEFAULT 0"))
    db.execute(text("ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS precio_beto INTEGER DEFAULT 0"))
    db.execute(text("ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS precio_barco INTEGER DEFAULT 0"))
    db.execute(text("ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS precio_cristo INTEGER DEFAULT 0"))
    db.execute(text("ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS precio_sunset INTEGER DEFAULT 0"))
    db.execute(text("ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS combo_surf BOOLEAN DEFAULT FALSE"))
    db.execute(text("ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS combo_unipraias BOOLEAN DEFAULT FALSE"))
    db.execute(text("ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS combo_beto BOOLEAN DEFAULT FALSE"))
    db.execute(text("ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS combo_barco BOOLEAN DEFAULT FALSE"))
    db.execute(text("ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS combo_cristo BOOLEAN DEFAULT FALSE"))
    db.execute(text("ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS combo_sunset BOOLEAN DEFAULT FALSE"))
    
    # grupos
    db.execute(text("ALTER TABLE grupos ADD COLUMN IF NOT EXISTS surf_acceso BOOLEAN DEFAULT FALSE"))
    db.execute(text("ALTER TABLE grupos ADD COLUMN IF NOT EXISTS unipraias_acceso BOOLEAN DEFAULT FALSE"))
    db.execute(text("ALTER TABLE grupos ADD COLUMN IF NOT EXISTS beto_acceso BOOLEAN DEFAULT FALSE"))
    db.execute(text("ALTER TABLE grupos ADD COLUMN IF NOT EXISTS barco_acceso BOOLEAN DEFAULT FALSE"))
    db.execute(text("ALTER TABLE grupos ADD COLUMN IF NOT EXISTS cristo_acceso BOOLEAN DEFAULT FALSE"))
    db.execute(text("ALTER TABLE grupos ADD COLUMN IF NOT EXISTS sunset_acceso BOOLEAN DEFAULT FALSE"))
    db.execute(text("ALTER TABLE grupos ADD COLUMN IF NOT EXISTS pagantes_finales_surf INTEGER"))
    db.execute(text("ALTER TABLE grupos ADD COLUMN IF NOT EXISTS pagantes_finales_unipraias INTEGER"))
    db.execute(text("ALTER TABLE grupos ADD COLUMN IF NOT EXISTS pagantes_finales_beto INTEGER"))
    db.execute(text("ALTER TABLE grupos ADD COLUMN IF NOT EXISTS pagantes_finales_barco INTEGER"))
    db.execute(text("ALTER TABLE grupos ADD COLUMN IF NOT EXISTS pagantes_finales_cristo INTEGER"))
    db.execute(text("ALTER TABLE grupos ADD COLUMN IF NOT EXISTS pagantes_finales_sunset INTEGER"))
    
    db.commit()
    return {"ok": True}

@router.post("/migracion-quinta-comida")
def migracion_quinta_comida(db: Session = Depends(get_db)):
    """Migración para agregar el servicio 'Quinta Comida' a la base de datos."""
    comandos = [
        "ALTER TABLE grupos ADD COLUMN IF NOT EXISTS quinta_comida_acceso BOOLEAN DEFAULT FALSE",
        "ALTER TABLE grupos ADD COLUMN IF NOT EXISTS pagantes_finales_quinta_comida INTEGER",
        "ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS precio_quinta_comida INTEGER DEFAULT 0",
        "ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS combo_quinta_comida BOOLEAN DEFAULT FALSE",
    ]
    resultados = []
    for c in comandos:
        try:
            db.execute(text(c))
            resultados.append({"sql": c, "status": "ok"})
        except Exception as e:
            resultados.append({"sql": c, "status": "skip", "error": str(e)})
    db.commit()
    return {"ok": True, "resultados": resultados}


@router.post("/migracion-multiparque")
def migracion_multiparque(db: Session = Depends(get_db)):
    """Migración para agregar el servicio 'Multiparque' a la base de datos."""
    comandos = [
        "ALTER TABLE grupos ADD COLUMN IF NOT EXISTS multiparque_acceso BOOLEAN DEFAULT FALSE",
        "ALTER TABLE grupos ADD COLUMN IF NOT EXISTS pagantes_finales_multiparque INTEGER",
        "ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS precio_multiparque INTEGER DEFAULT 0",
        "ALTER TABLE finanzas_empresa ADD COLUMN IF NOT EXISTS combo_multiparque BOOLEAN DEFAULT FALSE",
    ]
    resultados = []
    for c in comandos:
        try:
            db.execute(text(c))
            resultados.append({"sql": c, "status": "ok"})
        except Exception as e:
            resultados.append({"sql": c, "status": "skip", "error": str(e)})
    db.commit()
    return {"ok": True, "resultados": resultados}

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
    valid_servicios = {"disco", "parque", "campamento", "zacarias", "pool", "cena", "hielo", "combo", "surf", "unipraias", "beto", "barco", "cristo", "sunset", "quinta_comida", "multiparque", "disco_opcional"}
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
        elif servicio == "campamento":
            grupo.pagantes_finales_campamento = pagantes
        elif servicio == "zacarias":
            grupo.pagantes_finales_zacarias = pagantes
        elif servicio == "pool":
            grupo.pagantes_finales_pool = pagantes
        elif servicio == "cena":
            grupo.pagantes_finales_cena = pagantes
        elif servicio == "hielo":
            grupo.pagantes_finales_hielo = pagantes
        elif servicio == "combo":
            grupo.pagantes_finales_combo = pagantes
        elif servicio == "surf":
            grupo.pagantes_finales_surf = pagantes
        elif servicio == "unipraias":
            grupo.pagantes_finales_unipraias = pagantes
        elif servicio == "beto":
            grupo.pagantes_finales_beto = pagantes
        elif servicio == "barco":
            grupo.pagantes_finales_barco = pagantes
        elif servicio == "cristo":
            grupo.pagantes_finales_cristo = pagantes
        elif servicio == "sunset":
            grupo.pagantes_finales_sunset = pagantes
        elif servicio == "quinta_comida":
            grupo.pagantes_finales_quinta_comida = pagantes
        elif servicio == "multiparque":
            grupo.pagantes_finales_multiparque = pagantes
        elif servicio == "disco_opcional":
            grupo.pagantes_finales_disco_opcional = pagantes
    db.commit()
    db.refresh(grupo)
    return {"ok": True, "pagantes_finales": pagantes, "servicio": servicio}
