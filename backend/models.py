from sqlalchemy import Column, Integer, Float, String, Boolean, Date, ForeignKey, DateTime
from datetime import datetime
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
    numero_contacto = Column(String, nullable=True)

    # acceso simple sin login
    codigo_acceso = Column(String, default=generar_codigo, unique=True)

    # para marcar años informados (ej: "2024,2025,2026")
    anios_informados = Column(String, default="")

    grupos = relationship("Grupo", back_populates="empresa")
    reservas_hotel = relationship("ReservaHotel", back_populates="empresa")
    pagos_hotel = relationship("PagoHotel", back_populates="empresa")
    links_personalizados = relationship("LinkPersonalizado", back_populates="empresa", cascade="all, delete-orphan")



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
    es_mix_grupo = Column(Boolean, default=False)  # Mix (pulsera): acepta con y sin alcohol

    # parque
    parque_acceso = Column(Boolean, default=False)
    parque_con_comida = Column(Boolean, default=False)

    # campamento americano
    campamento_acceso = Column(Boolean, default=False)
    campamento_con_comida = Column(Boolean, default=False)

    # zacarias
    zacarias_acceso = Column(Boolean, default=False)
    zacarias_con_comida = Column(Boolean, default=False)

    # pool
    pool_acceso = Column(Boolean, default=False)
    pool_con_comida = Column(Boolean, default=False)
    cena_velas = Column(Boolean, default=False)
    bar_hielo = Column(Boolean, default=False)
    pagantes_finales = Column(Integer, nullable=True)
    pagantes_finales_disco = Column(Integer, nullable=True)
    pagantes_finales_parque = Column(Integer, nullable=True)
    pagantes_finales_campamento = Column(Integer, nullable=True)
    pagantes_finales_zacarias = Column(Integer, nullable=True)
    pagantes_finales_pool = Column(Integer, nullable=True)
    pagantes_finales_cena = Column(Integer, nullable=True)
    pagantes_finales_hielo = Column(Integer, nullable=True)
    pagantes_finales_combo = Column(Integer, nullable=True)

    surf_acceso = Column(Boolean, default=False)
    unipraias_acceso = Column(Boolean, default=False)
    beto_acceso = Column(Boolean, default=False)
    barco_acceso = Column(Boolean, default=False)
    cristo_acceso = Column(Boolean, default=False)
    sunset_acceso = Column(Boolean, default=False)
    quinta_comida_acceso = Column(Boolean, default=False)
    multiparque_acceso = Column(Boolean, default=False)
    parador_acceso = Column(Boolean, default=False)

    pagantes_finales_surf = Column(Integer, nullable=True)
    pagantes_finales_unipraias = Column(Integer, nullable=True)
    pagantes_finales_beto = Column(Integer, nullable=True)
    pagantes_finales_barco = Column(Integer, nullable=True)
    pagantes_finales_cristo = Column(Integer, nullable=True)
    pagantes_finales_sunset = Column(Integer, nullable=True)
    pagantes_finales_quinta_comida = Column(Integer, nullable=True)
    pagantes_finales_multiparque = Column(Integer, nullable=True)
    pagantes_finales_campamento_p = Column(Integer, nullable=True) # alias/extra if needed but we use pagantes_finales_campamento
    pagantes_finales_zacarias_p = Column(Integer, nullable=True)

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
    horario = Column(String, nullable=True)

    # solo discos usan esto
    con_alcohol = Column(Boolean, default=False)
    es_mix_evento = Column(Boolean, default=False)  # Mix (pulsera): acepta grupos con y sin alcohol

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

    precio_disco_individual = Column(Float, default=0)
    precio_parque_individual = Column(Float, default=0)
    precio_parque_con_comida = Column(Float, default=0)
    precio_parque_sin_comida = Column(Float, default=0)
    
    # Campamento Americano
    precio_campamento_individual = Column(Float, default=0)
    precio_campamento_con_comida = Column(Float, default=0)
    precio_campamento_sin_comida = Column(Float, default=0)

    # Zacarias
    precio_zacarias_individual = Column(Float, default=0)
    precio_zacarias_con_comida = Column(Float, default=0)
    precio_zacarias_sin_comida = Column(Float, default=0)

    precio_pool_individual = Column(Float, default=0)
    precio_pool_con_comida = Column(Float, default=0)
    precio_pool_sin_comida = Column(Float, default=0)
    precio_cena_velas = Column(Float, default=0)
    precio_bar_hielo = Column(Float, default=0)

    precio_surf = Column(Float, default=0)
    precio_unipraias = Column(Float, default=0)
    precio_beto = Column(Float, default=0)
    precio_barco = Column(Float, default=0)
    precio_cristo = Column(Float, default=0)
    precio_sunset = Column(Float, default=0)
    precio_quinta_comida = Column(Float, default=0)
    precio_multiparque = Column(Float, default=0)

    es_combo = Column(Boolean, default=False)
    precio_combo = Column(Float, default=0)
    combo_discos = Column(Integer, default=0)
    combo_parque = Column(Boolean, default=False)
    combo_campamento = Column(Boolean, default=False)
    combo_zacarias = Column(Boolean, default=False)
    combo_pool = Column(Boolean, default=False)
    combo_cena_velas = Column(Boolean, default=False)
    combo_bar_hielo = Column(Boolean, default=False)

    combo_surf = Column(Boolean, default=False)
    combo_unipraias = Column(Boolean, default=False)
    combo_beto = Column(Boolean, default=False)
    combo_barco = Column(Boolean, default=False)
    combo_cristo = Column(Boolean, default=False)
    combo_sunset = Column(Boolean, default=False)
    combo_quinta_comida = Column(Boolean, default=False)
    combo_multiparque = Column(Boolean, default=False)

    # Liberados (Free entries)
    disco_liberados_ratio = Column(Integer, default=0)  # 20:1
    disco_padres_gratis = Column(Boolean, default=False)
    disco_guias_gratis = Column(Boolean, default=False)

    parque_liberados_ratio = Column(Integer, default=0)
    parque_padres_gratis = Column(Boolean, default=False)
    parque_guias_gratis = Column(Boolean, default=False)

    campamento_liberados_ratio = Column(Integer, default=0)
    campamento_padres_gratis = Column(Boolean, default=False)
    campamento_guias_gratis = Column(Boolean, default=False)

    zacarias_liberados_ratio = Column(Integer, default=0)
    zacarias_padres_gratis = Column(Boolean, default=False)
    zacarias_guias_gratis = Column(Boolean, default=False)

    pool_liberados_ratio = Column(Integer, default=0)
    pool_padres_gratis = Column(Boolean, default=False)
    pool_guias_gratis = Column(Boolean, default=False)

    empresa = relationship("Empresa")
    precios_mensuales = relationship("PrecioServicioMensual", back_populates="finanzas_empresa", cascade="all, delete-orphan")


