from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import os

from database import get_db
import models

router = APIRouter(prefix="/cardapio", tags=["cardapio"])


# ---- Auth helper (solo para writes) ----
def require_admin(x_admin_token: str = Header(default="")):
    admin_pass = os.getenv("ADMIN_PASSWORD", "Graciasburgos2026").strip()
    if x_admin_token != admin_pass:
        raise HTTPException(status_code=403, detail="No autorizado")


# ---- Schemas ----
class ItemOut(BaseModel):
    id: int
    tipo: str
    seccion: str
    nombre: str
    descripcion: Optional[str]
    precio: float
    orden: int
    activo: bool

    class Config:
        from_attributes = True


class ItemUpdate(BaseModel):
    precio: Optional[float] = None
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    orden: Optional[int] = None
    activo: Optional[bool] = None


class ItemCreate(BaseModel):
    tipo: str
    seccion: str
    nombre: str
    descripcion: Optional[str] = None
    precio: float
    orden: int = 0
    activo: bool = True


# ---- Seed inicial ----
SEED_ALCOHOL = [
    # COMBOS
    {"tipo": "alcohol", "seccion": "COMBOS", "nombre": "Vodka Smirnoff + 5 Energéticos", "descripcion": None, "precio": 500, "orden": 1},
    {"tipo": "alcohol", "seccion": "COMBOS", "nombre": "Vodka Ciroc + 5 Energéticos", "descripcion": None, "precio": 700, "orden": 2},
    {"tipo": "alcohol", "seccion": "COMBOS", "nombre": "Vodka Ciroc 3 lts. + 10 Energéticos", "descripcion": None, "precio": 2500, "orden": 3},
    {"tipo": "alcohol", "seccion": "COMBOS", "nombre": "Whisky Black Label + 5 Energéticos", "descripcion": None, "precio": 800, "orden": 4},
    {"tipo": "alcohol", "seccion": "COMBOS", "nombre": "Whisky Red Label + 5 Energéticos", "descripcion": None, "precio": 600, "orden": 5},
    {"tipo": "alcohol", "seccion": "COMBOS", "nombre": "Gin Tanqueray + 5 Energéticos ó 5 Tónicas", "descripcion": None, "precio": 600, "orden": 6},
    {"tipo": "alcohol", "seccion": "COMBOS", "nombre": "Champagne Chandon + 3 Energéticos", "descripcion": None, "precio": 400, "orden": 7},
    # TRAGOS Y MEDIDAS
    {"tipo": "alcohol", "seccion": "TRAGOS Y MEDIDAS", "nombre": "Caipirinha 330 ml", "descripcion": None, "precio": 50, "orden": 1},
    {"tipo": "alcohol", "seccion": "TRAGOS Y MEDIDAS", "nombre": "Fernet Medida + Lata Bebida Cola", "descripcion": None, "precio": 60, "orden": 2},
    {"tipo": "alcohol", "seccion": "TRAGOS Y MEDIDAS", "nombre": "Tequila Importado Medida", "descripcion": None, "precio": 50, "orden": 3},
    {"tipo": "alcohol", "seccion": "TRAGOS Y MEDIDAS", "nombre": "Vodka Medida + 1 lata energético", "descripcion": None, "precio": 60, "orden": 4},
    {"tipo": "alcohol", "seccion": "TRAGOS Y MEDIDAS", "nombre": "Gin Medida + 1 lata energético", "descripcion": None, "precio": 60, "orden": 5},
    {"tipo": "alcohol", "seccion": "TRAGOS Y MEDIDAS", "nombre": "Whisky Medida + 1 lata energético", "descripcion": None, "precio": 60, "orden": 6},
    # DIVERSOS
    {"tipo": "alcohol", "seccion": "DIVERSOS", "nombre": "Cerveza Lata", "descripcion": None, "precio": 20, "orden": 1},
    {"tipo": "alcohol", "seccion": "DIVERSOS", "nombre": "Agua S/Gas", "descripcion": None, "precio": 10, "orden": 2},
    {"tipo": "alcohol", "seccion": "DIVERSOS", "nombre": "Gaseosa Lata", "descripcion": None, "precio": 20, "orden": 3},
    {"tipo": "alcohol", "seccion": "DIVERSOS", "nombre": "Tónica", "descripcion": None, "precio": 20, "orden": 4},
    {"tipo": "alcohol", "seccion": "DIVERSOS", "nombre": "Energético Red Bull", "descripcion": None, "precio": 30, "orden": 5},
    {"tipo": "alcohol", "seccion": "DIVERSOS", "nombre": "Energético Red Bull Sugar Free", "descripcion": None, "precio": 30, "orden": 6},
    {"tipo": "alcohol", "seccion": "DIVERSOS", "nombre": "Energético Red Bull Tropical", "descripcion": None, "precio": 30, "orden": 7},
    # ESPECIAL (Vaso 850ml)
    {"tipo": "alcohol", "seccion": "ESPECIAL", "nombre": "Vaso 850 ml (Caipirinha / Vodka con energético)", "descripcion": "Recarga R$ 60", "precio": 100, "orden": 1},
]

