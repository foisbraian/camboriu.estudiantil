import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from routers import empresas, grupos, eventos, excel, calendario, tematicas, finanzas, vouchers, proveedores
import models
from database import engine

app = FastAPI()


class LoginBody(BaseModel):
    password: str
    role: str | None = "admin"

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
def login(body: LoginBody):
    role = (body.role or "admin").lower()
    admin_pass = os.getenv("ADMIN_PASSWORD", "Graciasburgos2026")
    validator_pass = os.getenv("VALIDATOR_PASSWORD", "CamboriuValidator2026")

    if role == "admin":
        if body.password == admin_pass:
            return {"auth": True, "token": "admin_granted", "role": "admin"}
        raise HTTPException(status_code=401, detail="Contraseña incorrecta para administrador")

    if role == "validator":
        if body.password == validator_pass:
            return {"auth": True, "token": "validator_access", "role": "validator"}
        raise HTTPException(status_code=401, detail="Contraseña incorrecta para validador")

    raise HTTPException(status_code=400, detail="Rol no soportado")

app.include_router(empresas.router)
app.include_router(grupos.router)
app.include_router(eventos.router)
app.include_router(excel.router)
app.include_router(calendario.router)
app.include_router(tematicas.router)
app.include_router(finanzas.router)
app.include_router(vouchers.router)
app.include_router(proveedores.router)
