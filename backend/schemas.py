from pydantic import BaseModel, model_validator
from datetime import date, datetime
from typing import Union


# ========= EMPRESA =========

class EmpresaCreate(BaseModel):
    nombre: str


class EmpresaOut(BaseModel):
    id: int
    nombre: str
    codigo_acceso: str

    class Config:
        from_attributes = True


# ========= GRUPO =========

class GrupoCreate(BaseModel):
    nombre: str
    empresa_id: int
    cantidad_estudiantes: int = 0
    cantidad_padres: int = 0
    cantidad_guias: int = 0

    fecha_entrada: date
    fecha_salida: date

    discos_compradas: int
    permite_alcohol: bool

    parque_acceso: bool
    parque_con_comida: bool

    pool_acceso: bool
    pool_con_comida: bool

    @model_validator(mode="after")
    def fecha_salida_posterior(self):
        if self.fecha_entrada and self.fecha_salida:
            if self.fecha_salida <= self.fecha_entrada:
                raise ValueError("La fecha de salida debe ser posterior a la fecha de entrada.")
        return self


class GrupoUpdate(GrupoCreate):
    pass


# ========= TEMATICA =========

class TematicaCreate(BaseModel):
    nombre: str
    descripcion: str = ""


class TematicaOut(BaseModel):
    id: int
    nombre: str
    descripcion: str

    class Config:
        from_attributes = True


# ========= EVENTO =========

class EventoCreate(BaseModel):
    nombre: str
    tipo: str
    capacidad_maxima: int


# ⭐ FIX 422 DEFINITIVO
class FechaEventoCreate(BaseModel):
    evento_id: int
    fecha: date  # solo date, Pydantic convertirá "YYYY-MM-DD"
    con_alcohol: bool = False
    tematica_id: Union[int, None] = None  # opcional, solo para discos
    es_privado: bool = False
    empresa_privada_id: Union[int, None] = None


# ========= ASIGNACION =========

class AsignacionCreate(BaseModel):
    grupo_id: int
    fecha_evento_id: int


# ========= FINANZAS =========

class FinanzasEmpresaCreate(BaseModel):
    empresa_id: int
    precio_disco_individual: int = 0
    precio_parque_individual: int = 0
    precio_pool_individual: int = 0
    es_combo: bool = False
    precio_combo: int = 0
    combo_discos: int = 0
    combo_parque: bool = False
    combo_pool: bool = False
    
    disco_liberados_ratio: int = 0
    disco_padres_gratis: bool = False
    disco_guias_gratis: bool = False
    parque_liberados_ratio: int = 0
    parque_padres_gratis: bool = False
    parque_guias_gratis: bool = False
    pool_liberados_ratio: int = 0
    pool_padres_gratis: bool = False
    pool_guias_gratis: bool = False

class FinanzasEmpresaOut(FinanzasEmpresaCreate):
    id: int
    class Config:
        from_attributes = True

class PagoCreate(BaseModel):
    empresa_id: int
    monto: int
    fecha: date
    metodo: str
    nota: Union[str, None] = None

class PagoOut(PagoCreate):
    id: int
    class Config:
        from_attributes = True


# ========= PROVEEDOR =========

class ProveedorCreate(BaseModel):
    nombre: str
    data: Union[str, None] = None

class ProveedorOut(BaseModel):
    id: int
    nombre: str
    data: str

    class Config:
        from_attributes = True
