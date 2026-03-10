from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models
import schemas

router = APIRouter(
    prefix="/hoteleria",
    tags=["Hoteleria"]
)

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

# =======================
# PAGOS (SEÑAS)
# =======================

@router.get("/pagos/", response_model=List[schemas.PagoHotelOut])
def get_pagos(db: Session = Depends(get_db)):
    return db.query(models.PagoHotel).order_by(models.PagoHotel.fecha.desc()).all()

@router.post("/pagos/", response_model=schemas.PagoHotelOut, status_code=status.HTTP_201_CREATED)
def create_pago(pago: schemas.PagoHotelCreate, db: Session = Depends(get_db)):
    db_pago = models.PagoHotel(**pago.model_dump())
    db.add(db_pago)
    db.commit()
    db.refresh(db_pago)
    return db_pago
