import os
import tempfile

from fastapi import APIRouter, Depends, HTTPException, Response, BackgroundTasks
from fastapi.responses import JSONResponse, FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
import models
import secrets
import qrcode
import io
from datetime import datetime, date, time, timedelta
from zoneinfo import ZoneInfo
from typing import Optional
from PIL import Image, ImageDraw, ImageFont
from openpyxl import Workbook

router = APIRouter(prefix="/vouchers", tags=["Vouchers"])
BALNEARIO_TZ = ZoneInfo("America/Sao_Paulo")

WINDOW_CONFIG = {
    "DISCO": {"start": time(22, 0), "end": time(6, 0), "offset_days": 1},
    "PARQUE": {"start": time(8, 0), "end": time(18, 0), "offset_days": 0},
    "CAMPAMENTO": {"start": time(8, 0), "end": time(18, 0), "offset_days": 0},
    "ZACARIAS": {"start": time(8, 0), "end": time(18, 0), "offset_days": 0},
    "BIENVENIDA": {"start": time(9, 0), "end": time(21, 0), "offset_days": 0},
    "POOL": {"start": time(10, 0), "end": time(18, 0), "offset_days": 0},
    "CENA": {"start": time(20, 0), "end": time(23, 30), "offset_days": 0},
}


def _cleanup_file(path: str):
    try:
        os.remove(path)
    except OSError:
        pass


def build_event_window(fecha_evento: models.FechaEvento):
    config = WINDOW_CONFIG.get((fecha_evento.evento.tipo or "").upper(), None)
    if not config:
        config = {"start": time(0, 0), "end": time(23, 59), "offset_days": 0}

    inicio_dt = datetime.combine(fecha_evento.fecha, config["start"], tzinfo=BALNEARIO_TZ)
    fin_dt = datetime.combine(
        fecha_evento.fecha + timedelta(days=config["offset_days"]),
        config["end"],
        tzinfo=BALNEARIO_TZ
    )
    etiqueta = f"{inicio_dt.strftime('%d/%m %H:%M')} - {fin_dt.strftime('%d/%m %H:%M')} {inicio_dt.tzname()}"
    return inicio_dt, fin_dt, etiqueta


@router.get("/agenda")
def listar_eventos_para_validacion(
    fecha: Optional[date] = None,
    db: Session = Depends(get_db)
):
    referencia = fecha or datetime.now(BALNEARIO_TZ).date()
    ventana_inicio = referencia - timedelta(days=1)
    ventana_fin = referencia + timedelta(days=1)

    dia_inicio = datetime.combine(referencia, time.min, tzinfo=BALNEARIO_TZ)
    dia_fin = dia_inicio + timedelta(days=1)

    fechas_evento = (
        db.query(models.FechaEvento)
        .join(models.Evento)
        .filter(models.FechaEvento.fecha >= ventana_inicio)
        .filter(models.FechaEvento.fecha <= ventana_fin)
        .order_by(models.FechaEvento.fecha, models.Evento.tipo)
        .all()
    )

    respuesta = []
    for f in fechas_evento:
        inicio_dt, fin_dt, etiqueta = build_event_window(f)
        if fin_dt <= dia_inicio or inicio_dt >= dia_fin:
            continue
        respuesta.append({
            "fecha_evento_id": f.id,
            "fecha": str(f.fecha),
            "evento": {
                "id": f.evento.id,
                "nombre": f.evento.nombre,
                "tipo": f.evento.tipo
            },
            "tematica": f.tematica.nombre if f.tematica else None,
            "con_alcohol": f.con_alcohol,
            "ventana": {
                "inicio": inicio_dt.isoformat(),
                "fin": fin_dt.isoformat(),
                "label": etiqueta
            }
        })

    return respuesta

def generate_unique_token(db: Optional[Session] = None):
    while True:
        token = secrets.token_urlsafe(16)
        if not db:
            return token
        exists = db.query(models.Voucher.id).filter(models.Voucher.token == token).first()
        if not exists:
            return token


