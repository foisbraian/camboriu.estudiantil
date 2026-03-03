import os
import shutil
import subprocess
import tempfile
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse

from database import DATABASE_URL


router = APIRouter(prefix="/backup", tags=["Backup"])


def _cleanup_file(path: str):
    try:
        os.remove(path)
    except OSError:
        pass


def _resolve_sqlite_path(url: str) -> str:
    raw_path = url.replace("sqlite:///", "", 1)
    return os.path.abspath(raw_path)


IS_SQLITE = DATABASE_URL.startswith("sqlite")
SQLITE_PATH = _resolve_sqlite_path(DATABASE_URL) if IS_SQLITE else None


@router.get("/database", summary="Descargar una copia completa de la base de datos")
def descargar_backup(background_tasks: BackgroundTasks):
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    if IS_SQLITE:
        if not SQLITE_PATH or not os.path.exists(SQLITE_PATH):
            raise HTTPException(status_code=404, detail="Archivo SQLite no encontrado en el servidor")

        with tempfile.NamedTemporaryFile(delete=False, suffix=".db") as tmp:
            shutil.copy2(SQLITE_PATH, tmp.name)
            tmp_path = tmp.name

        filename = f"backup_sqlite_{timestamp}.db"
        background_tasks.add_task(_cleanup_file, tmp_path)
        return FileResponse(tmp_path, filename=filename, media_type="application/octet-stream")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".sql") as tmp:
        tmp_path = tmp.name

    try:
        with open(tmp_path, "w", encoding="utf-8") as dump_file:
            result = subprocess.run(
                ["pg_dump", DATABASE_URL],
                stdout=dump_file,
                stderr=subprocess.PIPE,
                text=True,
                check=False,
            )
    except FileNotFoundError:
        _cleanup_file(tmp_path)
        raise HTTPException(
            status_code=500,
            detail="pg_dump no está instalado en el servidor. Solicita al administrador que agregue las utilidades de PostgreSQL.",
        )

    if result.returncode != 0:
        error_detail = (result.stderr or "").strip() or "pg_dump devolvió un código distinto de cero"
        _cleanup_file(tmp_path)
        raise HTTPException(status_code=500, detail=f"No se pudo generar el backup: {error_detail}")

    filename = f"backup_postgres_{timestamp}.sql"
    background_tasks.add_task(_cleanup_file, tmp_path)
    return FileResponse(tmp_path, filename=filename, media_type="application/sql")
