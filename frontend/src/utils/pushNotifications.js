import { BASE_URL } from "../api";

// Convierte la clave VAPID pública en base64 URL-safe a Uint8Array (exigido por pushManager)
export function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export function isPushSupported() {
    return (
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window
    );
}

export async function getVapidPublicKey() {
    try {
        const res = await fetch(`${BASE_URL}/notifications/vapid-public-key`);
        if (!res.ok) throw new Error("No se pudo obtener la clave VAPID del servidor");
        const data = await res.json();
        return data.public_key;
    } catch (e) {
        console.warn("Fallo al obtener VAPID del backend, usando fallback:", e);
        return process.env.REACT_APP_VAPID_PUBLIC_KEY || "";
    }
}

export async function checkPushSubscriptionStatus() {
    if (!isPushSupported()) return false;
    if (Notification.permission !== "granted") return false;

    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        return !!subscription;
    } catch (e) {
        console.error("Error comprobando suscripción push:", e);
        return false;
    }
}

export async function subscribeToPushNotifications(role = "equipo") {
    if (!isPushSupported()) {
        throw new Error("Las notificaciones push no están soportadas en este navegador o dispositivo.");
    }

    // 1. Pedir permiso al usuario
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
        throw new Error("Permiso de notificaciones denegado.");
    }

    // 2. Obtener clave pública VAPID
    const vapidKey = await getVapidPublicKey();
    if (!vapidKey) {
        throw new Error("No se encontró la clave pública VAPID.");
    }

    // 3. Registrar suscripción en el navegador
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
        const convertedKey = urlBase64ToUint8Array(vapidKey);
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedKey,
        });
    }

    const subJson = subscription.toJSON();

    // 4. Enviar suscripción al backend
    const res = await fetch(`${BASE_URL}/notifications/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            endpoint: subJson.endpoint,
            keys: {
                p256dh: subJson.keys.p256dh,
                auth: subJson.keys.auth,
            },
            role: role || "equipo",
        }),
    });

    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Error al registrar la suscripción en el servidor.");
    }

    localStorage.setItem("push_notifications_enabled", "true");
    return true;
}

export async function unsubscribeFromPushNotifications() {
    if (!isPushSupported()) return true;

    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            await fetch(`${BASE_URL}/notifications/unsubscribe`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ endpoint: subscription.endpoint }),
            }).catch(() => null);

            await subscription.unsubscribe();
        }
        localStorage.removeItem("push_notifications_enabled");
        return true;
    } catch (e) {
        console.error("Error al cancelar suscripción push:", e);
        return false;
    }
}

export async function sendTestPush(role = "equipo") {
    const res = await fetch(`${BASE_URL}/notifications/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            role: role,
            title: "🔔 ¡Notificaciones Activadas!",
            body: "Te avisaremos aquí cada vez que se agregue o modifique una fecha en el calendario.",
            url: "/calendario"
        }),
    });
    return res.ok;
}
