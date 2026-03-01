import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import api from "../api";

export default function ImprimirTodosVouchers() {
    const { grupoId } = useParams();
    const [asignaciones, setAsignaciones] = useState([]);
    const [loading, setLoading] = useState(true);

    const [error, setError] = useState(null);

    useEffect(() => {
        async function load() {
            try {
                console.log("Cargando asignaciones para grupo:", grupoId);
                const res = await api.get(`/finanzas/asignaciones/${grupoId}`);
                console.log("Asignaciones cargadas:", res.data);
                setAsignaciones(res.data);
            } catch (err) {
                console.error("Error cargando asignaciones:", err);
                setError(err.message || "Error al conectar con el servidor");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [grupoId]);

    useEffect(() => {
        if (!loading && asignaciones.length > 0) {
            const timer = setTimeout(() => {
                window.print();
            }, 2000); // 2 segundos para dar tiempo a que carguen todas las imágenes
            return () => clearTimeout(timer);
        }
    }, [loading, asignaciones]);

    if (loading) return <div style={{ padding: 20 }}>Cargando vouchers...</div>;
    if (error) return <div style={{ padding: 20, color: "red" }}>Error: {error}</div>;
    if (asignaciones.length === 0) return <div style={{ padding: 20 }}>No hay vouchers para imprimir para este grupo.</div>;

    return (
        <div className="main-container" style={{ background: "white", padding: 20 }}>
            <div className="no-print" style={{ marginBottom: 20, textAlign: "center" }}>
                <button
                    onClick={() => window.close()}
                    style={{ padding: "10px 20px", cursor: "pointer", borderRadius: 8, border: "1px solid #ccc" }}
                >
                    Cerrar / Volver
                </button>
                <p style={{ marginTop: 10, color: "#64748b" }}>Se están cargando {asignaciones.length} vouchers...</p>
            </div>

            <div style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: "20px",
                justifyItems: "center"
            }}>
                {asignaciones.filter(a => a.habilitado).map(a => (
                    <div key={a.id} className="voucher-container" style={{ breakInside: "avoid", marginBottom: 10 }}>
                        <img
                            src={`http://localhost:8000/vouchers/generate/${a.id}`}
                            alt="Voucher"
                            style={{ width: "100%", maxWidth: "800px", height: "auto", display: "block", border: "1px solid #eee" }}
                        />
                    </div>
                ))}
                {asignaciones.length > 0 && asignaciones.filter(a => a.habilitado).length === 0 && (
                    <p style={{ color: "#ef4444", fontWeight: 700 }}>⚠️ No hay vouchers habilitados para imprimir (Pendiente de Pago).</p>
                )}
            </div>

            <style>{`
                @media print {
                    @page { margin: 10mm; }
                    .no-print { display: none !important; }
                    body { margin: 0; padding: 0; background: white; }
                    .main-container { padding: 0 !important; }
                    img { max-width: 100%; height: auto; display: block; }
                    div { break-inside: avoid; }
                    .voucher-container { margin-bottom: 5mm; page-break-inside: avoid; }
                }
            `}</style>
        </div>
    );
}
