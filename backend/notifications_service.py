import os
import json
import logging
import threading
from urllib.parse import urlparse
from typing import Optional, Dict, Any, Union, List

from pywebpush import webpush, WebPushException
from py_vapid import Vapid
from py_vapid.utils import b64urlencode
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

from database import SessionLocal
import models

logger = logging.getLogger("notifications")

VAPID_FILE = os.path.join(os.path.dirname(__file__), "vapid_keys.json")
VAPID_SUBJECT = os.getenv("VAPID_SUBJECT", "mailto:notificaciones@camboriu.app")


def get_vapid_instance() -> Vapid:
    """
    Retorna una instancia de Vapid ya inicializada y lista para firmar.
    Soporta:
    1. Variables de entorno (VAPID_PRIVATE_KEY o VAPID_PRIVATE_PEM)
    2. Archivo vapid_keys.json
    3. Generación automática y almacenamiento
    """
    env_priv = os.getenv("VAPID_PRIVATE_KEY") or os.getenv("VAPID_PRIVATE_PEM")
    if env_priv:
        cleaned = env_priv.replace("\\n", "\n").strip()
        try:
            return Vapid.from_pem(cleaned.encode("utf-8"))
        except Exception as e:
            print(f"[VAPID] Error cargando VAPID desde env: {e}")

    if os.path.exists(VAPID_FILE):
        try:
            with open(VAPID_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if data.get("private_pem"):
                    cleaned = data["private_pem"].replace("\\n", "\n").strip()
                    return Vapid.from_pem(cleaned.encode("utf-8"))
        except Exception as e:
            print(f"[VAPID] Error cargando {VAPID_FILE}: {e}")

    # Fallback: Generar nuevas claves
    vapid = Vapid()
    vapid.generate_keys()
    try:
        pub_bytes = vapid.public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
        pub_b64 = b64urlencode(pub_bytes)
        priv_pem = vapid.private_pem().decode("utf-8")
        with open(VAPID_FILE, "w", encoding="utf-8") as f:
            json.dump({"public_key": pub_b64, "private_pem": priv_pem}, f, indent=2)
        print(f"[VAPID] Claves generadas y guardadas en {VAPID_FILE}")
    except Exception as e:
        print(f"[VAPID] No se pudo guardar {VAPID_FILE}: {e}")

    return vapid


def get_vapid_public_key() -> str:
    env_pub = os.getenv("VAPID_PUBLIC_KEY")
    if env_pub and env_pub.strip():
        return env_pub.strip()

    vapid = get_vapid_instance()
    pub_bytes = vapid.public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
    return b64urlencode(pub_bytes)


def _send_push_worker(role: Union[str, List[str], None], title: str, body: str, url: str = "/calendario"):
    """
    Ejecutado en un hilo secundario para no bloquear la respuesta HTTP.
    Busca todas las suscripciones del rol o roles especificados y envía la notificación.
    """
    print(f"[PUSH] Iniciando envio: '{title}' - '{body}' para roles: {role}")
    
    try:
        vapid_obj = get_vapid_instance()
    except Exception as e:
        print(f"[PUSH ERROR] No se pudo inicializar la clave VAPID: {e}")
        return

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
            if isinstance(role, (list, tuple, set)):
                query = query.filter(models.PushSubscription.role.in_([r.lower() for r in role]))
            else:
                query = query.filter(models.PushSubscription.role == role.lower())
        
        subscriptions = query.all()
        print(f"[PUSH] Total dispositivos encontrados en DB: {len(subscriptions)}")

        if not subscriptions:
            print(f"[PUSH AVISO] No hay ningun dispositivo suscrito para roles={role}.")
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
                # ⭐ Cada proveedor (Google, Apple, Mozilla, etc.) requiere su propio origin en 'aud'.
                # pywebpush muta el diccionario 'claims' in-place, por eso lo generamos fresco por dispositivo:
                endpoint_url = urlparse(sub.endpoint)
                aud = f"{endpoint_url.scheme}://{endpoint_url.netloc}"
                sub_claims = {
                    "sub": VAPID_SUBJECT,
                    "aud": aud
                }

                webpush(
                    subscription_info=sub_info,
                    data=payload,
                    vapid_private_key=vapid_obj,
                    vapid_claims=sub_claims,
                    ttl=86400  # 24 horas si el dispositivo está apagado
                )
                sent_count += 1
                print(f"[PUSH EXITO] Notificacion enviada correctamente a {aud} [rol: {sub.role}]")
            except WebPushException as ex:
                status_code = getattr(ex.response, "status_code", None)
                print(f"[PUSH ERROR WebPush] status={status_code}, error={ex}")
                # 404 Not Found o 410 Gone indican suscripción expirada o desinstalada
                if status_code in (404, 410):
                    dead_ids.append(sub.id)
            except Exception as e:
                print(f"[PUSH ERROR Inesperado] {e}")

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
                print(f"[PUSH ERROR] Error borrando suscripciones vencidas: {e}")

        print(f"[PUSH FINALIZADO] Enviado con exito a {sent_count}/{len(subscriptions)} dispositivo(s).")

    finally:
        db.close()


def notify_role(role: Union[str, List[str], None] = "equipo", title: str = "Cambio en Calendario", body: str = "", url: str = "/calendario"):
    """
    Envía una notificación push asincrónica a todos los usuarios con el rol dado.
    """
    thread = threading.Thread(
        target=_send_push_worker,
        args=(role, title, body, url),
        daemon=True
    )
    thread.start()
