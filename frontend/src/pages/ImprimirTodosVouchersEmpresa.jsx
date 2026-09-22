import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import api, { BASE_URL } from "../api";

export default function ImprimirTodosVouchersEmpresa() {
    const { empresaId } = useParams();
    const [asignaciones, setAsignaciones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadedCount, setLoadedCount] = useState(0);
    const [hasPrinted, setHasPrinted] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function load() {
            try {
                const res = await api.get(`/finanzas/asignaciones-empresa/${empresaId}`);
                setAsignaciones(res.data);
            } catch (err) {
                console.error("Error cargando asignaciones:", err);
                setError(err.message || "Error al conectar con el servidor");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [empresaId]);

    const habilitadas = asignaciones.filter(a => a.habilitado);
    const habilitadasCount = habilitadas.length;

    // Agrupar por grupo para mostrar separadores visuales
    const porGrupo = habilitadas.reduce((acc, a) => {
        const key = a.grupo_nombre || `Grupo ${a.grupo_id}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(a);
        return acc;
    }, {});

    useEffect(() => {
        if (!loading) {
            setLoadedCount(0);
            setHasPrinted(false);
        }
    }, [loading, empresaId]);

    useEffect(() => {
        if (!loading && habilitadasCount > 0 && loadedCount >= habilitadasCount && !hasPrinted) {
            setHasPrinted(true);
            window.print();
        }
    }, [loading, habilitadasCount, loadedCount, hasPrinted]);

    // Fallback: imprimir igual si después de 10 segundos no cargaron todas
    useEffect(() => {
        if (!loading && habilitadasCount > 0 && !hasPrinted) {
            const timer = setTimeout(() => {
                if (!hasPrinted) {
                    setHasPrinted(true);
                    window.print();
                }
            }, 10000);
            return () => clearTimeout(timer);
        }
    }, [loading, habilitadasCount, hasPrinted]);

    if (loading) return <div style={{ padding: 20 }}>Cargando vouchers de la empresa...</div>;
    if (error) return <div style={{ padding: 20, color: "red" }}>Error: {error}</div>;
    if (asignaciones.length === 0) return <div style={{ padding: 20 }}>No hay vouchers para imprimir para esta empresa.</div>;

    return (
        <div className="main-container" style={{ background: "white", padding: 20 }}>
            <div className="no-print" style={{ marginBottom: 20, textAlign: "center" }}>
                <button
                    onClick={() => window.close()}
                    style={{ padding: "10px 20px", cursor: "pointer", borderRadius: 8, border: "1px solid #ccc" }}
                >
                    Cerrar / Volver
                </button>
                <p style={{ marginTop: 10, color: "#64748b" }}>
                    Se están cargando <strong>{habilitadasCount}</strong> vouchers
                    de <strong>{Object.keys(porGrupo).length}</strong> grupo(s)...
                </p>
            </div>

            {/* Vouchers agrupados por grupo */}
            {habilitadasCount > 0 ? (
                Object.entries(porGrupo).map(([grupoNombre, items]) => (
                    <div key={grupoNombre}>
                        {/* Separador de grupo — solo visible en pantalla */}
                        <div className="grupo-header no-print" style={{
                            margin: "16px 0 8px",
                            padding: "6px 14px",
                            background: "#f1f5f9",
                            borderLeft: "4px solid #334155",
                            borderRadius: 6,
                            fontWeight: 700,
                            color: "#334155",
                            fontSize: "0.9rem",
                        }}>
                            📂 {grupoNombre} — {items.length} voucher{items.length !== 1 ? "s" : ""}
                        </div>

                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "1fr",
                            gap: "20px",
                            justifyItems: "center",
                        }}>
                            {items.map(a => (
                                <div key={a.id} className="voucher-container" style={{ breakInside: "avoid", marginBottom: 10, width: "100%" }}>
                                    <img
                                        src={`${BASE_URL}/vouchers/generate/${a.id}`}
                                        alt="Voucher"
                                        style={{ width: "100%", maxWidth: "800px", height: "auto", display: "block", border: "1px solid #eee" }}
                                        onLoad={() => setLoadedCount(count => count + 1)}
                                        onError={() => setLoadedCount(count => count + 1)}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            ) : (
                <p style={{ color: "#ef4444", fontWeight: 700 }}>
                    ⚠️ No hay vouchers habilitados para imprimir (todos están Pendientes de Pago).
                </p>
            )}

            <style>{`
                @media print {
                    @page { margin: 10mm; }
                    body * { visibility: hidden !important; }
                    .main-container, .main-container * { visibility: visible !important; }
                    html, body, #root {
                        height: auto !important;
                        overflow: visible !important;
                    }
                    #root > div,
                    #root > div > div {
                        height: auto !important;
                        overflow: visible !important;
                        position: static !important;
                    }
                    .no-print { display: none !important; }
                    body { margin: 0; padding: 0; background: white; }
                    .main-container { padding: 0 !important; position: static !important; }
                    img { max-width: 100%; height: auto; display: block; }
                    div { break-inside: avoid; }
                    .voucher-container { margin-bottom: 5mm; page-break-inside: avoid; }
                    .grupo-header { display: none !important; }
                }
            `}</style>
        </div>
    );
}
