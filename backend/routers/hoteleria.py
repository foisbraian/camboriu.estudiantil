import os
import tempfile
from datetime import datetime

from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, status
from fastapi.responses import FileResponse
from openpyxl import Workbook
from sqlalchemy import text
from sqlalchemy.orm import Session
from typing import List, cast
from database import get_db
import models
import schemas

router = APIRouter(
    prefix="/hoteleria",
    tags=["Hoteleria"]
)


def _cleanup_file(path: str):
    try:
        os.remove(path)
    except OSError:
        pass

# =======================
# HOTELES
# =======================

@router.get("/hoteles/", response_model=List[schemas.HotelOut])
def get_hoteles(db: Session = Depends(get_db)):
    return db.query(models.Hotel).order_by(models.Hotel.nombre).all()

@router.post("/hoteles/", response_model=schemas.HotelOut, status_code=status.HTTP_201_CREATED)
def create_hotel(hotel: schemas.HotelCreate, db: Session = Depends(get_db)):
    db_hotel = models.Hotel(nombre=hotel.nombre)
    db.add(db_hotel)
    try:
        db.commit()
        db.refresh(db_hotel)
        return db_hotel
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="El hotel ya existe o hubo un error.")

# =======================
# RESERVAS
# =======================

@router.get("/reservas/", response_model=List[schemas.ReservaHotelWithRelations])
def get_reservas(db: Session = Depends(get_db)):
    return db.query(models.ReservaHotel).all()

@router.post("/reservas/", response_model=schemas.ReservaHotelOut, status_code=status.HTTP_201_CREATED)
def create_reserva(reserva: schemas.ReservaHotelCreate, db: Session = Depends(get_db)):
    db_reserva = models.ReservaHotel(**reserva.model_dump())
    db.add(db_reserva)
    db.commit()
    db.refresh(db_reserva)
    return db_reserva