def obtener_pax_voucher(asignacion: models.Asignacion) -> int:
    """Retorna la cantidad exacta de PAX que corresponde a este voucher.
    Si la asignación tiene pax_asignados explícitos (ej: opcional vendido para 30 pax),
    retorna esa cantidad. Si no, busca el pagantes_finales del grupo para ese servicio.
    Por defecto retorna grupo.cantidad_pax.
    """
    if asignacion.pax_asignados and asignacion.pax_asignados > 0:
        return asignacion.pax_asignados

    grupo = asignacion.grupo
    if not grupo:
        return 0

    if getattr(asignacion, "es_opcional", False):
        tipo = ""
        if asignacion.fecha_evento and asignacion.fecha_evento.evento:
            tipo = (asignacion.fecha_evento.evento.tipo or "").upper()

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
        campo = TIPO_A_CAMPO_PAX.get(tipo)
        if campo:
            val = getattr(grupo, campo, None)
            if val is not None and val > 0:
                return val

    return grupo.cantidad_pax or 0

# =========================================================
# GET VOUCHERS POR EMPRESA (portal publico por codigo)
# =========================================================
@router.get("/empresa/{codigo_acceso}")
def vouchers_por_empresa(codigo_acceso: str, db: Session = Depends(get_db)):
    from .finanzas import get_asignaciones_pagadas
    from sqlalchemy import func as sqlfunc

    codigo_norm = codigo_acceso.strip().lower()
    empresa = db.query(models.Empresa).filter(
        sqlfunc.lower(models.Empresa.codigo_acceso) == codigo_norm
    ).first()

    link_personalizado = None
    empresas = []

    if empresa:
        empresas = [empresa]
    else:
        link_personalizado = db.query(models.LinkPersonalizado).filter(
            sqlfunc.lower(models.LinkPersonalizado.token) == codigo_norm,
            models.LinkPersonalizado.activo == True
        ).first()
        if link_personalizado:
            if not link_personalizado.incluir_vouchers:
                raise HTTPException(403, "Este link personalizado no tiene acceso a los vouchers")
            
            if link_personalizado.empresas_ids:
                if link_personalizado.empresas_ids.strip() == "*":
                    empresas = db.query(models.Empresa).order_by(models.Empresa.nombre.asc()).all()
                else:
                    emp_ids = [int(x.strip()) for x in link_personalizado.empresas_ids.split(",") if x.strip().isdigit()]
                    if emp_ids:
                        empresas = db.query(models.Empresa).filter(models.Empresa.id.in_(emp_ids)).order_by(models.Empresa.nombre.asc()).all()
            if not empresas and link_personalizado.empresa_id:
                emp = db.get(models.Empresa, link_personalizado.empresa_id)
                if emp:
                    empresas = [emp]

    if not empresas:
        raise HTTPException(404, "Codigo de acceso invalido")

    servicios_permitidos = None
    grupos_permitidos_ids = None
    if link_personalizado:
        if link_personalizado.servicios_permitidos:
            servicios_permitidos = set(s.strip().upper() for s in link_personalizado.servicios_permitidos.split(",") if s.strip())
        if link_personalizado.grupos_permitidos:
            grupos_permitidos_ids = set(int(x.strip()) for x in link_personalizado.grupos_permitidos.split(",") if x.strip().isdigit())

    ayer = datetime.now(BALNEARIO_TZ).date() - timedelta(days=1)
    resultado = []

    for emp in empresas:
        try:
            habilitados = get_asignaciones_pagadas(emp.id, db)
        except Exception:
            habilitados = {}

        grupos_a_procesar = emp.grupos
        if grupos_permitidos_ids:
            grupos_a_procesar = [g for g in grupos_a_procesar if g.id in grupos_permitidos_ids]

        for grupo in grupos_a_procesar:
            for asig in grupo.asignaciones:
                if not asig.fecha_evento:
                    continue
                if not habilitados.get(asig.id, False):
                    continue
                
                fecha_evento = asig.fecha_evento
                evento = fecha_evento.evento
                if not evento:
                    continue

                if servicios_permitidos is not None and (evento.tipo or "").upper() not in servicios_permitidos:
                    continue

                fecha = fecha_evento.fecha
                if fecha and fecha < ayer:
                    continue

                voucher = (
                    db.query(models.Voucher)
                    .filter(models.Voucher.asignacion_id == asig.id, models.Voucher.usado == False)
                    .first()
                )
                if not voucher:
                    voucher = (
                        db.query(models.Voucher)
                        .filter(models.Voucher.asignacion_id == asig.id)
                        .order_by(models.Voucher.id.desc())
                        .first()
                    )
                if not voucher:
                    nuevo_token = generate_unique_token(db)
                    voucher = models.Voucher(
                        token=nuevo_token,
                        asignacion_id=asig.id,
                        usado=False
                    )
                    db.add(voucher)
                    db.commit()
                    db.refresh(voucher)

                tipo_upper = (evento.tipo or "").upper()
                nombre_lower = (evento.nombre or "").lower()

                comida_label = None
                if tipo_upper == "PARQUE":
                    comida_label = "Con comida" if grupo.parque_con_comida else "Sin comida"
                elif tipo_upper == "CAMPAMENTO":
                    comida_label = "Con comida" if getattr(grupo, "campamento_con_comida", False) else "Sin comida"
                elif tipo_upper == "ZACARIAS":
                    comida_label = "Con comida" if getattr(grupo, "zacarias_con_comida", False) else "Sin comida"
                elif tipo_upper in {"POOL", "CASCATA"} or "cascata" in nombre_lower:
                    comida_label = "Con comida" if grupo.pool_con_comida else "Sin comida"

                pax_voucher = obtener_pax_voucher(asig)

                resultado.append({
                    "asignacion_id": asig.id,
                    "token": voucher.token,
                    "voucher_id": voucher.id,
                    "usado": voucher.usado,
                    "fecha_uso": voucher.fecha_uso if voucher.usado else None,
                    "evento": evento.nombre,
                    "tipo": evento.tipo,
                    "fecha": str(fecha),
                    "tematica": fecha_evento.tematica.nombre if fecha_evento.tematica else None,
                    "con_alcohol": fecha_evento.con_alcohol,
                    "empresa": emp.nombre,
                    "grupo": grupo.nombre,
                    "pax": pax_voucher,
                    "es_opcional": bool(getattr(asig, "es_opcional", False)),
                    "comida": comida_label,
                })

    resultado.sort(key=lambda x: x["fecha"])

    # ── Almuerzos / Cenas (comidas en restaurante) ──────────────────────────
    comidas_resultado = []
    for emp in empresas:
        grupos_a_procesar = emp.grupos
        if grupos_permitidos_ids:
            grupos_a_procesar = [g for g in grupos_a_procesar if g.id in grupos_permitidos_ids]

        for grupo in grupos_a_procesar:
            anotacion = db.query(models.AnotacionGrupo).filter(
                models.AnotacionGrupo.grupo_id == grupo.id
            ).first()
            if not anotacion:
                continue
            for comida in anotacion.comidas:
                # Asegurar token y voucher
                if not comida.token:
                    import secrets as _sec
                    comida.token = _sec.token_urlsafe(16)
                    db.commit()
                v_comida = db.query(models.Voucher).filter(
                    models.Voucher.comida_id == comida.id
                ).first()
                if not v_comida:
                    v_comida = models.Voucher(
                        token=comida.token,
                        comida_id=comida.id,
                        asignacion_id=None,
                        usado=False
                    )
                    db.add(v_comida)
                    db.commit()

                comidas_resultado.append({
                    "comida_id": comida.id,
                    "token": comida.token,
                    "voucher_id": v_comida.id,
                    "usado": bool(comida.usado),
                    "fecha_uso": comida.fecha_uso if comida.usado else None,
                    "tipo_comida": comida.tipo_comida,
                    "lugar": comida.lugar,
                    "fecha": str(comida.fecha) if comida.fecha else None,
                    "hora": comida.hora,
                    "cant_pax": comida.cant_pax,
                    "empresa": emp.nombre,
                    "grupo": grupo.nombre,
                })

    comidas_resultado.sort(key=lambda x: x["fecha"] or "")

    nombre_empresa_display = empresas[0].nombre if len(empresas) == 1 else ("Todas las empresas" if (link_personalizado and link_personalizado.empresas_ids == "*") else f"{len(empresas)} Empresas")

    return {
        "empresa": nombre_empresa_display,
        "codigo": codigo_acceso,
        "es_personalizado": bool(link_personalizado),
        "nombre_link": link_personalizado.nombre if link_personalizado else None,
        "vouchers": resultado,
        "comidas": comidas_resultado,
    }


