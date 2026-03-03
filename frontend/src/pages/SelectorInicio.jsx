import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BASE_URL } from "../api";

export default function SelectorInicio() {
    const navigate = useNavigate();
    const [isDownloadingBackup, setIsDownloadingBackup] = useState(false);
    const [backupFeedback, setBackupFeedback] = useState(null);

    const handleBackupDownload = async () => {
        setBackupFeedback(null);
        setIsDownloadingBackup(true);

        try {
            const response = await fetch(`${BASE_URL}/backup/database`);
            if (!response.ok) {
                let detail = "No se pudo generar el backup";
                const raw = await response.text();
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw);
                        detail = parsed?.detail || detail;
                    } catch (_) {
                        detail = raw;
                    }
                }
                throw new Error(detail);
            }

            const blob = await response.blob();
            const disposition = response.headers.get("content-disposition");
            let filename = `backup_eventos_${new Date().toISOString().slice(0, 10)}.sql`;
            if (disposition) {
                const match = disposition.match(/filename="?([^";]+)"?/i);
                if (match?.[1]) {
                    filename = match[1];
                }
            }

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            setBackupFeedback({ type: "success", text: "Backup descargado correctamente." });
        } catch (error) {
            setBackupFeedback({ type: "error", text: error.message || "Error desconocido." });
        } finally {
            setIsDownloadingBackup(false);
        }
    };

    const cards = [
        {
            title: "📅 Gestión de Calendario",
            desc: "Administrar eventos, empresas y disponibilidad en el calendario global.",
            path: "/calendario",
            color: "#2563eb",
        },
        {
            title: "💰 Módulo de Finanzas",
            desc: "Ver resúmenes financieros, registrar pagos y controlar el estado de cuentas.",
            path: "/finanzas",
            color: "#059669",
        },
        {
            title: "🤝 Gestión de Proveedores",
            desc: "Administrar proveedores y planillas de gastos personalizadas tipo Excel.",
            path: "/proveedores",
            color: "#8b5cf6",
        },
        {
            title: "📲 Validación de QR",
            desc: "Leer códigos QR y verificar la validez de vouchers desde un solo lugar.",
            path: "/panel/validar",
            color: "#f97316",
        },
    ];

    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-start",
                background: "#f1f5f9",
                padding: 20,
                paddingTop: 60,
                paddingBottom: 60,
                overflowY: "auto",
                boxSizing: "border-box"
            }}
        >
            <h1 style={{ marginBottom: 32, color: "#1e293b", fontWeight: 800, textAlign: "center" }}>Panel de Administración</h1>

            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center", width: "100%", maxWidth: 1100 }}>
                {cards.map((c) => (
                    <div
                        key={c.path}
                        onClick={() => navigate(c.path)}
                        style={{
                            background: "white",
                            padding: 32,
                            borderRadius: 16,
                            width: "100%",
                            maxWidth: 320,
                            textAlign: "center",
                            cursor: "pointer",
                            boxShadow: "0 10px 25px rgba(0,0,0,0.05)",
                            transition: "transform 0.2s, box-shadow 0.2s",
                            border: `2px solid transparent`,
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-5px)";
                            e.currentTarget.style.boxShadow = "0 15px 35px rgba(0,0,0,0.1)";
                            e.currentTarget.style.borderColor = c.color;
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "0 10px 25px rgba(0,0,0,0.05)";
                            e.currentTarget.style.borderColor = "transparent";
                        }}
                    >
                        <div style={{ fontSize: "3rem", marginBottom: 20 }}>{c.title.split(" ")[0]}</div>
                        <h3 style={{ margin: "0 0 10px 0", color: "#334155" }}>{c.title.split(" ").slice(1).join(" ")}</h3>
                        <p style={{ color: "#64748b", fontSize: "0.9rem", lineHeight: "1.5" }}>{c.desc}</p>
                    </div>
                ))}
            </div>

            <div
                style={{
                    marginTop: 50,
                    width: "100%",
                    maxWidth: 700,
                    background: "white",
                    padding: 28,
                    borderRadius: 18,
                    boxShadow: "0 15px 35px rgba(15,23,42,0.08)",
                    border: "1px solid #e2e8f0"
                }}
            >
                <h2 style={{ marginTop: 0, color: "#0f172a" }}>Copia de seguridad manual</h2>
                <p style={{ color: "#475569", lineHeight: 1.6 }}>
                    Genera y descarga un volcado completo de la base de datos alojada en Render. Úsalo como respaldo diario y
                    guárdalo en un espacio seguro fuera de la nube.
                </p>
                <button
                    onClick={handleBackupDownload}
                    disabled={isDownloadingBackup}
                    style={{
                        marginTop: 12,
                        padding: "12px 22px",
                        borderRadius: 10,
                        border: "none",
                        background: isDownloadingBackup ? "#94a3b8" : "#0ea5e9",
                        color: "white",
                        fontWeight: 600,
                        cursor: isDownloadingBackup ? "not-allowed" : "pointer",
                        transition: "background 0.2s"
                    }}
                >
                    {isDownloadingBackup ? "Generando backup..." : "Descargar base de datos"}
                </button>
                {backupFeedback && (
                    <p
                        style={{
                            marginTop: 12,
                            color: backupFeedback.type === "error" ? "#dc2626" : "#059669",
                            fontWeight: 500
                        }}
                    >
                        {backupFeedback.text}
                    </p>
                )}
            </div>

            <button
                onClick={() => {
                    localStorage.removeItem("admin_auth");
                    localStorage.removeItem("validator_auth");
                    localStorage.removeItem("calendar_auth");
                    localStorage.removeItem("auth_role");
                    navigate("/login");
                }}
                style={{
                    marginTop: 60,
                    background: "transparent",
                    border: "none",
                    color: "#ef4444",
                    fontWeight: 600,
                    cursor: "pointer",
                    textDecoration: "underline",
                }}
            >
                Cerrar sesión
            </button>
        </div>
    );
}
