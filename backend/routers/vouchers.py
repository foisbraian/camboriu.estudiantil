from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import get_db
import models
import secrets
import qrcode
import io
from datetime import datetime, date, time, timedelta
from zoneinfo import ZoneInfo
from typing import Optional
from PIL import Image, ImageDraw, ImageFont

router = APIRouter(prefix="/vouchers", tags=["Vouchers"])
BALNEARIO_TZ = ZoneInfo("America/Sao_Paulo")

WINDOW_CONFIG = {
    "DISCO": {"start": time(22, 0), "end": time(6, 0), "offset_days": 1},
    "PARQUE": {"start": time(8, 0), "end": time(18, 0), "offset_days": 0},
    "POOL": {"start": time(10, 0), "end": time(18, 0), "offset_days": 0},
}


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

def generate_unique_token():
    return secrets.token_urlsafe(16)

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
    evento = asignacion.fecha_evento.evento
    fecha = asignacion.fecha_evento.fecha
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
    draw.text((40, 180), f"{evento.nombre}", fill=color_text, font=font_sub)
    
    draw.text((40, 220), "FECHA / PAX:", fill=color_label, font=font_label)
    draw.text((40, 240), f"{fecha} - {grupo.cantidad_pax} PAX", fill=color_text, font=font_sub)
    
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
    res_detalle = {
        "status": "success",
        "message": "Voucher validado con éxito",
        "detalle": {
            "grupo": asig.grupo.nombre,
            "servicio": asig.fecha_evento.evento.nombre,
            "fecha": str(asig.fecha_evento.fecha),
            "estructura_grupo": {
                "pax": asig.grupo.cantidad_estudiantes or 0,
                "padres": asig.grupo.cantidad_padres or 0,
                "guias": asig.grupo.cantidad_guias or 0
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
    voucher.fecha_uso = datetime.now(BALNEARIO_TZ).strftime("%Y-%m-%d %H:%M:%S %Z")
    db.commit()
    
    return res_detalle