@router.get("/generate/{asignacion_id}")
def generate_voucher(asignacion_id: int, db: Session = Depends(get_db)):
    from .finanzas import get_asignaciones_pagadas
    
    asignacion = db.query(models.Asignacion).filter(models.Asignacion.id == asignacion_id).first()
    if not asignacion:
        raise HTTPException(404, "Asignación no encontrada")
    
    # VERIFICAR PAGO
    habilitados = get_asignaciones_pagadas(asignacion.grupo.empresa_id, db)
    if not habilitados.get(asignacion_id, False):
        raise HTTPException(403, "Voucher bloqueado por falta de pago")
    
    grupo = asignacion.grupo
    fecha_evento = asignacion.fecha_evento
    evento = fecha_evento.evento
    fecha = fecha_evento.fecha
    empresa = grupo.empresa

    # Buscar si ya existe un voucher no usado
    voucher = db.query(models.Voucher).filter(models.Voucher.asignacion_id == asignacion_id, models.Voucher.usado == False).first()
    
    if not voucher:
        token = generate_unique_token()
        voucher = models.Voucher(token=token, asignacion_id=asignacion_id)
        db.add(voucher)
        db.commit()
        db.refresh(voucher)
    
    qr_data = voucher.token
    
    # GENERAR QR
    qr = qrcode.QRCode(version=1, box_size=6, border=2)
    qr.add_data(qr_data)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    
    # DISEÑAR VOUCHER (800x300)
    width, height = 800, 300
    color_bg = (255, 255, 255)    # Blanco para ahorrar tinta
    color_accent = (37, 99, 235) # #2563eb (Blue)
    color_text = (15, 23, 42)    # #0f172a (Dark Slate)
    color_label = (100, 116, 139) # #64748b (Slate 500)
    
    img = Image.new('RGB', (width, height), color=color_bg)
    draw = ImageDraw.Draw(img)
    
    # Decoración (Rectángulo de acento lateral)
    draw.rectangle([0, 0, 15, height], fill=color_accent)
    
    # Texto: Camboriú Estudiantil
    # Intentar cargar fuentes (Arial en Windows, DejaVuSans en Linux/Render)
    try:
        # Rutas comunes en Linux para DejaVuSans
        font_paths = [
            "arial.ttf", 
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
        ]
        
        def load_font(size):
            for path in font_paths:
                try:
                    return ImageFont.truetype(path, size)
                except:
                    continue
            return ImageFont.load_default()

        font_main = load_font(36)
        font_sub = load_font(20)
        font_label = load_font(16)
    except:
        font_main = ImageFont.load_default()
        font_sub = ImageFont.load_default()
        font_label = ImageFont.load_default()
    
    # Encabezado
    draw.text((40, 30), "CAMBORIÚ ESTUDIANTIL", fill=color_accent, font=font_main)
    draw.line([40, 75, 500, 75], fill=color_accent, width=2)
    
    # Detalles
    draw.text((40, 100), "EMPRESA / GRUPO:", fill=color_label, font=font_label)
    draw.text((40, 120), f"{empresa.nombre} - {grupo.nombre}", fill=color_text, font=font_sub)
    
    draw.text((40, 160), "SERVICIO:", fill=color_label, font=font_label)
    
    horario_val = getattr(fecha_evento, "horario", None)
    servicio_desc = f"{evento.nombre}"
    if horario_val:
        servicio_desc += f" ({horario_val})"
        
    draw.text((40, 180), servicio_desc, fill=color_text, font=font_sub)

    tipo_upper = (evento.tipo or "").upper()
    nombre_lower = (evento.nombre or "").lower()
    comida_label = None
    if tipo_upper == "PARQUE":
        comida_label = "CON COMIDA" if grupo.parque_con_comida else "SIN COMIDA"
    elif tipo_upper == "CAMPAMENTO":
        comida_label = "CON COMIDA" if getattr(grupo, "campamento_con_comida", False) else "SIN COMIDA"
    elif tipo_upper == "ZACARIAS":
        comida_label = "CON COMIDA" if getattr(grupo, "zacarias_con_comida", False) else "SIN COMIDA"
    elif tipo_upper in {"POOL", "CASCATA"} or "cascata" in nombre_lower:
        comida_label = "CON COMIDA" if grupo.pool_con_comida else "SIN COMIDA"

    pax_voucher = obtener_pax_voucher(asignacion)
    es_opcional = bool(getattr(asignacion, "es_opcional", False))

    fecha_y_label = 220
    fecha_y_value = 240
    if comida_label:
        draw.text((40, 200), "ACCESO:", fill=color_label, font=font_label)
        draw.text((40, 220), comida_label, fill=color_text, font=font_sub)
        fecha_y_label = 250
        fecha_y_value = 270

    label_pax = "FECHA / PAX:" if not es_opcional else "FECHA / PAX (OPCIONAL VENDIDO):"
    texto_pax = f"{fecha} - {pax_voucher} PAX"
    if es_opcional:
        texto_pax += " [OPCIONAL]"

    draw.text((40, fecha_y_label), label_pax, fill=(234, 88, 12) if es_opcional else color_label, font=font_label)
    draw.text((40, fecha_y_value), texto_pax, fill=(234, 88, 12) if es_opcional else color_text, font=font_sub)
    
    # Estética (ID en gris suave)
    draw.text((550, 20), f"ID: {voucher.token[:8].upper()}", fill=color_label, font=font_label)
    
    # Pegar QR
    # Centrar QR verticalmente a la derecha
    qr_side = 220
    qr_img = qr_img.resize((qr_side, qr_side))
    img.paste(qr_img, (540, 40))
    
    # Borde exterior suave
    draw.rectangle([0, 0, width-1, height-1], outline=(51, 65, 85), width=2)
    
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_byte_arr = img_byte_arr.getvalue()
    
    return Response(content=img_byte_arr, media_type="image/png")


