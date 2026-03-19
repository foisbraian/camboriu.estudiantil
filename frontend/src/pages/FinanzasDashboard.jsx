import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api, { BASE_URL } from "../api";

export default function FinanzasDashboard() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        cargar();
    }, []);

    async function cargar() {
        try {
            const res = await api.get("/finanzas/dashboard");
            setData(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    const formatMoney = (val, currencyCode = "ARS") => new Intl.NumberFormat("es-AR", { style: "currency", currency: currencyCode, maximumFractionDigits: 0 }).format(val);

    const totalsByCurrency = data.reduce((acc, curr) => {
        const c = curr.moneda || "ARS";
        if (!acc[c]) acc[c] = { venta: 0, pagado: 0 };
        acc[c].venta += curr.total_venta;
        acc[c].pagado += curr.total_pagado;
        return acc;
    }, {});

    if (loading) return <div style={{ padding: 40 }}>Cargando dashboard...</div>;

    return (
        <div style={{ padding: "40px 20px", maxWidth: "1200px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 30, gap: 12, flexWrap: "wrap" }}>
                <h1 style={{ color: "#1e293b", margin: 0 }}>💰 Dashboard Financiero</h1>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                        onClick={() => window.open(`${BASE_URL}/excel/finanzas/todas`, "_blank")}
                        style={{ padding: "10px 16px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}
                    >
                        📄 Excel Todas
                    </button>
                    <button
                        onClick={async () => {
                            try {
                                await api.post("/finanzas/migracion-parque-precios");
                                alert("✅ Migración ejecutada correctamente");
                                cargar();
                            } catch (e) {
                                alert("❌ Error en migración: " + (e.response?.data?.detail || e.message));
                            }
                        }}
                        style={{ padding: "10px 16px", background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8, cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, color: "#92400e" }}
                    >
                        🔧 Migrar DB
                    </button>
                </div>
            </div>

            {/* KPIs */}
            {Object.keys(totalsByCurrency).length === 0 && (
                <div style={{ display: "flex", gap: 20, marginBottom: 40, flexWrap: "wrap" }}>
                    <KPIBox title="Total General" value={formatMoney(0, "ARS")} color="#3b82f6" />
                    <KPIBox title="Total Cobrado" value={formatMoney(0, "ARS")} color="#10b981" />
                    <KPIBox title="Saldo Pendiente" value={formatMoney(0, "ARS")} color="#ef4444" />
                </div>
            )}
            {Object.entries(totalsByCurrency).map(([moneda, totals]) => (
                <div key={moneda} style={{ marginBottom: 40 }}>
                    <h3 style={{ marginTop: 0, marginBottom: 15, color: "#475569" }}>Totales en {moneda}</h3>
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                        <KPIBox title="Total General" value={formatMoney(totals.venta, moneda)} color="#3b82f6" />
                        <KPIBox title="Total Cobrado" value={formatMoney(totals.pagado, moneda)} color="#10b981" />
                        <KPIBox title="Saldo Pendiente" value={formatMoney(totals.venta - totals.pagado, moneda)} color="#ef4444" />
                    </div>
                </div>
            ))}

            <div style={{ background: "white", borderRadius: 12, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                    <thead style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                        <tr>
                            <th style={{ padding: "16px 20px", color: "#64748b", fontSize: "0.85rem", textTransform: "uppercase" }}>Empresa</th>
                            <th style={{ padding: "16px 20px", color: "#64748b", fontSize: "0.85rem", textTransform: "uppercase" }}>Total Contrato</th>
                            <th style={{ padding: "16px 20px", color: "#64748b", fontSize: "0.85rem", textTransform: "uppercase" }}>Cobrado</th>
                            <th style={{ padding: "16px 20px", color: "#64748b", fontSize: "0.85rem", textTransform: "uppercase" }}>Progreso de Pago</th>
                            <th style={{ padding: "16px 20px", color: "#64748b", fontSize: "0.85rem", textTransform: "uppercase" }}>Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((emp) => {
                            const perc = emp.porcentaje_pagado;
                            let statusColor = "#ef4444"; // Rojo (Riesgo)
                            let statusText = "Riesgo Alto";

                            if (perc >= 90) { statusColor = "#10b981"; statusText = "Al día"; }
                            else if (perc >= 60) { statusColor = "#f59e0b"; statusText = "Medio"; }

                            return (
                                <tr
                                    key={emp.id}
                                    onClick={() => navigate(`/finanzas/${emp.id}`)}
                                    style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer", transition: "background 0.1s" }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"}
                                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                                >
                                    <td style={{ padding: "16px 20px", fontWeight: 700, color: "#1e293b" }}>{emp.nombre}</td>
                                    <td style={{ padding: "16px 20px", color: "#334155" }}>{formatMoney(emp.total_venta, emp.moneda)}</td>
                                    <td style={{ padding: "16px 20px", color: "#059669", fontWeight: 600 }}>{formatMoney(emp.total_pagado, emp.moneda)}</td>
                                    <td style={{ padding: "16px 20px", width: "250px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <div style={{ flex: 1, height: 8, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                                                <div style={{ width: `${perc}%`, height: "100%", background: statusColor, transition: "width 0.5s" }} />
                                            </div>
                                            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#64748b", width: 40 }}>{Math.round(perc)}%</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: "16px 20px" }}>
                                        <span style={{
                                            padding: "4px 10px",
                                            borderRadius: 20,
                                            fontSize: "0.75rem",
                                            fontWeight: 700,
                                            background: `${statusColor}20`,
                                            color: statusColor,
                                            border: `1px solid ${statusColor}40`
                                        }}>
                                            {statusText}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function KPIBox({ title, value, color }) {
    return (
        <div style={{
            flex: 1,
            minWidth: 200,
            background: "white",
            padding: 24,
            borderRadius: 12,
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
            borderLeft: `5px solid ${color}`
        }}>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem", fontWeight: 600 }}>{title}</p>
            <h2 style={{ margin: "8px 0 0 0", color: "#1e293b", fontSize: "1.8rem" }}>{value}</h2>
        </div>
    );
}