@router.delete("/reservas/{reserva_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reserva(reserva_id: int, db: Session = Depends(get_db)):
    db_reserva = db.query(models.ReservaHotel).filter(models.ReservaHotel.id == reserva_id).first()
    if not db_reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    db.delete(db_reserva)
    db.commit()


@router.put("/reservas/{reserva_id}", response_model=schemas.ReservaHotelOut)
def update_reserva(reserva_id: int, reserva: schemas.ReservaHotelCreate, db: Session = Depends(get_db)):
    db_reserva = db.query(models.ReservaHotel).filter(models.ReservaHotel.id == reserva_id).first()
    if not db_reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    for key, value in reserva.model_dump().items():
        setattr(db_reserva, key, value)

    db.commit()
    db.refresh(db_reserva)
    return db_reserva

# =======================
# PAGOS (SEÑAS)
# =======================

@router.get("/pagos/", response_model=List[schemas.PagoHotelOut])
def get_pagos(db: Session = Depends(get_db)):
    return db.query(models.PagoHotel).order_by(models.PagoHotel.fecha.desc()).all()

@router.post("/pagos/", response_model=schemas.PagoHotelOut, status_code=status.HTTP_201_CREATED)
def create_pago(pago: schemas.PagoHotelCreate, db: Session = Depends(get_db)):
    if pago.reserva_id is not None:
        reserva = db.query(models.ReservaHotel).filter(models.ReservaHotel.id == pago.reserva_id).first()
        if not reserva:
            raise HTTPException(status_code=404, detail="Reserva no encontrada")
        reserva_empresa_id = cast(int, reserva.empresa_id)
        reserva_hotel_id = cast(int, reserva.hotel_id)
        if reserva_empresa_id != pago.empresa_id or reserva_hotel_id != pago.hotel_id:
            raise HTTPException(status_code=400, detail="La reserva no corresponde a la empresa u hotel seleccionado")
    db_pago = models.PagoHotel(**pago.model_dump())
    db.add(db_pago)
    db.commit()
    db.refresh(db_pago)
    return db_pago


@router.post("/migracion-reserva-id")
def migracion_reserva_id(db: Session = Depends(get_db)):
    db.execute(text("ALTER TABLE pagos_hotel ADD COLUMN IF NOT EXISTS reserva_id INTEGER"))
    db.commit()
    return {"ok": True}


@router.post("/migracion-total-habitaciones")
def migracion_total_habitaciones(db: Session = Depends(get_db)):
    db.execute(text("ALTER TABLE reservas_hotel ADD COLUMN IF NOT EXISTS total_habitaciones INTEGER DEFAULT 0"))
    db.commit()
    return {"ok": True}


@router.get("/liquidacion/{hotel_id:int}/{empresa_id:int}")
def liquidacion_hoteleria(
    hotel_id: int,
    empresa_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    hotel = db.query(models.Hotel).filter(models.Hotel.id == hotel_id).first()
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel no encontrado")

    empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    reservas = (
        db.query(models.ReservaHotel)
        .filter(
            models.ReservaHotel.hotel_id == hotel_id,
            models.ReservaHotel.empresa_id == empresa_id,
        )
        .order_by(models.ReservaHotel.fecha_ingreso)
        .all()
    )

    pagos = (
        db.query(models.PagoHotel)
        .filter(
            models.PagoHotel.hotel_id == hotel_id,
            models.PagoHotel.empresa_id == empresa_id,
        )
        .order_by(models.PagoHotel.fecha.asc())
        .all()
    )

    wb = Workbook()
    ws = wb.active
    ws.title = "Estado de Cuenta"

    ws.append(["Estado de Cuenta - Hoteleria"])
    ws.append(["Hotel", hotel.nombre])
    ws.append(["Empresa", empresa.nombre])
    ws.append(["Generado", datetime.now().strftime("%Y-%m-%d %H:%M")])
    ws.append([])

    ws.append([
        "Reserva ID",
        "Ingreso",
        "Salida",
        "Noches",
        "Total Hab.",
        "SGL",
        "DBL",
        "TPL",
        "CPL",
        "QPL",
        "Tarifa Noche",
        "Subtotal"
    ])

    total_reservas = 0
    for r in reservas:
        in_date = r.fecha_ingreso
        out_date = r.fecha_salida
        noches = max(0, (out_date - in_date).days) if in_date and out_date else 0

        tarifa_noche = (
            (r.cant_single or 0) * (r.tarifa_single or 0) +
            (r.cant_doble or 0) * (r.tarifa_doble or 0) +
            (r.cant_triple or 0) * (r.tarifa_triple or 0) +
            (r.cant_cuadruple or 0) * (r.tarifa_cuadruple or 0) +
            (r.cant_quintuple or 0) * (r.tarifa_quintuple or 0)
        )
        subtotal = tarifa_noche * noches
        total_reservas += subtotal

        ws.append([
            r.id,
            r.fecha_ingreso,
            r.fecha_salida,
            noches,
            r.total_habitaciones or 0,
            r.cant_single or 0,
            r.cant_doble or 0,
            r.cant_triple or 0,
            r.cant_cuadruple or 0,
            r.cant_quintuple or 0,
            tarifa_noche,
            subtotal
        ])

    total_pagos = sum((p.monto or 0) for p in pagos)
    saldo = total_reservas - total_pagos

    ws.append([])
    ws.append(["Total Reservas", total_reservas])
    ws.append(["Total Pagos", total_pagos])
    ws.append(["Saldo", saldo])

    ws.append([])
    ws.append(["Pagos Registrados"])
    ws.append(["Fecha", "Monto", "Metodo", "Reserva", "Nota"])
    for p in pagos:
        reserva_label = f"#{p.reserva_id}" if p.reserva_id else "General"
        ws.append([p.fecha, p.monto, p.metodo, reserva_label, p.nota or ""])

    filename = f"estado_cuenta_hoteleria_{empresa.nombre}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        filepath = tmp.name

    wb.save(filepath)
    background_tasks.add_task(_cleanup_file, filepath)

    return FileResponse(
        filepath,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
