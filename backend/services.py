from models import Asignacion


def validar_estadia(grupo, fecha):
    if not (grupo.fecha_entrada <= fecha < grupo.fecha_salida):
        raise Exception("Grupo fuera de estadía")


def validar_servicio(grupo, evento):
    if evento.tipo == "PARQUE" and not grupo.parque_acceso:
        raise Exception("Grupo no compró parque")

    if evento.tipo == "POOL" and not grupo.pool_acceso:
        raise Exception("Grupo no compró pool")

    if evento.tipo == "HIELO" and not grupo.bar_hielo:
        raise Exception("Grupo no compró bar de hielo")


def validar_capacidad(db, fecha_evento, grupo, pax_asignados=None):
    total = 0
    capacidad = fecha_evento.evento.capacidad_maxima
    tipo = (fecha_evento.evento.tipo or "").upper()

    if tipo == "HIELO":
        pax_turno = pax_asignados if pax_asignados is not None else grupo.cantidad_pax
        if capacidad is not None and capacidad > 0 and pax_turno > capacidad:
            raise Exception("Capacidad por turno superada")
        return

    for a in fecha_evento.asignaciones:
        if a.pax_asignados is not None:
            total += a.pax_asignados
        elif a.grupo:
            total += a.grupo.cantidad_pax

    if capacidad is not None and capacidad > 0 and total + grupo.cantidad_pax > capacidad:
        raise Exception("Capacidad superada")