# =========================================================
# GET / GENERATE VOUCHER IMAGEN PARA COMIDA (Almuerzo / Cena)
# =========================================================
@router.get("/comida/{comida_id}")
def generate_voucher_comida(comida_id: int, db: Session = Depends(get_db)):
    comida = db.query(models.ComidaGrupo).filter(models.ComidaGrupo.id == comida_id).first()
    if not comida:
        raise HTTPException(404, "Comida no encontrada")

    anotacion = comida.anotacion
    grupo = anotacion.grupo if anotacion else None
    empresa = grupo.empresa if grupo else None

    # Generar token si no tiene
    if not comida.token:
        import secrets
        comida.token = secrets.token_urlsafe(16)
        db.commit()

    # Crear/sincronizar voucher si no existe
    voucher_comida = db.query(models.Voucher).filter(models.Voucher.comida_id == comida.id).first()
    if not voucher_comida:
        voucher_comida = models.Voucher(
            token=comida.token,
            comida_id=comida.id,
            asignacion_id=None,
            usado=False
        )
        db.add(voucher_comida)
        db.commit()

    # GENERAR QR
    qr = qrcode.QRCode(version=1, box_size=6, border=2)
    qr.add_data(comida.token)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")

    # DISEÑAR VOUCHER (800x340) — estilo consistente con el existente
    width, height = 800, 340
    color_bg = (255, 255, 255)
    color_accent = (30, 58, 95)   # #1e3a5f (azul marino del sistema)
    color_green = (22, 163, 74)   # verde para almuerzo
    color_indigo = (67, 56, 202)  # índigo para cena
    color_text = (15, 23, 42)
    color_label = (100, 116, 139)

    tipo_lower = (comida.tipo_comida or "").lower()
    if tipo_lower == "almuerzo":
        color_tipo = color_green
        icono_tipo = "ALMUERZO"
    elif tipo_lower == "cena":
        color_tipo = color_indigo
        icono_tipo = "CENA"
    else:
        color_tipo = color_accent
        icono_tipo = (comida.tipo_comida or "COMIDA").upper()

    img = Image.new('RGB', (width, height), color=color_bg)
    draw = ImageDraw.Draw(img)

    # Banda lateral de color
    draw.rectangle([0, 0, 15, height], fill=color_tipo)

    # Cargar fuentes
    try:
        font_paths = [
            "arial.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
        ]
        def load_font(size):
            for path in font_paths:
                try:
                    return ImageFont.truetype(path, size)
                except:
                    continue
            return ImageFont.load_default()
        font_main = load_font(34)
        font_sub  = load_font(20)
        font_label = load_font(15)
        font_tipo  = load_font(26)
    except:
        font_main = font_sub = font_label = font_tipo = ImageFont.load_default()

    # Encabezado
    draw.text((40, 22), "CAMBORIÚ ESTUDIANTIL", fill=color_accent, font=font_main)
    draw.line([40, 65, 510, 65], fill=color_tipo, width=2)

    # Badge de tipo (almuerzo / cena / desayuno)
    draw.rectangle([40, 72, 180, 100], fill=color_tipo)
    draw.text((50, 76), icono_tipo, fill=(255, 255, 255), font=font_label)

    # Empresa / Grupo
    nombre_empresa = empresa.nombre if empresa else "—"
    nombre_grupo   = grupo.nombre   if grupo   else "—"
    draw.text((40, 110), "EMPRESA / GRUPO:", fill=color_label, font=font_label)
    draw.text((40, 128), f"{nombre_empresa}  —  {nombre_grupo}", fill=color_text, font=font_sub)

    # Restaurante
    lugar_txt = comida.lugar or "—"
    draw.text((40, 162), "RESTAURANTE:", fill=color_label, font=font_label)
    draw.text((40, 180), lugar_txt, fill=color_tipo, font=font_sub)

    # Fecha y hora
    fecha_txt = comida.fecha or "—"
    hora_txt  = comida.hora or ""
    fecha_hora = f"{fecha_txt}  {hora_txt}".strip()
    draw.text((40, 215), "FECHA / HORA:", fill=color_label, font=font_label)
    draw.text((40, 233), fecha_hora, fill=color_text, font=font_sub)

    # PAX
    pax_txt = f"{comida.cant_pax} PAX" if comida.cant_pax else "—"
    draw.text((40, 268), "PAGANTES:", fill=color_label, font=font_label)
    draw.text((40, 286), pax_txt, fill=color_text, font=font_sub)

    # Token ID (esquina superior derecha)
    token_short = (comida.token or "")[:8].upper()
    draw.text((550, 18), f"ID: {token_short}", fill=color_label, font=font_label)

    # Pegar QR
    qr_side = 220
    qr_img = qr_img.resize((qr_side, qr_side))
    img.paste(qr_img, (540, 60))

    # Borde exterior
    draw.rectangle([0, 0, width - 1, height - 1], outline=(51, 65, 85), width=2)

    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_byte_arr = img_byte_arr.getvalue()

    return Response(content=img_byte_arr, media_type="image/png")


