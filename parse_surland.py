import pandas as pd

parsed = [
    {
        "Nombre": "Chilenos 1",
        "PAX": 115,
        "Fecha Entrada": "2026-12-06",
        "Fecha Salida": "2026-12-12", # 6 noches
        "Discos": 6,
        "Campamento Acceso": "Si",
        "Campamento Con Comida": "Si", # typically yes
        "Zacarias Acceso": "Si",
        "Zacarias Con Comida": "Si",
        "Pool Acceso": "No",
        "Pool Con Comida": "No",
        "Permite Alcohol": "No",
        "Mix": "No",
        "Parque Acceso": "No",
        "Parque Con Comida": "No",
        "Beto": "Si",
        "Cena de velas": "Si"
    },
    {
        "Nombre": "Chilenos 2",
        "PAX": 150,
        "Fecha Entrada": "2026-12-12",
        "Fecha Salida": "2026-12-18", # 6 noches
        "Discos": 6,
        "Campamento Acceso": "Si",
        "Campamento Con Comida": "Si",
        "Zacarias Acceso": "Si",
        "Zacarias Con Comida": "Si",
        "Pool Acceso": "No",
        "Pool Con Comida": "No",
        "Permite Alcohol": "No",
        "Mix": "No",
        "Parque Acceso": "No",
        "Parque Con Comida": "No",
        "Beto": "Si",
        "Cena de velas": "Si"
    },
    {
        "Nombre": "Argentinos 1",
        "PAX": 100,
        "Fecha Entrada": "2026-12-12",
        "Fecha Salida": "2026-12-20", # 8 noches
        "Discos": 8,
        "Campamento Acceso": "Si",
        "Campamento Con Comida": "Si",
        "Zacarias Acceso": "Si",
        "Zacarias Con Comida": "Si",
        "Pool Acceso": "No",
        "Pool Con Comida": "No",
        "Permite Alcohol": "Si",
        "Mix": "No",
        "Parque Acceso": "No",
        "Parque Con Comida": "No",
        "Beto": "Si",
        "Cena de velas": "No"
    },
    {
        "Nombre": "Argentinos 2",
        "PAX": 100,
        "Fecha Entrada": "2026-12-18",
        "Fecha Salida": "2026-12-26", # 8 noches
        "Discos": 8,
        "Campamento Acceso": "Si",
        "Campamento Con Comida": "Si",
        "Zacarias Acceso": "Si",
        "Zacarias Con Comida": "Si",
        "Pool Acceso": "No",
        "Pool Con Comida": "No",
        "Permite Alcohol": "Si",
        "Mix": "No",
        "Parque Acceso": "No",
        "Parque Con Comida": "No",
        "Beto": "Si",
        "Cena de velas": "No"
    },
    {
        "Nombre": "Argentinos 3",
        "PAX": 240,
        "Fecha Entrada": "2026-12-20",
        "Fecha Salida": "2026-12-28", # 8 noches
        "Discos": 8,
        "Campamento Acceso": "Si",
        "Campamento Con Comida": "Si",
        "Zacarias Acceso": "Si",
        "Zacarias Con Comida": "Si",
        "Pool Acceso": "No",
        "Pool Con Comida": "No",
        "Permite Alcohol": "Si",
        "Mix": "No",
        "Parque Acceso": "No",
        "Parque Con Comida": "No",
        "Beto": "Si",
        "Cena de velas": "No"
    }
]

df = pd.DataFrame(parsed)
df.to_excel('Grupos_Surland.xlsx', index=False)
print("Hecho")