# =============================
# PRECIOS MENSUALES DE SERVICIOS
# =============================

class PrecioServicioMensual(Base):
    __tablename__ = "precios_servicios_mensuales"

    id = Column(Integer, primary_key=True)
    finanzas_empresa_id = Column(Integer, ForeignKey("finanzas_empresa.id", ondelete="CASCADE"))
    servicio = Column(String)  # ej: "parque_con_comida", "parque_sin_comida", "disco", "pool_con_comida", etc.
    mes = Column(Integer)  # 1 a 12
    precio = Column(Float, default=0)

    finanzas_empresa = relationship("FinanzasEmpresa", back_populates="precios_mensuales")


# =============================
# PAGOS RECARGADOS
# =============================

class Pago(Base):
    __tablename__ = "pagos"

    id = Column(Integer, primary_key=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id"))

    monto = Column(Float)
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
    tarifa_single = Column(Float, default=0)
    tarifa_doble = Column(Float, default=0)
    tarifa_triple = Column(Float, default=0)
    tarifa_cuadruple = Column(Float, default=0)
    tarifa_quintuple = Column(Float, default=0)

    empresa = relationship("Empresa", back_populates="reservas_hotel")
    hotel = relationship("Hotel", back_populates="reservas")
    pagos = relationship("PagoHotel", back_populates="reserva")


class PagoHotel(Base):
    __tablename__ = "pagos_hotel"

    id = Column(Integer, primary_key=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id", ondelete="CASCADE"))
    hotel_id = Column(Integer, ForeignKey("hoteles.id", ondelete="CASCADE"))
    reserva_id = Column(Integer, ForeignKey("reservas_hotel.id", ondelete="SET NULL"), nullable=True)

    monto = Column(Float)
    fecha = Column(Date)
    metodo = Column(String)  # Transferencia, Efectivo, Cheque, etc.
    nota = Column(String, nullable=True)

    empresa = relationship("Empresa", back_populates="pagos_hotel")
    hotel = relationship("Hotel", back_populates="pagos")
    reserva = relationship("ReservaHotel", back_populates="pagos")


# =============================
# HORARIO INDIVIDUAL POR EMPRESA
# Para asignar un horario personalizado a una empresa en un servicio específico
# (ej: Zacarias le toca a las 10:00hs solo a empresa X en esa fecha)
# =============================

class HorarioEmpresa(Base):
    __tablename__ = "horarios_empresa"

    id = Column(Integer, primary_key=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False)
    fecha_evento_id = Column(Integer, ForeignKey("fechas_evento.id", ondelete="CASCADE"), nullable=False)
    horario = Column(String, nullable=False)  # ej: "10:00hs", "14:30", etc.
    nota = Column(String, nullable=True)       # texto opcional adicional

    empresa = relationship("Empresa")
    fecha_evento = relationship("FechaEvento")


# =============================
# GASTOS DE LA EMPRESA
# =============================

class GastoEmpresa(Base):
    __tablename__ = "gastos_empresa"

    id = Column(Integer, primary_key=True, autoincrement=True)
    fecha = Column(Date, nullable=True)
    concepto = Column(String, nullable=False)        # ej: OFICINA, GREENVALLEY, OPERATIVO
    categoria = Column(String, nullable=True)        # ej: ALQUILER, SUELDO BRIAN, CONTADOR
    total_reales = Column(Float, nullable=True)
    total_dolares = Column(Float, nullable=True)
    origen_usd = Column(String, nullable=True)       # PLANILLA / CALCULADO 5.1 / etc.
    observaciones = Column(String, nullable=True)


# =============================
# LINKS PERSONALIZADOS PARA TERCEROS / PROVEEDORES
# =============================

class LinkPersonalizado(Base):
    __tablename__ = "links_personalizados"

    id = Column(Integer, primary_key=True)
    token = Column(String, unique=True, index=True, default=lambda: secrets.token_hex(6))
    empresa_id = Column(Integer, ForeignKey("empresas.id", ondelete="CASCADE"), nullable=True)
    empresas_ids = Column(String, nullable=True)  # CSV de empresa IDs (ej: "1,2,5") o "*" para todas
    nombre = Column(String, nullable=False)  # ej: "Solo Discos", "Para Proveedor Green Valley"
    servicios_permitidos = Column(String, nullable=False)  # CSV ej: "DISCO" o "DISCO,POOL"
    eventos_permitidos = Column(String, nullable=True)  # CSV de evento_id o None si todos
    grupos_permitidos = Column(String, nullable=True)  # CSV de grupo_id o None si todos
    incluir_vouchers = Column(Boolean, default=False)
    activo = Column(Boolean, default=True)
    creado_en = Column(String, nullable=True)

    empresa = relationship("Empresa", back_populates="links_personalizados")


# =============================
# ANOTACIONES POR GRUPO
# Sistema de notas estructuradas por grupo
# =============================

class AnotacionGrupo(Base):
    __tablename__ = "anotaciones_grupo"

    id = Column(Integer, primary_key=True)
    grupo_id = Column(Integer, ForeignKey("grupos.id", ondelete="CASCADE"), nullable=False)

    # Composición del grupo
    cant_hombres = Column(Integer, nullable=True)      # para rooming
    cant_mujeres = Column(Integer, nullable=True)      # para rooming
    cant_tripulacion = Column(Integer, nullable=True)  # guías/choferes

    # Notas generales libres
    notas_generales = Column(String, nullable=True)

    # Última actualización
    actualizado_en = Column(String, nullable=True)

    grupo = relationship("Grupo", backref="anotacion", uselist=False)
    hoteles = relationship(
        "HotelGrupoSegmento",
        back_populates="anotacion",
        cascade="all, delete-orphan",
        order_by="HotelGrupoSegmento.fecha_ingreso",
    )
    comidas = relationship(
        "ComidaGrupo",
        back_populates="anotacion",
        cascade="all, delete-orphan",
        order_by="ComidaGrupo.fecha",
    )


class HotelGrupoSegmento(Base):
    """Un segmento de estadía en un hotel para parte del grupo."""
    __tablename__ = "hotel_grupo_segmentos"

    id = Column(Integer, primary_key=True)
    anotacion_id = Column(Integer, ForeignKey("anotaciones_grupo.id", ondelete="CASCADE"), nullable=False)

    hotel_nombre = Column(String, nullable=False)   # texto libre o nombre del hotel
    cant_pax = Column(Integer, nullable=True)        # cuántos pax de este segmento
    fecha_ingreso = Column(Date, nullable=True)
    fecha_salida = Column(Date, nullable=True)
    notas = Column(String, nullable=True)            # ej: "confirmar hab. dobles"

    anotacion = relationship("AnotacionGrupo", back_populates="hoteles")


class ComidaGrupo(Base):
    """Registro de comida por fecha para el grupo."""
    __tablename__ = "comidas_grupo"

    id = Column(Integer, primary_key=True)
    anotacion_id = Column(Integer, ForeignKey("anotaciones_grupo.id", ondelete="CASCADE"), nullable=False)

    fecha = Column(Date, nullable=False)
    tipo_comida = Column(String, nullable=False)    # "almuerzo" | "cena" | "desayuno"
    lugar = Column(String, nullable=False)          # texto libre: nombre del restaurant/lugar
    cant_pax = Column(Integer, nullable=True)
    notas = Column(String, nullable=True)

    anotacion = relationship("AnotacionGrupo", back_populates="comidas")


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    endpoint = Column(String, unique=True, index=True, nullable=False)
    p256dh = Column(String, nullable=False)
    auth = Column(String, nullable=False)
    role = Column(String, default="equipo", index=True)
    user_agent = Column(String, nullable=True)
    creado_en = Column(DateTime, default=datetime.utcnow)
