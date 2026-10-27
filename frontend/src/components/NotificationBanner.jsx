import React, { useState, useEffect } from "react";
import {
    isPushSupported,
    checkPushSubscriptionStatus,
    subscribeToPushNotifications,
    unsubscribeFromPushNotifications,
    sendTestPush,
} from "../utils/pushNotifications";

export default function NotificationBanner() {
    const [supported, setSupported] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [dismissed, setDismissed] = useState(false);

    const role = localStorage.getItem("auth_role") || "equipo";
    const isEquipoOrAdmin = role === "equipo" || role === "admin";

    useEffect(() => {
        const isSupp = isPushSupported();
        setSupported(isSupp);

        if (isSupp) {
            checkPushSubscriptionStatus().then((sub) => {
                setIsSubscribed(sub);
            });
        }
    }, []);

    // Si no está soportado o no es rol equipo/admin o fue descartado, no mostrar
    if (!supported || !isEquipoOrAdmin || dismissed) {
        return null;
    }

    const handleSubscribe = async () => {
        setLoading(true);
        setMessage(null);
        try {
            await subscribeToPushNotifications(role);
            setIsSubscribed(true);
            setMessage({ type: "success", text: "¡Listo! Notificaciones activadas para tu celular." });
            // Enviar notificación de prueba de bienvenida
            setTimeout(() => {
                sendTestPush(role).catch(() => null);
            }, 1000);
        } catch (err) {
            setMessage({ type: "error", text: err.message || "No se pudieron activar las notificaciones." });
        } finally {
            setLoading(false);
        }
    };

    const handleUnsubscribe = async () => {
        setLoading(true);
        try {
            await unsubscribeFromPushNotifications();
            setIsSubscribed(false);
            setMessage({ type: "info", text: "Notificaciones desactivadas en este dispositivo." });
        } catch (err) {
            setMessage({ type: "error", text: "Error al desactivar notificaciones." });
        } finally {
            setLoading(false);
        }
    };

    const handleTest = async () => {
        setLoading(true);
        try {
            await sendTestPush(role);
            setMessage({ type: "success", text: "Enviando alerta de prueba a tu celular..." });
        } catch (err) {
            setMessage({ type: "error", text: "Error enviando notificación de prueba." });
        } finally {
            setLoading(false);
        }
    };

    // Si ya está suscrito, mostramos un badge discreto o compacto
    if (isSubscribed) {
        return (
            <div
                style={{
                    background: "rgba(16, 185, 129, 0.12)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    borderRadius: 12,
                    padding: "10px 16px",
                    margin: "12px 0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 10,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "1.2rem" }}>🔔</span>
                    <span style={{ color: "#10b981", fontSize: "0.88rem", fontWeight: 600 }}>
                        Avisos de cambios de fecha activos
                    </span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    <button
                        onClick={handleTest}
                        disabled={loading}
                        style={{
                            background: "rgba(255,255,255,0.08)",
                            color: "#e2e8f0",
                            border: "1px solid rgba(255,255,255,0.15)",
                            borderRadius: 6,
                            padding: "6px 10px",
                            fontSize: "0.78rem",
                            cursor: "pointer",
                        }}
                    >
                        Probar
                    </button>
                    <button
                        onClick={handleUnsubscribe}
                        disabled={loading}
                        style={{
                            background: "transparent",
                            color: "#94a3b8",
                            border: "none",
                            fontSize: "0.78rem",
                            cursor: "pointer",
                            textDecoration: "underline",
                        }}
                    >
                        Desactivar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            style={{
                background: "linear-gradient(135deg, rgba(37, 99, 235, 0.2), rgba(30, 41, 59, 0.95))",
                border: "1px solid rgba(59, 130, 246, 0.35)",
                borderRadius: 14,
                padding: "14px 18px",
                margin: "14px 0",
                boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
                position: "relative",
            }}
        >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", gap: 12 }}>
                    <div
                        style={{
                            width: 38,
                            height: 38,
                            borderRadius: "50%",
                            background: "rgba(59, 130, 246, 0.25)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "1.2rem",
                            flexShrink: 0,
                        }}
                    >
                        🔔
                    </div>
                    <div>
                        <h4 style={{ margin: "0 0 4px", color: "#f8fafc", fontSize: "0.98rem", fontWeight: 700 }}>
                            ¿Querés recibir avisos al instante?
                        </h4>
                        <p style={{ margin: 0, color: "#cbd5e1", fontSize: "0.84rem", lineHeight: 1.4 }}>
                            Te llegará una notificación al celular cada vez que se agreguen, cambien o cancelen fechas en el calendario.
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => setDismissed(true)}
                    style={{
                        background: "transparent",
                        border: "none",
                        color: "#94a3b8",
                        cursor: "pointer",
                        fontSize: "1.1rem",
                        padding: 0,
                        lineHeight: 1,
                    }}
                    title="Cerrar"
                >
                    ✕
                </button>
            </div>

            {message && (
                <div
                    style={{
                        marginTop: 10,
                        fontSize: "0.82rem",
                        color: message.type === "success" ? "#34d399" : message.type === "info" ? "#93c5fd" : "#f87171",
                    }}
                >
                    {message.text}
                </div>
            )}

            <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                    onClick={() => setDismissed(true)}
                    style={{
                        background: "rgba(255, 255, 255, 0.06)",
                        color: "#94a3b8",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: 8,
                        padding: "8px 14px",
                        fontSize: "0.85rem",
                        fontWeight: 500,
                        cursor: "pointer",
                    }}
                >
                    Ahora no
                </button>
                <button
                    onClick={handleSubscribe}
                    disabled={loading}
                    style={{
                        background: "#2563eb",
                        color: "white",
                        border: "none",
                        borderRadius: 8,
                        padding: "8px 16px",
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        cursor: loading ? "wait" : "pointer",
                        boxShadow: "0 2px 8px rgba(37,99,235,0.4)",
                    }}
                >
                    {loading ? "Activando..." : "Activar Notificaciones"}
                </button>
            </div>
        </div>
    );
}
