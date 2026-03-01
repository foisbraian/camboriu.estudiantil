import React, { useState, useEffect } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import api from "../api";

export default function ValidarQR() {
    const [resultado, setResultado] = useState(null);
    const [mensaje, setMensaje] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const scanner = new Html5QrcodeScanner("reader", {
            fps: 10,
            qrbox: { width: 250, height: 250 },
        });

        scanner.render(onScanSuccess, onScanError);

        function onScanSuccess(decodedText) {
            scanner.clear().then(() => {
                validarToken(decodedText);
            }).catch(e => {
                console.error("Scanner clear error:", e);
                validarToken(decodedText);
            });
        }

        function onScanError(err) {
            // Manejar errores silenciosamente durante el escaneo
        }

        return () => {
            scanner.clear().catch(e => console.error("Unmount clear error:", e));
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
            setError(err.response?.data?.message || "Error al validar el código");
        } finally {
            setLoading(false);
        }
    };

    const resetScanner = () => {
        window.location.reload();
    };

    return (
        <div style={{ maxWidth: 600, margin: "0 auto", padding: 20 }}>
            <h2 style={{ textAlign: "center", marginBottom: 30, color: "#1e293b" }}>📲 Validar Voucher QR</h2>

            {!resultado && !error && !loading && (
                <div id="reader" style={{ border: "none", borderRadius: 12, overflow: "hidden", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}></div>
            )}

            {loading && (
                <div style={{ textAlign: "center", padding: 50 }}>
                    <p>Validando token...</p>
                </div>
            )}

            {resultado && (
                <div style={{ background: "#f0fdf4", border: "2px solid #22c55e", padding: 25, borderRadius: 12, textAlign: "center" }}>
                    <div style={{ fontSize: "3rem", marginBottom: 15 }}>✅</div>
                    <h3 style={{ color: "#166534", margin: "0 0 10px 0" }}>{mensaje}</h3>

                    <div style={{ textAlign: "left", background: "white", padding: 15, borderRadius: 8, marginTop: 15 }}>
                        <p><strong>Grupo:</strong> {resultado.grupo}</p>
                        <p><strong>Servicio:</strong> {resultado.servicio}</p>
                        <p><strong>Fecha:</strong> {resultado.fecha}</p>
                        <p><strong>Pax:</strong> {resultado.pax}</p>
                    </div>

                    <button
                        onClick={resetScanner}
                        style={{ marginTop: 20, padding: "12px 25px", background: "#22c55e", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}
                    >
                        Escanear otro código
                    </button>
                </div>
            )}

            {error && (
                <div style={{ background: "#fef2f2", border: "2px solid #ef4444", padding: 25, borderRadius: 12, textAlign: "center" }}>
                    <div style={{ fontSize: "3rem", marginBottom: 15 }}>❌</div>
                    <h3 style={{ color: "#991b1b", margin: "0 0 10px 0" }}>Error</h3>
                    <p style={{ color: "#991b1b" }}>{error}</p>

                    <button
                        onClick={resetScanner}
                        style={{ marginTop: 20, padding: "12px 25px", background: "#ef4444", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}
                    >
                        Intentar de nuevo
                    </button>
                </div>
            )}
        </div>
    );
}