@router.post("/comida/validate")
def validate_voucher_comida(token_data: dict, db: Session = Depends(get_db)):
    """Valida y marca como usado un voucher de comida (almuerzo / cena)."""
    token = token_data.get("token")
    if not token:
        raise HTTPException(400, "Token requerido")

    comida = db.query(models.ComidaGrupo).filter(models.ComidaGrupo.token == token).first()
    if not comida:
        return JSONResponse({"status": "error", "message": "Voucher inválido"}, status_code=404)

    if comida.usado:
        return JSONResponse(
            {"status": "error", "message": f"Voucher ya fue usado el {comida.fecha_uso}"},
            status_code=400
        )

    fecha_uso_str = datetime.now(BALNEARIO_TZ).isoformat()
    comida.usado = True
    comida.fecha_uso = fecha_uso_str

    # Sincronizar el Voucher asociado
    v = db.query(models.Voucher).filter(models.Voucher.comida_id == comida.id).first()
    if v:
        v.usado = True
        v.fecha_uso = fecha_uso_str

    db.commit()

    anotacion = comida.anotacion
    grupo = anotacion.grupo if anotacion else None
    empresa = grupo.empresa if grupo else None

    return {
        "status": "success",
        "message": "Voucher de comida validado con éxito",
        "detalle": {
            "tipo": comida.tipo_comida,
            "fecha": comida.fecha,
            "hora": comida.hora,
            "lugar": comida.lugar,
            "cant_pax": comida.cant_pax,
            "empresa": empresa.nombre if empresa else None,
            "grupo": grupo.nombre if grupo else None,
        }
    }


