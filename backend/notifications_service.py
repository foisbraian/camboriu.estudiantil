import os
import json
import logging
import threading
from typing import Optional, Dict, Any

from pywebpush import webpush, WebPushException
from py_vapid import Vapid
from py_vapid.utils import b64urlencode
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

from database import SessionLocal
import models

logger = logging.getLogger("notifications")

VAPID_FILE = os.path.join(os.path.dirname(__file__), "vapid_keys.json")
VAPID_SUBJECT = os.getenv("VAPID_SUBJECT", "mailto:notificaciones@camboriu.app")


def get_or_create_vapid_keys() -> Dict[str, str]:
    """
    Obtiene o crea el par de claves VAPID (pública y privada).
    Prioridad:
    1. Variables de entorno (VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY / VAPID_PRIVATE_PEM)
    2. Archivo vapid_keys.json
    3. Si no existen, genera un par nuevo y lo guarda en vapid_keys.json
    """
    env_pub = os.getenv("VAPID_PUBLIC_KEY")
    env_priv = os.getenv("VAPID_PRIVATE_KEY") or os.getenv("VAPID_PRIVATE_PEM")

    if env_pub and env_priv:
        # Si la clave privada tiene los escapes de salto de línea, normalizamos
        priv_cleaned = env_priv.replace("\\n", "\n").strip()
        return {
            "public_key": env_pub.strip(),
            "private_pem": priv_cleaned,
        }

    # Revisar si existe archivo local
    if os.path.exists(VAPID_FILE):
        try:
            with open(VAPID_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if data.get("public_key") and data.get("private_pem"):
                    return data
        except Exception as e:
            logger.warning(f"Error leyendo {VAPID_FILE}: {e}")

    # Generar un nuevo par de claves VAPID
    vapid = Vapid()
    vapid.generate_keys()

    pub_bytes = vapid.public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
    pub_b64 = b64urlencode(pub_bytes)
    priv_pem = vapid.private_pem().decode("utf-8")

    keys_data = {
        "public_key": pub_b64,
        "private_pem": priv_pem,
    }

    try:
        with open(VAPID_FILE, "w", encoding="utf-8") as f:
            json.dump(keys_data, f, indent=2)
        print(f"[VAPID] Claves generadas y guardadas en {VAPID_FILE}")
    except Exception as e:
        logger.warning(f"No se pudo guardar {VAPID_FILE}: {e}")

    return keys_data


def get_vapid_public_key() -> str:
    keys = get_or_create_vapid_keys()
    return keys["public_key"]


def _send_push_worker(role: str, title: str, body: str, url: str = "/calendario"):
    """
    Ejecutado en un hilo secundario para no bloquear la respuesta HTTP.
    Busca todas las suscripciones del rol especificado y envía la notificación.
    """
    keys = get_or_create_vapid_keys()
    private_pem = keys["private_pem"]
    claims = {"sub": VAPID_SUBJECT}

    payload = json.dumps({
        "title": title,
        "body": body,
        "url": url,
    })

    db = SessionLocal()
    dead_ids = []
    sent_count = 0

    try:
        query = db.query(models.PushSubscription)
        if role and role != "all":
            query = query.filter(models.PushSubscription.role == role)
        
        subscriptions = query.all()
        if not subscriptions:
            return

        for sub in subscriptions:
            sub_info = {
                "endpoint": sub.endpoint,
                "keys": {
                    "p256dh": sub.p256dh,
                    "auth": sub.auth,
                }
            }

            try:
                webpush(
                    subscription_info=sub_info,
                    data=payload,
                    vapid_private_key=private_pem,
                    vapid_claims=claims,
                    ttl=86400  # 24 horas si el dispositivo está apagado
                )
                sent_count += 1
            except WebPushException as ex:
                status_code = getattr(ex.response, "status_code", None)
                # 404 Not Found o 410 Gone indican suscripción expirada o desinstalada
                if status_code in (404, 410):
                    dead_ids.append(sub.id)
                else:
                    logger.warning(f"Fallo al enviar push a {sub.endpoint}: {ex}")
            except Exception as e:
                logger.error(f"Error inesperado enviando push: {e}")

        # Limpiar suscripciones inválidas o dadas de baja
        if dead_ids:
            try:
                db.query(models.PushSubscription).filter(
                    models.PushSubscription.id.in_(dead_ids)
                ).delete(synchronize_session=False)
                db.commit()
                print(f"[PUSH] Se eliminaron {len(dead_ids)} suscripciones push vencidas.")
            except Exception as e:
                db.rollback()
                logger.error(f"Error borrando suscripciones vencidas: {e}")

        if sent_count > 0:
            print(f"[PUSH] Notificacion enviada con exito a {sent_count} dispositivo(s) [rol: {role}]: '{title}'")

    finally:
        db.close()


def notify_role(role: str = "equipo", title: str = "Cambio en Calendario", body: str = "", url: str = "/calendario"):
    """
    Envía una notificación push asincrónica a todos los usuarios con el rol dado.
    """
    thread = threading.Thread(
        target=_send_push_worker,
        args=(role, title, body, url),
        daemon=True
    )
    thread.start()
