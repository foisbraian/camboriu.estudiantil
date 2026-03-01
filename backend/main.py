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
frontend_url = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
origins = ["http://localhost:3000"]

if frontend_url:
    origins.append(frontend_url)
    # También permitimos la versión con y sin barra al final por si acaso
    origins.append(frontend_url + "/")

# Si no hay FRONTEND_URL, permitimos todo (pero sin credenciales por seguridad y compatibilidad)
if not frontend_url:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
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
