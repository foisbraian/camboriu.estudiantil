from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Dict
from sqlalchemy.orm import Session

from database import get_db
import models
from notifications_service import get_vapid_public_key, notify_role

router = APIRouter(prefix="/notifications", tags=["notifications"])


class KeysSchema(BaseModel):
    p256dh: str
    auth: str


class SubscribeBody(BaseModel):
    endpoint: str
    keys: KeysSchema
    role: Optional[str] = "equipo"


class UnsubscribeBody(BaseModel):
    endpoint: str


class TestNotificationBody(BaseModel):
    role: Optional[str] = "equipo"
    title: Optional[str] = "Prueba de Notificación"
    body: Optional[str] = "Las notificaciones del sistema están funcionando correctamente."
    url: Optional[str] = "/calendario"


@router.get("/vapid-public-key")
def get_public_key():
    try:
        public_key = get_vapid_public_key()
        return {"public_key": public_key}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo clave pública VAPID: {str(e)}")


@router.post("/subscribe")
def subscribe(body: SubscribeBody, request: Request, db: Session = Depends(get_db)):
    if not body.endpoint or not body.keys.p256dh or not body.keys.auth:
        raise HTTPException(status_code=400, detail="Faltan datos de la suscripción push")

    user_agent = request.headers.get("user-agent", "")
    target_role = (body.role or "equipo").strip().lower()

    sub = db.query(models.PushSubscription).filter_by(endpoint=body.endpoint).first()
    if sub:
        sub.p256dh = body.keys.p256dh
        sub.auth = body.keys.auth
        sub.role = target_role
        sub.user_agent = user_agent
    else:
        sub = models.PushSubscription(
            endpoint=body.endpoint,
            p256dh=body.keys.p256dh,
            auth=body.keys.auth,
            role=target_role,
            user_agent=user_agent
        )
        db.add(sub)

    db.commit()
    return {"ok": True, "message": f"Dispositivo registrado para alertas de rol '{target_role}'"}


@router.post("/unsubscribe")
def unsubscribe(body: UnsubscribeBody, db: Session = Depends(get_db)):
    db.query(models.PushSubscription).filter_by(endpoint=body.endpoint).delete()
    db.commit()
    return {"ok": True, "message": "Suscripción cancelada"}


@router.post("/test")
def test_notification(body: TestNotificationBody):
    target_role = body.role if body.role else ["equipo", "admin"]
    notify_role(
        role=target_role,
        title=body.title or "Prueba de Notificación",
        body=body.body or "Notificación de prueba enviada desde el sistema",
        url=body.url or "/calendario"
    )
    return {"ok": True, "message": f"Notificación disparada para '{target_role}'"}
