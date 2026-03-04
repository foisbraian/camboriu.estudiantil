import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api";

const buildDefaultFilters = () => {
    const today = new Date();
    const iso = today.toISOString().split("T")[0];
    return { desde: iso, hasta: iso, eventoId: "", empresaId: "" };
};

const formatDate = (value) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
        return value;
    }
    return d.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });
};

export default function VouchersPlanilla() {
    const [filters, setFilters] = useState(buildDefaultFilters);
    const [appliedFilters, setAppliedFilters] = useState(buildDefaultFilters);
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [eventos, setEventos] = useState([]);
    const [empresas, setEmpresas] = useState([]);

    useEffect(() => {
        const cargarCatalogos = async () => {
            try {
                const [evRes, emRes] = await Promise.all([
                    api.get("/eventos/"),
                    api.get("/empresas/")
                ]);
                setEventos(evRes.data || []);
                setEmpresas(emRes.data || []);
            } catch (catErr) {
                console.error("No se pudieron cargar catálogos", catErr);
            }
        };
        cargarCatalogos();
    }, []);

    const generarPlanilla = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const params = {};
            if (appliedFilters.desde) params.desde = appliedFilters.desde;
            if (appliedFilters.hasta) params.hasta = appliedFilters.hasta;
            if (appliedFilters.eventoId) params.evento_id = appliedFilters.eventoId;
            if (appliedFilters.empresaId) params.empresa_id = appliedFilters.empresaId;
            const res = await api.get("/vouchers/reporte", { params });
            setRows(res.data || []);
        } catch (planillaErr) {
            console.error("No se pudo generar la planilla", planillaErr);
            setRows([]);
            setError(planillaErr.response?.data?.detail || "No se pudo generar la planilla de escaneos");
        } finally {
            setLoading(false);
        }
    }, [appliedFilters]);

    useEffect(() => {
        generarPlanilla();
    }, [generarPlanilla]);

    const totals = useMemo(() => {
        return rows.reduce((acc, row) => {
            acc.registros += 1;
            acc.estudiantes += row.estudiantes || 0;
            acc.padres += row.padres || 0;
            acc.guias += row.guias || 0;
            acc.pax += row.pax || 0;
            return acc;
        }, { registros: 0, estudiantes: 0, padres: 0, guias: 0, pax: 0 });
    }, [rows]);

    const updateFilter = (field, value) => {
        setFilters((prev) => ({ ...prev, [field]: value }));
    };

    const applyFilters = () => {
        setAppliedFilters({ ...filters });
    };

    const resetFilters = () => {
        const reset = buildDefaultFilters();
        setFilters(reset);
        setAppliedFilters(reset);
    };

    const exportToCSV = () => {
        if (!rows.length) {
            alert("No hay registros para exportar");
            return;
        }
        const headers = [
            "Fecha escaneo",
            "Hora",
            "Fecha evento",
            "Evento",
            "Empresa",
            "Grupo",
            "Estudiantes",
            "Padres",
            "Guías",
            "Total Pax"
        ];
        const formatValue = (value) => {
            const str = (value ?? "").toString();
            if (/[",\n]/.test(str)) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };
        const dataRows = rows.map((row) => [
            row.scan_fecha || "",
            row.scan_hora || "",
            row.fecha_evento || "",
            row.evento || "",
            row.empresa || "",
            row.grupo || "",
            row.estudiantes ?? 0,
            row.padres ?? 0,
            row.guias ?? 0,
            row.pax ?? 0
        ].map(formatValue).join(","));
        const csv = [headers.join(","), ...dataRows].join("\n");
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const nombre = `planilla-vouchers-${appliedFilters.desde || "inicio"}-${appliedFilters.hasta || "fin"}.csv`;
        link.href = url;
        link.download = nombre;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const filtrosActivos = [
        appliedFilters.desde && `Desde ${appliedFilters.desde}`,
        appliedFilters.hasta && `Hasta ${appliedFilters.hasta}`,
        appliedFilters.eventoId && `Evento ID ${appliedFilters.eventoId}`,
        appliedFilters.empresaId && `Empresa ID ${appliedFilters.empresaId}`,
    ].filter(Boolean);

    return (
        <div style={{ padding: "30px 40px", background: "#0f172a", minHeight: "100%" }}>
            <div id="print-title" style={{ display: "none", textAlign: "center", marginBottom: 20 }}>
                <h2 style={{ margin: 0 }}>Planilla de Vouchers</h2>
                <p style={{ margin: 0, fontSize: "0.9rem" }}>{filtrosActivos.join(" · ")}</p>
            </div>

            <div id="print-controls" style={filterPanelStyle}>
                <div>
                    <h1 style={{ margin: "0 0 12px 0" }}>Planilla de vouchers escaneados</h1>
                    <p style={{ margin: 0, color: "#475569" }}>Generá un reporte listo para imprimir o exportar según la fecha y evento.</p>
                </div>
                <div style={filtersGridStyle}>
                    <label style={filterFieldStyle}>
                        <span>Desde</span>
                        <input type="date" value={filters.desde} onChange={(e) => updateFilter("desde", e.target.value)} style={fieldInputStyle} />
                    </label>
                    <label style={filterFieldStyle}>
                        <span>Hasta</span>
                        <input type="date" value={filters.hasta} onChange={(e) => updateFilter("hasta", e.target.value)} style={fieldInputStyle} />
                    </label>
                    <label style={filterFieldStyle}>
                        <span>Evento</span>
                        <select value={filters.eventoId} onChange={(e) => updateFilter("eventoId", e.target.value)} style={fieldInputStyle}>
                            <option value="">Todos</option>
                            {eventos.map((evento) => (
                                <option key={evento.id} value={evento.id}>{evento.nombre} ({evento.tipo})</option>
                            ))}
                        </select>
                    </label>
                    <label style={filterFieldStyle}>
                        <span>Empresa</span>
                        <select value={filters.empresaId} onChange={(e) => updateFilter("empresaId", e.target.value)} style={fieldInputStyle}>
                            <option value="">Todas</option>
                            {empresas.map((empresa) => (
                                <option key={empresa.id} value={empresa.id}>{empresa.nombre}</option>
                            ))}
                        </select>
                    </label>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button onClick={applyFilters} style={primaryBtn}>Generar planilla</button>
                    <button onClick={resetFilters} style={ghostBtn}>Limpiar filtros</button>
                    <button onClick={exportToCSV} style={ghostBtn}>⬇️ Exportar Excel</button>
                    <button onClick={() => window.print()} style={ghostBtn}>🖨️ Imprimir</button>
                </div>
            </div>

            {error && (
                <div style={{ marginTop: 16, padding: 16, borderRadius: 12, background: "rgba(248,113,113,0.15)", color: "#fecaca" }}>
                    {error}
                </div>
            )}

            <section style={summaryGridStyle}>
                <SummaryCard label="Registros" value={totals.registros} accent="#f97316" />
                <SummaryCard label="Estudiantes" value={totals.estudiantes} accent="#38bdf8" />
                <SummaryCard label="Padres" value={totals.padres} accent="#a855f7" />
                <SummaryCard label="Guías" value={totals.guias} accent="#22c55e" />
                <SummaryCard label="Total PAX" value={totals.pax} accent="#eab308" />
            </section>

            <div style={tableCardStyle}>
                {loading ? (
                    <p style={{ color: "#94a3b8" }}>Cargando planilla...</p>
                ) : rows.length === 0 ? (
                    <p style={{ color: "#94a3b8" }}>No hay escaneos para los filtros seleccionados.</p>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table style={tableStyle}>
                            <thead>
                                <tr>
                                    <th style={thStyle}>Fecha escaneo</th>
                                    <th style={thStyle}>Hora</th>
                                    <th style={thStyle}>Fecha evento</th>
                                    <th style={thStyle}>Evento</th>
                                    <th style={thStyle}>Empresa</th>
                                    <th style={thStyle}>Grupo</th>
                                    <th style={thStyle}>Estudiantes</th>
                                    <th style={thStyle}>Padres</th>
                                    <th style={thStyle}>Guías</th>
                                    <th style={thStyle}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.voucher_id}>
                                        <td style={tdStyle}>{formatDate(row.scan_fecha)}</td>
                                        <td style={tdStyle}>{row.scan_hora || "—"}</td>
                                        <td style={tdStyle}>{formatDate(row.fecha_evento)}</td>
                                        <td style={{ ...tdStyle, minWidth: 180 }}>
                                            <div style={{ fontWeight: 600 }}>{row.evento || "—"}</div>
                                            <small style={{ color: "#94a3b8" }}>{row.evento_tipo || ""}</small>
                                        </td>
                                        <td style={tdStyle}>{row.empresa || "—"}</td>
                                        <td style={tdStyle}>{row.grupo || "—"}</td>
                                        <td style={{ ...tdStyle, textAlign: "right" }}>{row.estudiantes ?? 0}</td>
                                        <td style={{ ...tdStyle, textAlign: "right" }}>{row.padres ?? 0}</td>
                                        <td style={{ ...tdStyle, textAlign: "right" }}>{row.guias ?? 0}</td>
                                        <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>{row.pax ?? 0}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

function SummaryCard({ label, value, accent }) {
    return (
        <div style={{
            background: "rgba(15,23,42,0.65)",
            borderRadius: 18,
            padding: 18,
            border: "1px solid rgba(148,163,184,0.2)",
            minWidth: 160,
            boxShadow: "0 10px 30px rgba(2,6,23,0.4)",
        }}>
            <span style={{ color: "#94a3b8", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: accent, marginTop: 6 }}>{value}</div>
        </div>
    );
}

const filterPanelStyle = {
    background: "white",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 20px 45px rgba(15,23,42,0.25)",
    display: "flex",
    flexDirection: "column",
    gap: 16
};

const filtersGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 16
};

const filterFieldStyle = {
    display: "flex",
    flexDirection: "column",
    fontSize: "0.85rem",
    color: "#475569",
    gap: 6
};

const fieldInputStyle = {
    borderRadius: 12,
    border: "1px solid #cbd5f5",
    padding: "10px 12px",
    fontSize: "0.95rem",
    background: "#f8fafc"
};

const primaryBtn = {
    border: "none",
    borderRadius: 999,
    padding: "10px 20px",
    background: "linear-gradient(120deg, #2563eb, #a855f7)",
    color: "white",
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(79,70,229,0.25)"
};

const ghostBtn = {
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.4)",
    padding: "10px 18px",
    background: "transparent",
    color: "#0f172a",
    fontWeight: 600,
    cursor: "pointer"
};

const summaryGridStyle = {
    display: "flex",
    flexWrap: "wrap",
    gap: 16,
    marginTop: 24
};

const tableCardStyle = {
    background: "rgba(15,23,42,0.7)",
    borderRadius: 24,
    padding: 20,
    marginTop: 24,
    border: "1px solid rgba(148,163,184,0.2)",
    boxShadow: "0 20px 40px rgba(2,6,23,0.45)",
    color: "white"
};

const tableStyle = {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: 0,
    fontSize: "0.95rem",
    color: "#e2e8f0"
};

const thStyle = {
    textAlign: "left",
    padding: "12px",
    fontSize: "0.7rem",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    borderBottom: "1px solid rgba(148,163,184,0.35)",
    color: "#94a3b8"
};

const tdStyle = {
    padding: "14px 12px",
    borderBottom: "1px solid rgba(148,163,184,0.2)",
    verticalAlign: "top"
};
