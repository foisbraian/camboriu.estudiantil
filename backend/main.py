import os
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware

from routers import empresas, grupos, eventos, excel, calendario, tematicas, finanzas, vouchers, proveedores
import models
from database import engine

app = FastAPI()

# 👇 CREA TABLAS AUTOMÁTICAMENTE
models.Base.metadata.create_all(bind=engine)

# Configuración de CORS dinámica
origins = [
    "http://localhost:3000",
    os.getenv("FRONTEND_URL", "*") # Si no hay URL, permite todo (útil para Render)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/login")
def login(password: str = Body(..., embed=True)):
    admin_pass = os.getenv("ADMIN_PASSWORD", "Graciasburgos2026")
    if password == admin_pass:
        return {"auth": True, "token": "admin_granted"}
    raise HTTPException(status_code=401, detail="Contraseña incorrecta")

app.include_router(empresas.router)
app.include_router(grupos.router)
app.include_router(eventos.router)
app.include_router(excel.router)
app.include_router(calendario.router)
app.include_router(tematicas.router)
app.include_router(finanzas.router)
app.include_router(vouchers.router)
app.include_router(proveedores.router)
