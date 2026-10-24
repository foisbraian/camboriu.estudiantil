from dotenv import load_dotenv
load_dotenv()
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from routers import (
    empresas,
    grupos,
    eventos,
    excel,
    calendario,
    tematicas,
    finanzas,
    vouchers,
    proveedores,
    backup,
    hoteleria,
    maintenance,
    gastos,
    links_personalizados,
    anotaciones_grupo,
)
import models
from database import engine
import alter_db
from routers import upload
from mcp_conector import montar_conector

app = FastAPI()


class LoginBody(BaseModel):
    password: str
    role: str | None = "admin"

# 👇 CREA TABLAS AUTOMÁTICAMENTE
models.Base.metadata.create_all(bind=engine)
try:
    alter_db.upgrade_db()
except Exception as e:
    print(f"Error al ejecutar migraciones automáticas: {e}")

# Configuración de CORS dinámica
frontend_url = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
frontend_urls_env = os.getenv("FRONTEND_URLS", "").strip()
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://camboriu-estudiantil-front.vercel.app",
]

if frontend_url:
    origins.append(frontend_url)
    origins.append(frontend_url + "/")

if frontend_urls_env:
    extra_urls = [u.strip().rstrip("/") for u in frontend_urls_env.split(",") if u.strip()]
    for url in extra_urls:
        origins.append(url)
        origins.append(url + "/")

origins = list(dict.fromkeys(origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": f"Error interno del servidor: {str(exc)}"},
    )

@app.post("/login")
def login(body: LoginBody):
    admin_pass = os.getenv("ADMIN_PASSWORD", "Graciasburgos2026").strip()
    validator_pass = os.getenv("VALIDATOR_PASSWORD", "CamboriuValidator2026").strip()
    calendar_pass = os.getenv("CALENDAR_PASSWORD", "CamboriuCalendar2026").strip()
    equipo_pass = os.getenv("EQUIPO_PASSWORD", "esteban").strip()

    requested_role = (body.role or "").strip().lower()

    resolved_role = None
    if body.password == admin_pass:
        resolved_role = "admin"
    elif body.password == validator_pass:
        resolved_role = "validator"
    elif body.password == calendar_pass:
        resolved_role = "calendar"
    elif equipo_pass and body.password == equipo_pass:
        resolved_role = "equipo"

    if not resolved_role:
        raise HTTPException(status_code=401, detail="Contraseña incorrecta")

    if requested_role and requested_role not in {"admin", "validator", "calendar", "equipo"}:
        raise HTTPException(status_code=400, detail="Rol no soportado")

    if requested_role and requested_role != resolved_role:
        allowed_mismatch = requested_role == "admin" and resolved_role == "calendar"
        if not allowed_mismatch:
            raise HTTPException(status_code=401, detail="La contraseña no corresponde al rol seleccionado")

    token_map = {
        "admin": "admin_granted",
        "validator": "validator_access",
        "calendar": "calendar_view",
        "equipo": "equipo_access",
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
app.include_router(backup.router)
app.include_router(hoteleria.router)
app.include_router(maintenance.router)
app.include_router(upload.router)
app.include_router(gastos.router)
app.include_router(links_personalizados.router)
app.include_router(anotaciones_grupo.router)

# Conector de Claude (solo lectura). Se activa con la variable de entorno MCP_TOKEN.
montar_conector(app)
