from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import get_db
import models
import secrets
import qrcode
import io
from datetime import datetime
from PIL import Image, ImageDraw, ImageFont

router = APIRouter(prefix="/vouchers", tags=["Vouchers"])

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
        
    voucher = db.query(models.Voucher).filter(models.Voucher.token == token).first()
    if not voucher:
        return JSONResponse({"status": "error", "message": "Voucher Inválido"}, status_code=404)
        
    if voucher.usado:
        return JSONResponse({"status": "error", "message": f"Voucher ya fue usado el {voucher.fecha_uso}"}, status_code=400)
    
    # Marcar como usado
    voucher.usado = True
    voucher.fecha_uso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    db.commit()
    
    asignacion = voucher.asignacion
    return {
        "status": "success",
        "message": "Voucher validado con éxito",
        "detalle": {
            "grupo": asignacion.grupo.nombre,
            "servicio": asignacion.fecha_evento.evento.nombre,
            "fecha": str(asignacion.fecha_evento.fecha),
            "pax": asignacion.grupo.cantidad_pax
        }
    }
