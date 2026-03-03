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
    admin_pass = os.getenv("ADMIN_PASSWORD", "Graciasburgos2026").strip()
    validator_pass = os.getenv("VALIDATOR_PASSWORD", "CamboriuValidator2026").strip()
    calendar_pass = os.getenv("CALENDAR_PASSWORD", "CamboriuCalendar2026").strip()

    requested_role = (body.role or "").strip().lower()

    resolved_role = None
    if body.password == admin_pass:
        resolved_role = "admin"
    elif body.password == validator_pass:
        resolved_role = "validator"
    elif body.password == calendar_pass:
        resolved_role = "calendar"

    if not resolved_role:
        raise HTTPException(status_code=401, detail="Contraseña incorrecta")

    if requested_role and requested_role not in {"admin", "validator", "calendar"}:
        raise HTTPException(status_code=400, detail="Rol no soportado")

    if requested_role and requested_role != resolved_role:
        allowed_mismatch = requested_role == "admin" and resolved_role == "calendar"
        if not allowed_mismatch:
            raise HTTPException(status_code=401, detail="La contraseña no corresponde al rol seleccionado")

    token_map = {
        "admin": "admin_granted",
        "validator": "validator_access",
        "calendar": "calendar_view",
    }
    token = token_map.get(resolved_role, "admin_granted")
    return {"auth": True, "token": token, "role": resolved_role}

app.include_router(empresas.router)
app.include_router(grupos.router)
app.include_router(eventos.router)
app.include_router(excel.router)
app.include_router(calendario.router)
app.include_router(tematicas.router)
app.include_router(finanzas.router)
app.include_router(vouchers.router)
app.include_router(proveedores.router)
