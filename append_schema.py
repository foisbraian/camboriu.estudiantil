content = """

# ========= HOTELERIA =========

class HotelCreate(BaseModel):
    nombre: str

class HotelOut(BaseModel):
    id: int
    nombre: str

    class Config:
        from_attributes = True

class ReservaHotelCreate(BaseModel):
    empresa_id: int
    hotel_id: int
    fecha_ingreso: date
    fecha_salida: date

    cant_single: int = 0
    cant_doble: int = 0
    cant_triple: int = 0
    cant_cuadruple: int = 0
    cant_quintuple: int = 0

    tarifa_single: int = 0
    tarifa_doble: int = 0
    tarifa_triple: int = 0
    tarifa_cuadruple: int = 0
    tarifa_quintuple: int = 0

    @model_validator(mode="after")
    def fecha_salida_posterior(self):
        if self.fecha_ingreso and self.fecha_salida:
            if self.fecha_salida <= self.fecha_ingreso:
                raise ValueError("La fecha de salida debe ser posterior a la fecha de ingreso.")
        return self

class ReservaHotelOut(ReservaHotelCreate):
    id: int

    class Config:
        from_attributes = True

class ReservaHotelWithRelations(ReservaHotelOut):
    empresa: EmpresaOut
    hotel: HotelOut

class PagoHotelCreate(BaseModel):
    empresa_id: int
    hotel_id: int
    monto: int
    fecha: date
    metodo: str
    nota: Union[str, None] = None

class PagoHotelOut(PagoHotelCreate):
    id: int

    class Config:
        from_attributes = True
"""
with open('backend/schemas.py', 'a', encoding='utf-8') as f:
    f.write(content)