@router.get("/qr/{asignacion_id}")
def get_qr_only(asignacion_id: int, db: Session = Depends(get_db)):
    from .finanzas import get_asignaciones_pagadas

    asignacion = db.query(models.Asignacion).filter(models.Asignacion.id == asignacion_id).first()
    if not asignacion:
        raise HTTPException(404, "Asignacion no encontrada")

    habilitados = get_asignaciones_pagadas(asignacion.grupo.empresa_id, db)
    if not habilitados.get(asignacion_id, False):
        raise HTTPException(403, "Voucher bloqueado por falta de pago")

    voucher = db.query(models.Voucher).filter(
        models.Voucher.asignacion_id == asignacion_id,
        models.Voucher.usado == False
    ).first()
    if not voucher:
        token = generate_unique_token()
        voucher = models.Voucher(token=token, asignacion_id=asignacion_id)
        db.add(voucher)
        db.commit()
        db.refresh(voucher)

    qr = qrcode.QRCode(version=1, box_size=10, border=3)
    qr.add_data(voucher.token)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white")

    img_byte_arr = io.BytesIO()
    qr_img.save(img_byte_arr, format="PNG")
    img_byte_arr = img_byte_arr.getvalue()

    return Response(content=img_byte_arr, media_type="image/png")

def parse_fecha_uso(raw: str | None):
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        pass
    formatos = ["%Y-%m-%d %H:%M:%S %Z", "%Y-%m-%d %H:%M:%S"]
    for fmt in formatos:
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    return None


