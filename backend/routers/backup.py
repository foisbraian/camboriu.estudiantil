import os
import shutil
import subprocess
import tempfile
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, File
from fastapi.responses import FileResponse

from database import DATABASE_URL, engine


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


def _write_upload_to_temp(upload: UploadFile) -> str:
    suffix = os.path.splitext(upload.filename or "")[1] or ".sql"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        upload.file.seek(0)
        shutil.copyfileobj(upload.file, tmp)
        return tmp.name


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


@router.post("/database", summary="Restaurar la base de datos desde un backup")
async def restaurar_backup(file: UploadFile = File(...)):
    if not file:
        raise HTTPException(status_code=400, detail="Debes adjuntar un archivo de backup")

    tmp_path = _write_upload_to_temp(file)

    if IS_SQLITE:
        if not SQLITE_PATH:
            _cleanup_file(tmp_path)
            raise HTTPException(status_code=500, detail="Ruta de SQLite no configurada")

        if not os.path.exists(SQLITE_PATH):
            # Creamos el archivo si no existe
            os.makedirs(os.path.dirname(SQLITE_PATH) or ".", exist_ok=True)

        try:
            engine.dispose()
            shutil.copy2(tmp_path, SQLITE_PATH)
        finally:
            _cleanup_file(tmp_path)

        return {"detail": "Base SQLite restaurada correctamente"}

    drop_schema_cmd = [
        "psql",
        DATABASE_URL,
        "-c",
        "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
    ]
    restore_cmd = ["psql", DATABASE_URL, "-f", tmp_path]

    try:
        for cmd, msg in (
            (drop_schema_cmd, "No se pudo reiniciar el esquema actual"),
            (restore_cmd, "No se pudo restaurar el backup"),
        ):
            try:
                result = subprocess.run(cmd, capture_output=True, text=True, check=False)
            except FileNotFoundError:
                raise HTTPException(
                    status_code=500,
                    detail="psql no está disponible en el servidor. Instala las utilidades de PostgreSQL.",
                ) from None

            if result.returncode != 0:
                error_text = (result.stderr or result.stdout or "").strip()
                _cleanup_file(tmp_path)
                raise HTTPException(status_code=500, detail=f"{msg}: {error_text}")
    finally:
        _cleanup_file(tmp_path)

    return {"detail": "Base de datos restaurada correctamente"}
