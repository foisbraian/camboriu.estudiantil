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


def validar_capacidad(db, fecha_evento, grupo):
    total = 0

    for a in fecha_evento.asignaciones:
        total += a.grupo.cantidad_pax

    if total + grupo.cantidad_pax > fecha_evento.evento.capacidad_maxima:
        raise Exception("Capacidad superada")