@router.post("/validate")
def validate_voucher(token_data: dict, db: Session = Depends(get_db)):
    token = token_data.get("token")
    if not token:
        raise HTTPException(400, "Token requerido")

    fecha_evento_id = token_data.get("fecha_evento_id")
    if not fecha_evento_id:
        raise HTTPException(400, "Debe seleccionar un evento antes de validar")

    fecha_evento_seleccionada = db.get(models.FechaEvento, fecha_evento_id)
    if not fecha_evento_seleccionada:
        raise HTTPException(404, "Evento seleccionado no existe")
        
    voucher = db.query(models.Voucher).filter(models.Voucher.token == token).first()
    if not voucher:
        return JSONResponse({"status": "error", "message": "Voucher Inválido"}, status_code=404)
        
    if voucher.usado:
        return JSONResponse({"status": "error", "message": f"Voucher ya fue usado el {voucher.fecha_uso}"}, status_code=400)
    
    asig = voucher.asignacion

    if asig.fecha_evento_id != fecha_evento_seleccionada.id:
        fecha_correcta = asig.fecha_evento
        _, _, etiqueta = build_event_window(fecha_correcta)
        return JSONResponse({
            "status": "error",
            "message": f"Este voucher corresponde a {fecha_correcta.evento.nombre} el {fecha_correcta.fecha} ({etiqueta}).",
            "detalle": {
                "servicio": fecha_correcta.evento.nombre,
                "fecha": str(fecha_correcta.fecha),
                "ventana": etiqueta
            }
        }, status_code=400)

    inicio_dt, fin_dt, etiqueta = build_event_window(asig.fecha_evento)
    pax_val = obtener_pax_voucher(asig)
    es_opc = bool(getattr(asig, "es_opcional", False))

    res_detalle = {
        "status": "success",
        "message": "Voucher validado con éxito",
        "detalle": {
            "empresa": asig.grupo.empresa.nombre if asig.grupo and asig.grupo.empresa else None,
            "grupo": asig.grupo.nombre,
            "servicio": asig.fecha_evento.evento.nombre,
            "fecha": str(asig.fecha_evento.fecha),
            "es_opcional": es_opc,
            "pax_total_voucher": pax_val,
            "estructura_grupo": {
                "pax": pax_val if es_opc else (asig.grupo.cantidad_estudiantes or 0),
                "padres": 0 if es_opc else (asig.grupo.cantidad_padres or 0),
                "guias": 0 if es_opc else (asig.grupo.cantidad_guias or 0),
                "es_opcional": es_opc
            },
            "ventana": {
                "inicio": inicio_dt.isoformat(),
                "fin": fin_dt.isoformat(),
                "label": etiqueta
            }
        }
    }

    # Marcar como usado
    voucher.usado = True
    voucher.fecha_uso = datetime.now(BALNEARIO_TZ).isoformat()
    db.commit()
    
    return res_detalle


