import os

vouchers_path = os.path.join(os.path.dirname(__file__), '..', 'routers', 'vouchers.py')

with open(vouchers_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_endpoint = """
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

"""

target = 'def parse_fecha_uso'
if target not in content:
    print("ERROR: target not found in file")
    exit(1)

if '/qr/{asignacion_id}' in content:
    print("Endpoint already exists, skipping.")
    exit(0)

content = content.replace(target, new_endpoint + target, 1)

with open(vouchers_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("OK: endpoint added")