SEED_SIN_ALCOHOL = [
    {"tipo": "sin_alcohol", "seccion": "DIVERSOS", "nombre": "Cerveza sin alcohol Lata", "descripcion": None, "precio": 20, "orden": 1},
    {"tipo": "sin_alcohol", "seccion": "DIVERSOS", "nombre": "Agua S/Gas", "descripcion": None, "precio": 10, "orden": 2},
    {"tipo": "sin_alcohol", "seccion": "DIVERSOS", "nombre": "Gaseosa Lata", "descripcion": None, "precio": 20, "orden": 3},
    {"tipo": "sin_alcohol", "seccion": "DIVERSOS", "nombre": "Tónica", "descripcion": None, "precio": 20, "orden": 4},
    {"tipo": "sin_alcohol", "seccion": "DIVERSOS", "nombre": "Energético Red Bull", "descripcion": None, "precio": 30, "orden": 5},
    {"tipo": "sin_alcohol", "seccion": "DIVERSOS", "nombre": "Energético Red Bull Sugar Free", "descripcion": None, "precio": 30, "orden": 6},
    {"tipo": "sin_alcohol", "seccion": "DIVERSOS", "nombre": "Energético Red Bull Tropical", "descripcion": None, "precio": 30, "orden": 7},
    # ESPECIAL (Vaso 850ml)
    {"tipo": "sin_alcohol", "seccion": "ESPECIAL", "nombre": "Vaso 850 ml + 1 carga (Gaseosa ó Energético)", "descripcion": "Recarga R$ 30", "precio": 50, "orden": 1},
]


# ---- Endpoints ----

@router.get("/seed")
def seed_cardapio(db: Session = Depends(get_db), x_admin_token: str = Header(default="")):
    """Inserta los items iniciales si la tabla está vacía. Solo admin."""
    require_admin(x_admin_token)
    existing = db.query(models.ItemCardapio).count()
    if existing > 0:
        return {"message": f"Ya existen {existing} items, seed omitido."}
    all_items = SEED_ALCOHOL + SEED_SIN_ALCOHOL
    for item_data in all_items:
        item = models.ItemCardapio(**item_data)
        db.add(item)
    db.commit()
    return {"message": f"{len(all_items)} items insertados correctamente."}


@router.get("/{tipo}", response_model=list[ItemOut])
def get_cardapio(tipo: str, db: Session = Depends(get_db)):
    """Público: retorna todos los items activos del cardapio por tipo (alcohol | sin_alcohol)."""
    if tipo not in ("alcohol", "sin_alcohol"):
        raise HTTPException(status_code=400, detail="Tipo inválido. Usa 'alcohol' o 'sin_alcohol'.")
    items = (
        db.query(models.ItemCardapio)
        .filter(models.ItemCardapio.tipo == tipo, models.ItemCardapio.activo == True)
        .order_by(models.ItemCardapio.seccion, models.ItemCardapio.orden)
        .all()
    )
    return items


@router.put("/{item_id}", response_model=ItemOut)
def update_item(item_id: int, body: ItemUpdate, db: Session = Depends(get_db), x_admin_token: str = Header(default="")):
    """Admin: actualiza un item del cardapio."""
    require_admin(x_admin_token)
    item = db.query(models.ItemCardapio).filter(models.ItemCardapio.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item no encontrado")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.post("/", response_model=ItemOut)
def create_item(body: ItemCreate, db: Session = Depends(get_db), x_admin_token: str = Header(default="")):
    """Admin: crea un nuevo item en el cardapio."""
    require_admin(x_admin_token)
    item = models.ItemCardapio(**body.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}")
def delete_item(item_id: int, db: Session = Depends(get_db), x_admin_token: str = Header(default="")):
    """Admin: elimina un item del cardapio."""
    require_admin(x_admin_token)
    item = db.query(models.ItemCardapio).filter(models.ItemCardapio.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item no encontrado")
    db.delete(item)
    db.commit()
    return {"message": "Eliminado"}
