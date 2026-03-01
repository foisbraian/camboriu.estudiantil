import React, { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import api from "../api";

export default function ValidarQR() {
    const [resultado, setResultado] = useState(null);
    const [mensaje, setMensaje] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const isValidating = useRef(false);
    const html5QrCode = useRef(null);

    useEffect(() => {
        const qrConfig = { fps: 10, qrbox: { width: 250, height: 250 } };
        html5QrCode.current = new Html5Qrcode("reader");

        const startScanner = async () => {
            try {
                await html5QrCode.current.start(
                    { facingMode: "environment" },
                    qrConfig,
                    onScanSuccess
                );
            } catch (err) {
                console.error("No se pudo iniciar la cámara:", err);
                setError("Error al iniciar la cámara. Asegúrate de dar permisos.");
            }
        };

        startScanner();

        async function onScanSuccess(decodedText) {
            if (isValidating.current) return;
            isValidating.current = true;

            // Vibración táctil si el navegador lo soporta
            if (navigator.vibrate) navigator.vibrate(100);

            try {
                // Detener el scanner antes de validar para evitar ruido visual
                if (html5QrCode.current) {
                    await html5QrCode.current.stop();
                }
                validarToken(decodedText);
            } catch (e) {
                console.error("Scan success handling error:", e);
                validarToken(decodedText);
            }
        }

        return () => {
            if (html5QrCode.current && html5QrCode.current.isScanning) {
                html5QrCode.current.stop().catch(e => console.error(e));
            }
        };
    }, []);

    const validarToken = async (token) => {
        setLoading(true);
        setError("");
        setResultado(null);
        try {
            const res = await api.post("/vouchers/validate", { token });
            setResultado(res.data.detalle);
            setMensaje(res.data.message);
        } catch (err) {
            setError(err.response?.data?.message || err.response?.data?.detail || "Este código no es válido o ya fue usado.");
        } finally {
            setLoading(false);
            isValidating.current = false;
        }
    };

    const resetScanner = () => {
        window.location.reload();
    };

    return (
        <div style={{
            minHeight: "100vh",
            background: "#0f172a",
            color: "white",
            fontFamily: "'Inter', sans-serif",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center"
        }}>
            <h2 style={{
                textAlign: "center",
                margin: "20px 0 40px 0",
                fontSize: "1.5rem",
                fontWeight: 800,
                letterSpacing: "-0.02em"
            }}>
                📲 VALIDAR <span style={{ color: "#ec4899" }}>VOUCHER</span>
            </h2>

            <div style={{
                position: "relative",
                width: "100%",
                maxWidth: "400px",
                borderRadius: "24px",
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
                background: "rgba(255,255,255,0.03)",
                backdropFilter: "blur(10px)"
            }}>
                {/* Scanner View */}
                {!resultado && !error && (
                    <div id="reader" style={{ width: "100%", minHeight: "300px" }}></div>
                )}

                {/* Loading State Overlay */}
                {loading && (
                    <div style={{
                        position: "absolute",
                        inset: 0,
                        background: "rgba(15, 23, 42, 0.8)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 20
                    }}>
                        <div className="spinner"></div>
                        <p style={{ marginTop: 15, fontWeight: 600 }}>Validando...</p>
                    </div>
                )}

                {/* Success Card */}
                {resultado && (
                    <div style={{ padding: "30px", textAlign: "center", animation: "fadeIn 0.5s ease" }}>
                        <div style={{ fontSize: "4rem", marginBottom: 20 }}>✅</div>
                        <h3 style={{ color: "#4ade80", margin: "0 0 10px 0", fontSize: "1.2rem" }}>{mensaje}</h3>

                        <div style={{
                            textAlign: "left",
                            background: "rgba(255,255,255,0.05)",
                            padding: "20px",
                            borderRadius: "16px",
                            marginTop: 20,
                            border: "1px solid rgba(255,255,255,0.1)"
                        }}>
                            <DetailRow label="Grupo" value={resultado.grupo} />
                            <DetailRow label="Servicio" value={resultado.servicio} />
                            <DetailRow label="Fecha" value={resultado.fecha} />
                            <DetailRow label="Pasajeros" value={resultado.pax} />
                        </div>

                        <button onClick={resetScanner} style={PRIMARY_BUTTON}>
                            Escanear Siguiente
                        </button>
                    </div>
                )}

                {/* Error Card */}
                {error && (
                    <div style={{ padding: "30px", textAlign: "center", animation: "shake 0.5s ease" }}>
                        <div style={{ fontSize: "4rem", marginBottom: 20 }}>❌</div>
                        <h3 style={{ color: "#f87171", margin: "0 0 10px 0", fontSize: "1.2rem" }}>Error de Validación</h3>
                        <p style={{ color: "#94a3b8", fontSize: "0.95rem" }}>{error}</p>

                        <button onClick={resetScanner} style={{ ...PRIMARY_BUTTON, background: "#ef4444" }}>
                            Reintentar
                        </button>
                    </div>
                )}
            </div>

            <style>{`
                .spinner {
                    width: 40px;
                    height: 40px;
                    border: 4px solid rgba(236, 72, 153, 0.1);
                    border-left-color: #ec4899;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }
                #reader__scan_region { background: transparent !important; }
                video { object-fit: cover !important; }
            `}</style>
        </div>
    );
}

function DetailRow({ label, value }) {
    return (
        <div style={{ marginBottom: "12px" }}>
            <span style={{ color: "#64748b", fontSize: "0.8rem", textTransform: "uppercase", fontWeight: 700, display: "block", marginBottom: 2 }}>{label}</span>
            <span style={{ fontSize: "1rem", fontWeight: 600 }}>{value}</span>
        </div>
    );
}

const PRIMARY_BUTTON = {
    marginTop: "30px",
    width: "100%",
    padding: "16px",
    background: "linear-gradient(90deg, #2563eb 0%, #ec4899 100%)",
    color: "white",
    border: "none",
    borderRadius: "14px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "1rem",
    boxShadow: "0 10px 15px -3px rgba(37, 99, 235, 0.3)"
};
