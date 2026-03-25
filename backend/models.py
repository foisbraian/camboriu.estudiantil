from sqlalchemy import Column, Integer, String, Boolean, Date, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import secrets


# =============================
# helper para códigos de acceso
# =============================

def generar_codigo():
    return secrets.token_hex(4)  # ej: a3f91b2c


# =============================
# EMPRESA
# =============================

class Empresa(Base):
    __tablename__ = "empresas"

    id = Column(Integer, primary_key=True)
    nombre = Column(String, unique=True, index=True)

    # acceso simple sin login
    codigo_acceso = Column(String, default=generar_codigo, unique=True)

    grupos = relationship("Grupo", back_populates="empresa")
    reservas_hotel = relationship("ReservaHotel", back_populates="empresa")
    pagos_hotel = relationship("PagoHotel", back_populates="empresa")


# =============================
# GRUPO
# =============================

class Grupo(Base):
    __tablename__ = "grupos"

    id = Column(Integer, primary_key=True)

    nombre = Column(String)

    empresa_id = Column(Integer, ForeignKey("empresas.id"))

    cantidad_estudiantes = Column(Integer, default=0)
    cantidad_padres = Column(Integer, default=0)
    cantidad_guias = Column(Integer, default=0)

    @property
    def cantidad_pax(self):
        return (self.cantidad_estudiantes or 0) + (self.cantidad_padres or 0) + (self.cantidad_guias or 0)

    fecha_entrada = Column(Date)
    fecha_salida = Column(Date)

    # discos
    discos_compradas = Column(Integer, default=0)
    permite_alcohol = Column(Boolean, default=False)

    # parque
    parque_acceso = Column(Boolean, default=False)
    parque_con_comida = Column(Boolean, default=False)

    # pool
    pool_acceso = Column(Boolean, default=False)
    pool_con_comida = Column(Boolean, default=False)
    cena_velas = Column(Boolean, default=False)
    bar_hielo = Column(Boolean, default=False)
    pagantes_finales = Column(Integer, nullable=True)

    empresa = relationship("Empresa", back_populates="grupos")
    asignaciones = relationship("Asignacion", back_populates="grupo")


# =============================
# EVENTO BASE (Eclipse / Parque / Pool)
# =============================

class Evento(Base):
    __tablename__ = "eventos"

    id = Column(Integer, primary_key=True)

    nombre = Column(String)  # Eclipse / Parque Norte / Pool Sunset
    tipo = Column(String)    # DISCO | PARQUE | POOL
    complejo = Column(String, nullable=True)  # Solo discos (ej: Greenvalley)

    capacidad_maxima = Column(Integer)

    fechas = relationship("FechaEvento", back_populates="evento")


# =============================
# TEMATICA
# (para eventos de discoteca)
# =============================

class Tematica(Base):
    __tablename__ = "tematicas"

    id = Column(Integer, primary_key=True)
    nombre = Column(String, unique=True)
    descripcion = Column(String, nullable=True)

    fechas_evento = relationship("FechaEvento", back_populates="tematica")


# =============================
# FECHA DE EVENTO
# (cada día que abre)
# =============================

class FechaEvento(Base):
    __tablename__ = "fechas_evento"

    id = Column(Integer, primary_key=True)

    evento_id = Column(Integer, ForeignKey("eventos.id"))
    fecha = Column(Date)

    # solo discos usan esto
    con_alcohol = Column(Boolean, default=False)

    # temática (opcional, solo para discos)
    tematica_id = Column(Integer, ForeignKey("tematicas.id"), nullable=True)

    es_privado = Column(Boolean, default=False)
    empresa_privada_id = Column(Integer, ForeignKey("empresas.id"), nullable=True)

    evento = relationship("Evento", back_populates="fechas")
    asignaciones = relationship("Asignacion", back_populates="fecha_evento")
    tematica = relationship("Tematica", back_populates="fechas_evento")
    empresa_privada = relationship("Empresa", foreign_keys=[empresa_privada_id])


# =============================
# ASIGNACION
# grupo -> evento en fecha
# =============================

class Asignacion(Base):
    __tablename__ = "asignaciones"

    id = Column(Integer, primary_key=True)

    grupo_id = Column(Integer, ForeignKey("grupos.id", ondelete="CASCADE"))
    fecha_evento_id = Column(Integer, ForeignKey("fechas_evento.id", ondelete="CASCADE"))
    pax_asignados = Column(Integer, nullable=True)

    grupo = relationship("Grupo", back_populates="asignaciones")
    fecha_evento = relationship("FechaEvento", back_populates="asignaciones")
    vouchers = relationship("Voucher", back_populates="asignacion")


# =============================
# FINANZAS - CONFIGURACION
# =============================

