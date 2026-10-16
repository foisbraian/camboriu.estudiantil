#!/usr/bin/env python3
"""
Seed script: carga los gastos iniciales de la empresa.
Uso local:   python scripts/seed_gastos.py
Uso en prod: ejecutar apuntando al backend de Render via HTTP (ver abajo).

Por defecto llama al endpoint /gastos/bulk del backend LOCAL (puerto 8000).
Si la variable de entorno BACKEND_URL está definida, usa esa URL.

Ejemplo Render:
  BACKEND_URL=https://tu-app.onrender.com python scripts/seed_gastos.py
"""

import os
import json
import urllib.request
import urllib.error

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/")

# ──────────────────────────────────────────────
# DATOS INICIALES
# Campos: fecha (None si no hay), concepto, categoria, total_reales, total_dolares, origen_usd, observaciones
# ──────────────────────────────────────────────
GASTOS = [
    {"fecha": "2026-02-28", "concepto": "OFICINA",    "categoria": "ALQUILER+LIZ",        "total_reales": 2588.0,   "total_dolares": 508.0,   "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-03-30", "concepto": "OFICINA",    "categoria": "ALQUILER+LIZ",        "total_reales": 2631.0,   "total_dolares": 516.0,   "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-04-30", "concepto": "OFICINA",    "categoria": "ALQUILER+LIZ",        "total_reales": 2616.0,   "total_dolares": 523.0,   "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-03-15", "concepto": "OFICINA",    "categoria": "SUELDO BRIAN",        "total_reales": 4000.0,   "total_dolares": 800.0,   "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-04-15", "concepto": "OFICINA",    "categoria": "SUELDO BRIAN",        "total_reales": 4000.0,   "total_dolares": 800.0,   "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-05-15", "concepto": "OFICINA",    "categoria": "SUELDO BRIAN",        "total_reales": 4000.0,   "total_dolares": 800.0,   "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-05-13", "concepto": "OFICINA",    "categoria": "CONTADOR",            "total_reales": 53995.0,  "total_dolares": 10799.0, "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-04-29", "concepto": "OFICINA",    "categoria": "ESTACIONAMIENTO",     "total_reales": 600.0,    "total_dolares": 120.0,   "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-05-22", "concepto": "OFICINA",    "categoria": "INTERNET",            "total_reales": 120.0,    "total_dolares": 24.0,    "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-05-07", "concepto": "OFICINA",    "categoria": "VUELO MENDOZA",       "total_reales": 7037.0,   "total_dolares": 1422.0,  "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-04-17", "concepto": "OFICINA",    "categoria": "MUEBLE",              "total_reales": 654.0,    "total_dolares": 131.0,   "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-04-25", "concepto": "OFICINA",    "categoria": "INTERNET",            "total_reales": 120.0,    "total_dolares": 24.0,    "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-04-16", "concepto": "OFICINA",    "categoria": "INTERNET",            "total_reales": 260.0,    "total_dolares": 52.0,    "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-05-25", "concepto": "ESTALEIRO",  "categoria": "RESTAURANTE",         "total_reales": 10000.0,  "total_dolares": 2041.0,  "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": None,         "concepto": "AMBULANCIA", "categoria": None,                  "total_reales": 10000.0,  "total_dolares": 2000.0,  "origen_usd": "PLANILLA",       "observaciones": "SIN FECHA; SIN CATEGORIA"},
    {"fecha": "2026-03-26", "concepto": "OFICINA",    "categoria": "ESTACIONAMIENTO",     "total_reales": 600.0,    "total_dolares": 120.0,   "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": None,         "concepto": "OFICINA",    "categoria": "VARIOS",              "total_reales": 62.0,     "total_dolares": 13.0,    "origen_usd": "PLANILLA",       "observaciones": "SIN FECHA"},
    {"fecha": "2026-03-15", "concepto": "OFICINA",    "categoria": "INTERNET",            "total_reales": 120.0,    "total_dolares": 24.0,    "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-05-12", "concepto": "OFICINA",    "categoria": "LIMPIEZA",            "total_reales": 300.0,    "total_dolares": 60.0,    "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-05-26", "concepto": "OFICINA",    "categoria": "LIMPIEZA",            "total_reales": 300.0,    "total_dolares": 58.0,    "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-05-15", "concepto": "OFICINA",    "categoria": "SOFTWARE",            "total_reales": 75.0,     "total_dolares": 15.0,    "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-05-26", "concepto": "OFICINA",    "categoria": "ALQUILER",            "total_reales": 2600.0,   "total_dolares": 531.0,   "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-01-28", "concepto": "GREENVALLEY","categoria": "CONTRATO 2026",       "total_reales": 142835.0, "total_dolares": 26120.0, "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-01-31", "concepto": "GREENVALLEY","categoria": "CONTRATO 2026",       "total_reales": 318000.0, "total_dolares": 60000.0, "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-03-19", "concepto": "GREENVALLEY","categoria": "CONTRATO 2026",       "total_reales": 262500.0, "total_dolares": 50000.0, "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-03-18", "concepto": "MUSIC PARK", "categoria": "CONTRATO 2026",       "total_reales": 40000.0,  "total_dolares": 7843.0,  "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-03-26", "concepto": "MUSIC PARK", "categoria": "CONTRATO 2026",       "total_reales": 40000.0,  "total_dolares": 7843.0,  "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-04-15", "concepto": "MUSIC PARK", "categoria": "CONTRATO 2026",       "total_reales": 30000.0,  "total_dolares": 6000.0,  "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-04-15", "concepto": "ESTACIONAMIENTO SPEEDWAY", "categoria": "ESTACIONAMIENTO", "total_reales": 10000.0, "total_dolares": 2000.0, "origen_usd": "PLANILLA", "observaciones": None},
    {"fecha": "2026-03-26", "concepto": "SPEEDWAY",   "categoria": "CONTRATO 2026",       "total_reales": 10000.0,  "total_dolares": 1961.0,  "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-03-26", "concepto": "SPEEDWAY",   "categoria": "CONTRATO 2026",       "total_reales": 30000.0,  "total_dolares": 5882.0,  "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-06-04", "concepto": "OFICINA",    "categoria": "CAMARAS",             "total_reales": 3078.0,   "total_dolares": 610.0,   "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-06-05", "concepto": "OFICINA",    "categoria": "SUELDO BRIAN",        "total_reales": 4000.0,   "total_dolares": 777.0,   "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-06-08", "concepto": "SHED",       "categoria": "5 FECHAS",            "total_reales": 100000.0, "total_dolares": 20000.0, "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-06-08", "concepto": "OFICINA",    "categoria": "CONTADOR",            "total_reales": 3677.0,   "total_dolares": 735.0,   "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-06-10", "concepto": "OFICINA",    "categoria": "INTERNET",            "total_reales": 264.0,    "total_dolares": 53.0,    "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-06-18", "concepto": "SHED",       "categoria": "1 FECHA",             "total_reales": 20000.0,  "total_dolares": 3922.0,  "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-06-30", "concepto": "OFICINA",    "categoria": "ALQUILER",            "total_reales": 2528.0,   "total_dolares": 491.0,   "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-07-22", "concepto": "OFICINA",    "categoria": "SUELDO BRIAN 2 MESES","total_reales": 8000.0,   "total_dolares": 1584.0,  "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-07-24", "concepto": "OFICINA",    "categoria": "INTERNET",            "total_reales": 120.0,    "total_dolares": 24.0,    "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-07-28", "concepto": "OFICINA",    "categoria": "ALQUILER",            "total_reales": 2800.0,   "total_dolares": 549.0,   "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-07-26", "concepto": "ECLIPSE",    "categoria": "ECLIPSE",             "total_reales": 0.0,      "total_dolares": None,    "origen_usd": "PLANILLA",       "observaciones": "SIN MONTOS"},
    {"fecha": "2026-07-28", "concepto": "DLED",       "categoria": "DLED",                "total_reales": 0.0,      "total_dolares": None,    "origen_usd": "PLANILLA",       "observaciones": "SIN MONTOS"},
    {"fecha": "2026-07-28", "concepto": "OFICINA",    "categoria": "CONTADOR",            "total_reales": 11333.0,  "total_dolares": 2222.0,  "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-07-28", "concepto": "OFICINA",    "categoria": "CONTADOR",            "total_reales": 1160.0,   "total_dolares": 227.0,   "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-07-28", "concepto": "OFICINA",    "categoria": "CONTADOR",            "total_reales": 895.0,    "total_dolares": 175.0,   "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-07-30", "concepto": "OFICINA",    "categoria": "PAGO LUISINHO",       "total_reales": 600.0,    "total_dolares": 118.0,   "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-07-30", "concepto": "OFICINA",    "categoria": "CONTADOR",            "total_reales": 11716.0,  "total_dolares": 2297.0,  "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-08-15", "concepto": "OFICINA",    "categoria": "INTERNET",            "total_reales": 125.0,    "total_dolares": 25.0,    "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-08-24", "concepto": "MUSIC PARK", "categoria": "CONTRATO 2026",       "total_reales": 25000.0,  "total_dolares": 4902.0,  "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-08-24", "concepto": "MUSIC PARK", "categoria": "CONTRATO 2026",       "total_reales": 60000.0,  "total_dolares": 11765.0, "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-08-24", "concepto": "MUSIC PARK", "categoria": "CONTRATO 2026",       "total_reales": 25000.0,  "total_dolares": 4902.0,  "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-08-24", "concepto": "SPEEDWAY",   "categoria": "CONTRATO 2026",       "total_reales": 40000.0,  "total_dolares": 7843.0,  "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-08-31", "concepto": "OFICINA",    "categoria": "ESTACIONAMIENTO",     "total_reales": 600.0,    "total_dolares": 118.0,   "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-09-07", "concepto": "OFICINA",    "categoria": "ALQUILER",            "total_reales": 2864.0,   "total_dolares": 556.0,   "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-09-08", "concepto": "DECORACIÓN", "categoria": "BANDERAS",            "total_reales": 4635.0,   "total_dolares": 900.0,   "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-09-07", "concepto": "OFICINA",    "categoria": "SUELDO BRIAN",        "total_reales": 4000.0,   "total_dolares": 784.0,   "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-09-07", "concepto": "OFICINA",    "categoria": "BRIAN VUELO FIT ARG Y AIRBNB", "total_reales": 2294.0, "total_dolares": 450.0, "origen_usd": "PLANILLA", "observaciones": None},
    {"fecha": "2026-09-14", "concepto": "SHED",       "categoria": "1 FECHA",             "total_reales": 20000.0,  "total_dolares": 3883.0,  "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-09-13", "concepto": "OFICINA",    "categoria": "CONTADOR",            "total_reales": None,     "total_dolares": 5630.0,  "origen_usd": "PLANILLA",       "observaciones": "SIN MONTO EN REALES"},
    {"fecha": "2026-09-14", "concepto": "OFICINA",    "categoria": "CONTADOR",            "total_reales": 2301.0,   "total_dolares": 447.0,   "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-09-15", "concepto": "OFICINA",    "categoria": "TELEFONO",            "total_reales": 130.0,    "total_dolares": 25.0,    "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-09-17", "concepto": "OFICINA",    "categoria": "FLETE MAQUINAS",      "total_reales": 99.0,     "total_dolares": 19.0,    "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-09-17", "concepto": "OFICINA",    "categoria": "10 REMERAS",          "total_reales": 300.0,    "total_dolares": 58.0,    "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-09-18", "concepto": "OFICINA",    "categoria": "ALQUILER?",           "total_reales": 2318.0,   "total_dolares": 450.0,   "origen_usd": "PLANILLA",       "observaciones": "CONCEPTO A CONFIRMAR"},
    {"fecha": "2026-09-19", "concepto": "OFICINA",    "categoria": "LIMPIEZA ECLIPSE",    "total_reales": 700.0,    "total_dolares": 136.0,   "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-09-21", "concepto": "OFICINA",    "categoria": "ESTACIONAMIENTO SHED","total_reales": 1250.0,   "total_dolares": 243.0,   "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-09-21", "concepto": "OFICINA",    "categoria": "CONTADOR",            "total_reales": 3466.0,   "total_dolares": 673.0,   "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": None,         "concepto": "OPERATIVO",  "categoria": "PARA GASTOS ESTEBAN", "total_reales": 2000.0,   "total_dolares": 388.0,   "origen_usd": "PLANILLA",       "observaciones": "SIN FECHA"},
    {"fecha": "2026-09-22", "concepto": "OPERATIVO",  "categoria": "EQUIPO ESTEBAN VIAJES","total_reales": 13300.0, "total_dolares": 2583.0,  "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-09-22", "concepto": "OPERATIVO",  "categoria": "EQUIPO ESTEBAN SUELDOS","total_reales": 15200.0,"total_dolares": 2951.0,  "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": None,         "concepto": "OPERATIVO",  "categoria": "GASTOS ESTEBAN",      "total_reales": 2000.0,   "total_dolares": 392.0,   "origen_usd": "CALCULADO 5.1",  "observaciones": "SIN FECHA"},
    {"fecha": "2026-09-23", "concepto": "OFICINA",    "categoria": "VUELOS FIT",          "total_reales": 5316.0,   "total_dolares": 1032.0,  "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-09-23", "concepto": "OFICINA",    "categoria": "HOTEL FIT PARAGUAY",  "total_reales": None,     "total_dolares": 510.0,   "origen_usd": "PLANILLA",       "observaciones": "SIN MONTO EN REALES"},
    {"fecha": "2026-09-23", "concepto": "OFICINA",    "categoria": "ELTOM TIM?",          "total_reales": 750.0,    "total_dolares": 147.0,   "origen_usd": "CALCULADO 5.1",  "observaciones": "CONCEPTO A CONFIRMAR"},
    {"fecha": "2026-09-23", "concepto": "DLED",       "categoria": "DATA",                "total_reales": 3000.0,   "total_dolares": 588.0,   "origen_usd": "CALCULADO 5.1",  "observaciones": None},
    {"fecha": "2026-09-23", "concepto": "OFICINA",    "categoria": "CONTADOR",            "total_reales": 18205.45, "total_dolares": 3570.0,  "origen_usd": "CALCULADO 5.1",  "observaciones": None},
    {"fecha": "2026-09-24", "concepto": "OFICINA",    "categoria": "ALQUILER AUTO",       "total_reales": 450.0,    "total_dolares": 88.0,    "origen_usd": "CALCULADO 5.1",  "observaciones": None},
    {"fecha": "2026-09-24", "concepto": "OFICINA",    "categoria": "COMPRAS FIT",         "total_reales": 726.0,    "total_dolares": 142.0,   "origen_usd": "CALCULADO 5.1",  "observaciones": None},
    {"fecha": "2026-09-24", "concepto": "OFICINA",    "categoria": "STAND FIT PY",        "total_reales": None,     "total_dolares": 2850.0,  "origen_usd": "PLANILLA",       "observaciones": "SIN MONTO EN REALES"},
    {"fecha": "2026-09-21", "concepto": "SONIDO",     "categoria": "LUCAS - PAGO DE WOLF","total_reales": 150000.0, "total_dolares": 29412.0, "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-09-21", "concepto": "PORTUNHOL",  "categoria": "QUINTA COMIDA - PAGO WOLF","total_reales": 100000.0,"total_dolares": 19608.0,"origen_usd": "PLANILLA",     "observaciones": None},
    {"fecha": "2026-09-21", "concepto": "MUSIC PARK", "categoria": None,                  "total_reales": 30000.0,  "total_dolares": 5882.0,  "origen_usd": "PLANILLA",       "observaciones": "SIN CATEGORIA"},
    {"fecha": "2026-09-21", "concepto": "MUSIC PARK", "categoria": None,                  "total_reales": 20000.0,  "total_dolares": 3922.0,  "origen_usd": "PLANILLA",       "observaciones": "SIN CATEGORIA"},
    {"fecha": "2026-09-21", "concepto": "AMBULANCIA", "categoria": "SALVADOR - PAGO WOLF","total_reales": 40000.0,  "total_dolares": 7843.0,  "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-09-21", "concepto": "GREENVALLEY","categoria": "PAGO DE WOLF",        "total_reales": 100000.0, "total_dolares": 19608.0, "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-09-21", "concepto": "ZACARIAS",   "categoria": "PAGO DE WOLF",        "total_reales": 40000.0,  "total_dolares": 7843.0,  "origen_usd": "PLANILLA",       "observaciones": None},
    {"fecha": "2026-09-25", "concepto": "AMBULANCIA", "categoria": "SALVADOR",            "total_reales": 10000.0,  "total_dolares": 1961.0,  "origen_usd": "CALCULADO 5.1",  "observaciones": None},
    {"fecha": "2026-09-25", "concepto": "LIMPIEZA",   "categoria": "CAMILA",              "total_reales": 10000.0,  "total_dolares": 1961.0,  "origen_usd": "CALCULADO 5.1",  "observaciones": None},
    {"fecha": "2026-09-25", "concepto": "OFICINA",    "categoria": "CONTADOR",            "total_reales": 13693.0,  "total_dolares": 2685.0,  "origen_usd": "CALCULADO 5.1",  "observaciones": None},
    {"fecha": "2026-09-26", "concepto": "OPERATIVO",  "categoria": "LUISINHO",            "total_reales": 1620.0,   "total_dolares": 318.0,   "origen_usd": "CALCULADO 5.1",  "observaciones": None},
    {"fecha": "2026-09-26", "concepto": "OPERATIVO",  "categoria": "ANDREI",              "total_reales": 750.0,    "total_dolares": 147.0,   "origen_usd": "CALCULADO 5.1",  "observaciones": None},
    {"fecha": "2026-09-26", "concepto": "OPERATIVO",  "categoria": "ANDREI + 2 CAIXA",   "total_reales": 1770.0,   "total_dolares": 347.0,   "origen_usd": "CALCULADO 5.1",  "observaciones": None},
    {"fecha": "2026-09-26", "concepto": "OFICINA",    "categoria": "GASTOS FIT",          "total_reales": 148.0,    "total_dolares": 29.0,    "origen_usd": "CALCULADO 5.1",  "observaciones": None},
    {"fecha": "2026-09-26", "concepto": "OFICINA",    "categoria": "COMIDAS FIT",         "total_reales": 96000.0,  "total_dolares": 18824.0, "origen_usd": "CALCULADO 5.1",  "observaciones": None},
    {"fecha": "2026-09-26", "concepto": "OFICINA",    "categoria": "INTERNET",            "total_reales": 128.0,    "total_dolares": 25.0,    "origen_usd": "CALCULADO 5.1",  "observaciones": None},
    {"fecha": "2026-09-27", "concepto": "OFICINA",    "categoria": "ELIAS DA SILVA NASCIMIENTO?","total_reales": 850.0,"total_dolares": 167.0, "origen_usd": "CALCULADO 5.1",  "observaciones": "CONCEPTO A CONFIRMAR"},
    {"fecha": "2026-09-27", "concepto": "OPERATIVO",  "categoria": "MAQUINAS OPERATIVO SEPTIEMBRE","total_reales": 1500.0,"total_dolares": 294.0,"origen_usd": "CALCULADO 5.1","observaciones": None},
    {"fecha": "2026-09-28", "concepto": "OFICINA",    "categoria": "COMIDAS FIT",         "total_reales": 74800.0,  "total_dolares": 14667.0, "origen_usd": "CALCULADO 5.1",  "observaciones": None},
    {"fecha": "2026-09-29", "concepto": "OFICINA",    "categoria": "COMIDAS FIT",         "total_reales": 82000.0,  "total_dolares": 16078.0, "origen_usd": "CALCULADO 5.1",  "observaciones": None},
    {"fecha": "2026-09-29", "concepto": "OFICINA",    "categoria": "COMIDAS FIT",         "total_reales": 60350.0,  "total_dolares": 11833.0, "origen_usd": "CALCULADO 5.1",  "observaciones": None},
    {"fecha": "2026-09-29", "concepto": "OFICINA",    "categoria": "COMIDAS FIT",         "total_reales": 22200.0,  "total_dolares": 4353.0,  "origen_usd": "CALCULADO 5.1",  "observaciones": None},
    {"fecha": "2026-09-29", "concepto": "OFICINA",    "categoria": "ESTACIONAMIENTO AEROPUERTO","total_reales": 465.0,"total_dolares": 91.0,  "origen_usd": "CALCULADO 5.1",  "observaciones": None},
    {"fecha": "2026-10-01", "concepto": "OPERATIVO",  "categoria": "ILUMINADOR DLED",     "total_reales": 400.0,    "total_dolares": 78.0,    "origen_usd": "CALCULADO 5.1",  "observaciones": None},
    {"fecha": "2026-10-02", "concepto": "OPERATIVO",  "categoria": "DE PAULA",            "total_reales": 3000.0,   "total_dolares": 588.0,   "origen_usd": "CALCULADO 5.1",  "observaciones": None},
]


def seed():
    payload = json.dumps({"gastos": GASTOS}).encode("utf-8")
    url = f"{BACKEND_URL}/gastos/bulk"
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    print(f"-> POST {url} ({len(GASTOS)} gastos)...")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = json.loads(resp.read())
            print(f"OK Insertados: {body['insertados']}")
            print(f"   IDs: {body['ids'][:5]}{'...' if len(body['ids']) > 5 else ''}")
    except urllib.error.HTTPError as e:
        detail = e.read().decode()
        print(f"ERROR HTTP {e.code}: {detail}")
    except Exception as e:
        print(f"ERROR: {e}")


if __name__ == "__main__":
    seed()