@router.get("/reporte")
def reporte_vouchers(
    desde: date | None = None,
    hasta: date | None = None,
    evento_id: int | None = None,
    empresa_id: int | None = None,
    db: Session = Depends(get_db)
):
    base_query = (
        db.query(models.Voucher)
        .join(models.Asignacion)
        .join(models.FechaEvento)
        .join(models.Evento)
        .join(models.Grupo)
        .join(models.Empresa)
        .filter(models.Voucher.usado == True)
        .filter(models.Voucher.fecha_uso.isnot(None))
    )

    if evento_id:
        base_query = base_query.filter(models.FechaEvento.evento_id == evento_id)

    if empresa_id:
        base_query = base_query.filter(models.Grupo.empresa_id == empresa_id)

    if desde:
        base_query = base_query.filter(func.substr(models.Voucher.fecha_uso, 1, 10) >= desde.isoformat())
    if hasta:
        base_query = base_query.filter(func.substr(models.Voucher.fecha_uso, 1, 10) <= hasta.isoformat())

    base_query = base_query.order_by(models.Voucher.fecha_uso.desc())

    resultados = []
    for voucher in base_query.all():
        asignacion = voucher.asignacion
        if not asignacion or not asignacion.grupo or not asignacion.fecha_evento:
            continue

        grupo = asignacion.grupo
        empresa = grupo.empresa
        fecha_evento = asignacion.fecha_evento
        evento = fecha_evento.evento

        scan_dt = parse_fecha_uso(voucher.fecha_uso)
        scan_fecha = scan_dt.date().isoformat() if scan_dt else None
        scan_hora = scan_dt.strftime("%H:%M:%S") if scan_dt else None

        pax_voucher_val = obtener_pax_voucher(asignacion)
        es_opc_val = bool(getattr(asignacion, "es_opcional", False))

        resultados.append({
            "voucher_id": voucher.id,
            "token": voucher.token,
            "scan_fecha": scan_fecha,
            "scan_hora": scan_hora,
            "fecha_evento": str(fecha_evento.fecha),
            "evento": evento.nombre if evento else None,
            "evento_tipo": evento.tipo if evento else None,
            "empresa": empresa.nombre if empresa else None,
            "empresa_id": empresa.id if empresa else None,
            "grupo": grupo.nombre,
            "grupo_id": grupo.id,
            "es_opcional": es_opc_val,
            "estudiantes": pax_voucher_val if es_opc_val else (grupo.cantidad_estudiantes or 0),
            "padres": 0 if es_opc_val else (grupo.cantidad_padres or 0),
            "guias": 0 if es_opc_val else (grupo.cantidad_guias or 0),
            "pax": pax_voucher_val,
        })

    return resultados


@router.get("/reporte/excel")
def exportar_reporte_vouchers_excel(
    background_tasks: BackgroundTasks,
    desde: date | None = None,
    hasta: date | None = None,
    evento_id: int | None = None,
    empresa_id: int | None = None,
    db: Session = Depends(get_db)
):
    base_query = (
        db.query(models.Voucher)
        .join(models.Asignacion)
        .join(models.FechaEvento)
        .join(models.Evento)
        .join(models.Grupo)
        .join(models.Empresa)
        .filter(models.Voucher.usado == True)
        .filter(models.Voucher.fecha_uso.isnot(None))
    )

    if evento_id:
        base_query = base_query.filter(models.FechaEvento.evento_id == evento_id)

    if empresa_id:
        base_query = base_query.filter(models.Grupo.empresa_id == empresa_id)

    if desde:
        base_query = base_query.filter(func.substr(models.Voucher.fecha_uso, 1, 10) >= desde.isoformat())
    if hasta:
        base_query = base_query.filter(func.substr(models.Voucher.fecha_uso, 1, 10) <= hasta.isoformat())

    base_query = base_query.order_by(models.Voucher.fecha_uso.desc())

    wb = Workbook()
    ws = wb.active
    ws.title = "Vouchers Escaneados"
    ws.append([
        "Fecha escaneo",
        "Hora",
        "Fecha evento",
        "Evento",
        "Tipo",
        "Empresa",
        "Grupo",
        "Estudiantes",
        "Padres",
        "Guias",
        "Total Pax"
    ])

    for voucher in base_query.all():
        asignacion = voucher.asignacion
        if not asignacion or not asignacion.grupo or not asignacion.fecha_evento:
            continue

        grupo = asignacion.grupo
        empresa = grupo.empresa
        fecha_evento = asignacion.fecha_evento
        evento = fecha_evento.evento

        scan_dt = parse_fecha_uso(voucher.fecha_uso)
        scan_fecha = scan_dt.date().isoformat() if scan_dt else None
        scan_hora = scan_dt.strftime("%H:%M:%S") if scan_dt else None
        pax_excel = obtener_pax_voucher(asignacion)
        es_opc_excel = bool(getattr(asignacion, "es_opcional", False))

        ws.append([
            scan_fecha or "",
            scan_hora or "",
            str(fecha_evento.fecha),
            f"{evento.nombre} (OPCIONAL)" if (evento and es_opc_excel) else (evento.nombre if evento else ""),
            evento.tipo if evento else "",
            empresa.nombre if empresa else "",
            grupo.nombre,
            pax_excel if es_opc_excel else (grupo.cantidad_estudiantes or 0),
            0 if es_opc_excel else (grupo.cantidad_padres or 0),
            0 if es_opc_excel else (grupo.cantidad_guias or 0),
            pax_excel
        ])

    filename = f"planilla_vouchers_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        filepath = tmp.name

    wb.save(filepath)
    background_tasks.add_task(_cleanup_file, filepath)

    return FileResponse(
        filepath,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