class FinanzasEmpresa(Base):
    __tablename__ = "finanzas_empresa"

    id = Column(Integer, primary_key=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id"), unique=True)
    moneda = Column(String, default="ARS")

    precio_disco_individual = Column(Integer, default=0)
    precio_parque_individual = Column(Integer, default=0)
    precio_parque_con_comida = Column(Integer, default=0)
    precio_parque_sin_comida = Column(Integer, default=0)
    precio_pool_individual = Column(Integer, default=0)
    precio_pool_con_comida = Column(Integer, default=0)
    precio_pool_sin_comida = Column(Integer, default=0)
    precio_cena_velas = Column(Integer, default=0)
    precio_bar_hielo = Column(Integer, default=0)

    es_combo = Column(Boolean, default=False)
    precio_combo = Column(Integer, default=0)
    combo_discos = Column(Integer, default=0)
    combo_parque = Column(Boolean, default=False)
    combo_pool = Column(Boolean, default=False)

    # Liberados (Free entries)
    disco_liberados_ratio = Column(Integer, default=0)  # 20:1
    disco_padres_gratis = Column(Boolean, default=False)
    disco_guias_gratis = Column(Boolean, default=False)

    parque_liberados_ratio = Column(Integer, default=0)
    parque_padres_gratis = Column(Boolean, default=False)
    parque_guias_gratis = Column(Boolean, default=False)

    pool_liberados_ratio = Column(Integer, default=0)
    pool_padres_gratis = Column(Boolean, default=False)
    pool_guias_gratis = Column(Boolean, default=False)

    empresa = relationship("Empresa")


# =============================
# PAGOS RECARGADOS
# =============================

class Pago(Base):
    __tablename__ = "pagos"

    id = Column(Integer, primary_key=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id"))

    monto = Column(Integer)
    fecha = Column(Date)
    metodo = Column(String)  # Transferencia, Efectivo, etc.
    nota = Column(String, nullable=True)

    empresa = relationship("Empresa")

class Voucher(Base):
    __tablename__ = "vouchers"

    id = Column(Integer, primary_key=True)
    token = Column(String, unique=True, index=True)
    asignacion_id = Column(Integer, ForeignKey("asignaciones.id", ondelete="CASCADE"))
    usado = Column(Boolean, default=False)
    fecha_uso = Column(String, nullable=True)  # datetime string

    asignacion = relationship("Asignacion", back_populates="vouchers")


class Proveedor(Base):
    __tablename__ = "proveedores"

    id = Column(Integer, primary_key=True)
    nombre = Column(String, unique=True, index=True)

    # Almacenamos el estado de la planilla como JSON string
    # { headers: [], rows: [] }
    data = Column(String, default='{"headers": ["Item", "Detalle", "Monto"], "rows": [["", "", "0"]], "footerCalculations": ["sum", "sum", "sum"], "columnConfigs": [{"type": "text", "options": []}, {"type": "text", "options": []}, {"type": "text", "options": []}]}')

# =============================
# HOTELERIA
# =============================

class Hotel(Base):
    __tablename__ = "hoteles"

    id = Column(Integer, primary_key=True)
    nombre = Column(String, unique=True, index=True)

    reservas = relationship("ReservaHotel", back_populates="hotel")
    pagos = relationship("PagoHotel", back_populates="hotel")


class ReservaHotel(Base):
    __tablename__ = "reservas_hotel"

    id = Column(Integer, primary_key=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id", ondelete="CASCADE"))
    hotel_id = Column(Integer, ForeignKey("hoteles.id", ondelete="CASCADE"))

    fecha_ingreso = Column(Date)
    fecha_salida = Column(Date)

    # Cantidad de habitaciones
    total_habitaciones = Column(Integer, default=0)
    cant_single = Column(Integer, default=0)
    cant_doble = Column(Integer, default=0)
    cant_triple = Column(Integer, default=0)
    cant_cuadruple = Column(Integer, default=0)
    cant_quintuple = Column(Integer, default=0)

    # Tarifas (por noche)
    tarifa_single = Column(Integer, default=0)
    tarifa_doble = Column(Integer, default=0)
    tarifa_triple = Column(Integer, default=0)
    tarifa_cuadruple = Column(Integer, default=0)
    tarifa_quintuple = Column(Integer, default=0)

    empresa = relationship("Empresa", back_populates="reservas_hotel")
    hotel = relationship("Hotel", back_populates="reservas")
    pagos = relationship("PagoHotel", back_populates="reserva")


class PagoHotel(Base):
    __tablename__ = "pagos_hotel"

    id = Column(Integer, primary_key=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id", ondelete="CASCADE"))
    hotel_id = Column(Integer, ForeignKey("hoteles.id", ondelete="CASCADE"))
    reserva_id = Column(Integer, ForeignKey("reservas_hotel.id", ondelete="SET NULL"), nullable=True)

    monto = Column(Integer)
    fecha = Column(Date)
    metodo = Column(String)  # Transferencia, Efectivo, Cheque, etc.
    nota = Column(String, nullable=True)

    empresa = relationship("Empresa", back_populates="pagos_hotel")
    hotel = relationship("Hotel", back_populates="pagos")
    reserva = relationship("ReservaHotel", back_populates="pagos")
