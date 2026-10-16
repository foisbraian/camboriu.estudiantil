import { useState, useEffect, useMemo } from "react";
import api from "../api";
import * as XLSX from "xlsx";

export default function GastosDashboard() {
    const [gastos, setGastos] = useState([]);
    const [resumen, setResumen] = useState({ total_reales: 0, total_dolares: 0, por_concepto: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filtros
    const [busqueda, setBusqueda] = useState("");
    const [conceptoFiltro, setConceptoFiltro] = useState("TODOS");
    const [soloSinFecha, setSoloSinFecha] = useState(false);
    const [fechaDesde, setFechaDesde] = useState("");
    const [fechaHasta, setFechaHasta] = useState("");

    // Modal Crear / Editar
    const [modalAbierto, setModalAbierto] = useState(false);
    const [gastoEditando, setGastoEditando] = useState(null);
    const [formGasto, setFormGasto] = useState({
        fecha: "",
        concepto: "",
        categoria: "",
        total_reales: "",
        total_dolares: "",
        origen_usd: "PLANILLA",
        observaciones: "",
    });
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        cargarDatos();
    }, []);

    async function cargarDatos() {
        setLoading(true);
        setError(null);
        try {
            const [resGastos, resResumen] = await Promise.all([
                api.get("/gastos"),
                api.get("/gastos/resumen").catch(() => ({ data: null })),
            ]);
            setGastos(resGastos.data || []);
            if (resResumen.data) {
                setResumen(resResumen.data);
            }
        } catch (err) {
            console.error(err);
            setError("No se pudieron cargar los gastos. Verifica que el backend esté online.");
        } finally {
            setLoading(false);
        }
    }

    const formatUSD = (val) =>
        new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(val || 0);

    const formatBRL = (val) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 }).format(val || 0);

    // Conceptos únicos
    const conceptosUnicos = useMemo(() => {
        const set = new Set();
        gastos.forEach((g) => {
            if (g.concepto) set.add(g.concepto.trim().toUpperCase());
        });
        return Array.from(set).sort();
    }, [gastos]);

    // Filtrado
    const gastosFiltrados = useMemo(() => {
        return gastos.filter((g) => {
            const q = busqueda.trim().toLowerCase();
            const matchBusqueda =
                !q ||
                (g.concepto && g.concepto.toLowerCase().includes(q)) ||
                (g.categoria && g.categoria.toLowerCase().includes(q)) ||
                (g.observaciones && g.observaciones.toLowerCase().includes(q)) ||
                (g.origen_usd && g.origen_usd.toLowerCase().includes(q));

            const matchConcepto =
                conceptoFiltro === "TODOS" ||
                (g.concepto && g.concepto.trim().toUpperCase() === conceptoFiltro);

            const matchSinFecha = !soloSinFecha || !g.fecha;

            let matchFechaRango = true;
            if (g.fecha) {
                if (fechaDesde && g.fecha < fechaDesde) matchFechaRango = false;
                if (fechaHasta && g.fecha > fechaHasta) matchFechaRango = false;
            } else if (fechaDesde || fechaHasta) {
                if (!soloSinFecha) matchFechaRango = false;
            }

            return matchBusqueda && matchConcepto && matchSinFecha && matchFechaRango;
        });
    }, [gastos, busqueda, conceptoFiltro, soloSinFecha, fechaDesde, fechaHasta]);

    // Subtotales filtrados
    const subtotalesFiltrados = useMemo(() => {
        return gastosFiltrados.reduce(
            (acc, curr) => {
                acc.reales += curr.total_reales || 0;
                acc.dolares += curr.total_dolares || 0;
                return acc;
            },
            { reales: 0, dolares: 0 }
        );
    }, [gastosFiltrados]);

    // Exportar a Excel
    function exportarExcel() {
        const datosAExportar = gastosFiltrados.map((g) => ({
            ID: g.id,
            Fecha: g.fecha || "SIN FECHA",
            Concepto: g.concepto || "",
            Categoría: g.categoria || "",
            "Total Reales (BRL)": g.total_reales || 0,
            "Total Dólares (USD)": g.total_dolares || 0,
            "Origen USD": g.origen_usd || "",
            Observaciones: g.observaciones || "",
        }));

        const ws = XLSX.utils.json_to_sheet(datosAExportar);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Gastos Empresa");
        XLSX.writeFile(wb, `gastos_empresa_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    // Guardar (Crear o Editar)
    async function handleGuardarGasto(e) {
        e.preventDefault();
        if (!formGasto.concepto.trim()) {
            alert("El concepto es obligatorio");
            return;
        }

        setGuardando(true);
        const payload = {
            fecha: formGasto.fecha || null,
            concepto: formGasto.concepto.trim().toUpperCase(),
            categoria: formGasto.categoria ? formGasto.categoria.trim().toUpperCase() : null,
            total_reales: formGasto.total_reales !== "" ? parseFloat(formGasto.total_reales) : null,
            total_dolares: formGasto.total_dolares !== "" ? parseFloat(formGasto.total_dolares) : null,
            origen_usd: formGasto.origen_usd || null,
            observaciones: formGasto.observaciones ? formGasto.observaciones.trim() : null,
        };

        try {
            if (gastoEditando) {
                await api.patch(`/gastos/${gastoEditando.id}`, payload);
            } else {
                await api.post("/gastos", payload);
            }
            cerrarModal();
            await cargarDatos();
        } catch (err) {
            console.error(err);
            alert("Error al guardar el gasto: " + (err.response?.data?.detail || err.message));
        } finally {
            setGuardando(false);
        }
    }

    // Eliminar gasto
    async function handleEliminarGasto(id) {
        if (!window.confirm("¿Seguro que deseas eliminar este gasto?")) return;
        try {
            await api.delete(`/gastos/${id}`);
            setGastos((prev) => prev.filter((g) => g.id !== id));
        } catch (err) {
            console.error(err);
            alert("Error al eliminar: " + (err.response?.data?.detail || err.message));
        }
    }

    function abrirModalNuevo() {
        setGastoEditando(null);
        setFormGasto({
            fecha: new Date().toISOString().slice(0, 10),
            concepto: "",
            categoria: "",
            total_reales: "",
            total_dolares: "",
            origen_usd: "PLANILLA",
            observaciones: "",
        });
        setModalAbierto(true);
    }

    function abrirModalEditar(g) {
        setGastoEditando(g);
        setFormGasto({
            fecha: g.fecha || "",
            concepto: g.concepto || "",
            categoria: g.categoria || "",
            total_reales: g.total_reales ?? "",
            total_dolares: g.total_dolares ?? "",
            origen_usd: g.origen_usd || "PLANILLA",
            observaciones: g.observaciones || "",
        });
        setModalAbierto(true);
    }

    function cerrarModal() {
        setModalAbierto(false);
        setGastoEditando(null);
    }

    // Colores para tags de concepto
    const getConceptoBadgeStyle = (concepto) => {
        const c = (concepto || "").toUpperCase();
        if (c.includes("OFICINA")) return { bg: "#e0f2fe", color: "#0369a1", border: "#bae6fd" };
        if (c.includes("GREENVALLEY")) return { bg: "#dcfce7", color: "#15803d", border: "#bbf7d0" };
        if (c.includes("MUSIC PARK")) return { bg: "#fef3c7", color: "#b45309", border: "#fde68a" };
        if (c.includes("SPEEDWAY")) return { bg: "#ffedd5", color: "#c2410c", border: "#fed7aa" };
        if (c.includes("SHED")) return { bg: "#f3e8ff", color: "#7e22ce", border: "#e9d5ff" };
        if (c.includes("OPERATIVO")) return { bg: "#f1f5f9", color: "#334155", border: "#cbd5e1" };
        return { bg: "#f3f4f6", color: "#374151", border: "#e5e7eb" };
    };

    return (
        <div style={{ padding: "30px 24px", maxWidth: "1400px", margin: "0 auto", fontFamily: "system-ui, -apple-system, sans-serif" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
                <div>
                    <h1 style={{ margin: "0 0 6px 0", color: "#0f172a", fontSize: "1.85rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 10 }}>
                        <span>💸</span> Control de Gastos de la Empresa
                    </h1>
                    <p style={{ margin: 0, color: "#64748b", fontSize: "0.95rem" }}>
                        Registro de contratos, oficina, traslados y gastos operativos en tiempo real
                    </p>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                        onClick={exportarExcel}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "10px 18px",
                            background: "#ffffff",
                            color: "#166534",
                            border: "1px solid #bbf7d0",
                            borderRadius: 10,
                            fontWeight: 600,
                            fontSize: "0.9rem",
                            cursor: "pointer",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                        }}
                    >
                        📊 Descargar Excel
                    </button>
                    <button
                        onClick={abrirModalNuevo}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "10px 20px",
                            background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: 10,
                            fontWeight: 600,
                            fontSize: "0.9rem",
                            cursor: "pointer",
                            boxShadow: "0 4px 12px rgba(37,99,235,0.3)",
                        }}
                    >
                        ➕ Nuevo Gasto
                    </button>
                </div>
            </div>

            {error && (
                <div style={{ padding: 16, background: "#fee2e2", border: "1px solid #fca5a5", color: "#991b1b", borderRadius: 12, marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>{error}</span>
                    <button onClick={cargarDatos} style={{ background: "#991b1b", color: "white", border: "none", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: "0.85rem" }}>
                        Reintentar
                    </button>
                </div>
            )}

            {/* KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18, marginBottom: 28 }}>
                {/* Total USD */}
                <div style={{ background: "white", padding: 22, borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(15,23,42,0.04)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ color: "#64748b", fontSize: "0.85rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Dólares</span>
                        <span style={{ background: "#dbeafe", color: "#1d4ed8", padding: "4px 8px", borderRadius: 8, fontSize: "0.75rem", fontWeight: 700 }}>USD</span>
                    </div>
                    <div style={{ fontSize: "1.9rem", fontWeight: 800, color: "#0f172a" }}>
                        {formatUSD(resumen.total_dolares || subtotalesFiltrados.dolares)}
                    </div>
                    <div style={{ color: "#10b981", fontSize: "0.8rem", marginTop: 4, fontWeight: 500 }}>
                        {gastos.length} gastos totales registrados
                    </div>
                </div>

                {/* Total Reales */}
                <div style={{ background: "white", padding: 22, borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(15,23,42,0.04)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ color: "#64748b", fontSize: "0.85rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Reales</span>
                        <span style={{ background: "#dcfce7", color: "#15803d", padding: "4px 8px", borderRadius: 8, fontSize: "0.75rem", fontWeight: 700 }}>BRL</span>
                    </div>
                    <div style={{ fontSize: "1.9rem", fontWeight: 800, color: "#0f172a" }}>
                        {formatBRL(resumen.total_reales || subtotalesFiltrados.reales)}
                    </div>
                    <div style={{ color: "#64748b", fontSize: "0.8rem", marginTop: 4 }}>
                        Equivalente en moneda local
                    </div>
                </div>

                {/* Filtrados USD */}
                <div style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", color: "white", padding: 22, borderRadius: 16, boxShadow: "0 8px 20px rgba(15,23,42,0.15)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ color: "#94a3b8", fontSize: "0.85rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Subtotal Vista Filtrada</span>
                        <span style={{ background: "#334155", color: "#cbd5e1", padding: "4px 8px", borderRadius: 8, fontSize: "0.75rem", fontWeight: 700 }}>
                            {gastosFiltrados.length} filas
                        </span>
                    </div>
                    <div style={{ fontSize: "1.9rem", fontWeight: 800, color: "#38bdf8" }}>
                        {formatUSD(subtotalesFiltrados.dolares)}
                    </div>
                    <div style={{ color: "#cbd5e1", fontSize: "0.85rem", marginTop: 4 }}>
                        + {formatBRL(subtotalesFiltrados.reales)}
                    </div>
                </div>
            </div>

            {/* Desglose rápido por Concepto */}
            {resumen.por_concepto && resumen.por_concepto.length > 0 && (
                <div style={{ background: "white", padding: 20, borderRadius: 16, border: "1px solid #e2e8f0", marginBottom: 28, boxShadow: "0 4px 12px rgba(15,23,42,0.03)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <h3 style={{ margin: 0, fontSize: "1rem", color: "#1e293b", fontWeight: 700 }}>
                            Distribución por Concepto Principal (Haz clic para filtrar)
                        </h3>
                        {conceptoFiltro !== "TODOS" && (
                            <button
                                onClick={() => setConceptoFiltro("TODOS")}
                                style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}
                            >
                                ✕ Ver todos
                            </button>
                        )}
                    </div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                        {resumen.por_concepto.map((item) => {
                            const isSelected = conceptoFiltro === item.concepto;
                            const badge = getConceptoBadgeStyle(item.concepto);
                            const porcentaje = resumen.total_dolares > 0 ? ((item.total_dolares / resumen.total_dolares) * 100).toFixed(1) : 0;

                            return (
                                <div
                                    key={item.concepto}
                                    onClick={() => setConceptoFiltro(isSelected ? "TODOS" : item.concepto)}
                                    style={{
                                        padding: "12px 16px",
                                        borderRadius: 12,
                                        border: `2px solid ${isSelected ? "#2563eb" : badge.border}`,
                                        background: isSelected ? "#eff6ff" : "#ffffff",
                                        cursor: "pointer",
                                        transition: "all 0.15s ease",
                                        minWidth: 150,
                                        flex: "1 1 calc(16% - 12px)",
                                    }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                        <span style={{ fontWeight: 700, fontSize: "0.85rem", color: badge.color }}>
                                            {item.concepto}
                                        </span>
                                        <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>
                                            {porcentaje}%
                                        </span>
                                    </div>
                                    <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>
                                        {formatUSD(item.total_dolares)}
                                    </div>
                                    <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 2 }}>
                                        {item.cantidad} gasto{item.cantidad !== 1 ? "s" : ""}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Barra de Filtros */}
            <div style={{ background: "white", padding: 18, borderRadius: 16, border: "1px solid #e2e8f0", marginBottom: 20, boxShadow: "0 2px 6px rgba(15,23,42,0.03)" }}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    {/* Buscador */}
                    <div style={{ flex: "2 1 240px", minWidth: 200, position: "relative" }}>
                        <input
                            type="text"
                            placeholder="🔍 Buscar concepto, categoría u observaciones..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            style={{
                                width: "100%",
                                padding: "10px 14px",
                                border: "1px solid #cbd5e1",
                                borderRadius: 10,
                                fontSize: "0.9rem",
                                outline: "none",
                                boxSizing: "border-box",
                            }}
                        />
                    </div>

                    {/* Filtro Concepto Dropdown */}
                    <div style={{ flex: "1 1 180px", minWidth: 150 }}>
                        <select
                            value={conceptoFiltro}
                            onChange={(e) => setConceptoFiltro(e.target.value)}
                            style={{
                                width: "100%",
                                padding: "10px 14px",
                                border: "1px solid #cbd5e1",
                                borderRadius: 10,
                                fontSize: "0.9rem",
                                background: "white",
                                outline: "none",
                                boxSizing: "border-box",
                            }}
                        >
                            <option value="TODOS">Todos los Conceptos</option>
                            {conceptosUnicos.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    {/* Fecha Desde / Hasta */}
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                            type="date"
                            value={fechaDesde}
                            onChange={(e) => setFechaDesde(e.target.value)}
                            title="Desde"
                            style={{
                                padding: "9px 12px",
                                border: "1px solid #cbd5e1",
                                borderRadius: 10,
                                fontSize: "0.85rem",
                                outline: "none",
                            }}
                        />
                        <span style={{ color: "#94a3b8" }}>—</span>
                        <input
                            type="date"
                            value={fechaHasta}
                            onChange={(e) => setFechaHasta(e.target.value)}
                            title="Hasta"
                            style={{
                                padding: "9px 12px",
                                border: "1px solid #cbd5e1",
                                borderRadius: 10,
                                fontSize: "0.85rem",
                                outline: "none",
                            }}
                        />
                    </div>

                    {/* Checkbox solo sin fecha */}
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", color: "#475569", cursor: "pointer", userSelect: "none" }}>
                        <input
                            type="checkbox"
                            checked={soloSinFecha}
                            onChange={(e) => setSoloSinFecha(e.target.checked)}
                        />
                        Solo sin fecha
                    </label>

                    {/* Limpiar filtros */}
                    {(busqueda || conceptoFiltro !== "TODOS" || soloSinFecha || fechaDesde || fechaHasta) && (
                        <button
                            onClick={() => {
                                setBusqueda("");
                                setConceptoFiltro("TODOS");
                                setSoloSinFecha(false);
                                setFechaDesde("");
                                setFechaHasta("");
                            }}
                            style={{
                                background: "#f1f5f9",
                                border: "none",
                                padding: "10px 14px",
                                borderRadius: 10,
                                color: "#64748b",
                                cursor: "pointer",
                                fontSize: "0.85rem",
                                fontWeight: 600,
                            }}
                        >
                            Limpiar
                        </button>
                    )}
                </div>
            </div>

            {/* Tabla de Gastos */}
            <div style={{ background: "white", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 4px 12px rgba(15,23,42,0.03)" }}>
                {loading ? (
                    <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>
                        <div style={{ fontSize: "1.5rem", marginBottom: 10 }}>⏳</div>
                        Cargando base de datos de gastos...
                    </div>
                ) : gastosFiltrados.length === 0 ? (
                    <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>
                        <div style={{ fontSize: "2rem", marginBottom: 10 }}>🔍</div>
                        <h4 style={{ margin: "0 0 6px 0", color: "#334155" }}>No se encontraron gastos</h4>
                        <p style={{ margin: 0, fontSize: "0.9rem" }}>Prueba cambiando o limpiando los filtros de búsqueda.</p>
                    </div>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
                            <thead>
                                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                    <th style={{ padding: "14px 16px" }}>#</th>
                                    <th style={{ padding: "14px 16px" }}>Fecha</th>
                                    <th style={{ padding: "14px 16px" }}>Concepto</th>
                                    <th style={{ padding: "14px 16px" }}>Categoría / Detalle</th>
                                    <th style={{ padding: "14px 16px", textAlign: "right" }}>Total Reales</th>
                                    <th style={{ padding: "14px 16px", textAlign: "right" }}>Total Dólares</th>
                                    <th style={{ padding: "14px 16px" }}>Origen</th>
                                    <th style={{ padding: "14px 16px" }}>Observaciones</th>
                                    <th style={{ padding: "14px 16px", textAlign: "center" }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {gastosFiltrados.map((g, idx) => {
                                    const badge = getConceptoBadgeStyle(g.concepto);
                                    return (
                                        <tr
                                            key={g.id}
                                            style={{
                                                borderBottom: "1px solid #f1f5f9",
                                                background: idx % 2 === 0 ? "#ffffff" : "#fcfcfd",
                                                transition: "background 0.1s",
                                            }}
                                            onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                                            onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? "#ffffff" : "#fcfcfd")}
                                        >
                                            <td style={{ padding: "14px 16px", color: "#94a3b8", fontSize: "0.8rem", fontWeight: 600 }}>
                                                {g.id}
                                            </td>
                                            <td style={{ padding: "14px 16px", color: g.fecha ? "#1e293b" : "#94a3b8", fontWeight: g.fecha ? 600 : 400, whiteSpace: "nowrap" }}>
                                                {g.fecha || "—"}
                                            </td>
                                            <td style={{ padding: "14px 16px" }}>
                                                <span
                                                    style={{
                                                        background: badge.bg,
                                                        color: badge.color,
                                                        border: `1px solid ${badge.border}`,
                                                        padding: "4px 10px",
                                                        borderRadius: 8,
                                                        fontSize: "0.78rem",
                                                        fontWeight: 700,
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {g.concepto}
                                                </span>
                                            </td>
                                            <td style={{ padding: "14px 16px", color: "#334155", fontWeight: 500 }}>
                                                {g.categoria || "—"}
                                            </td>
                                            <td style={{ padding: "14px 16px", textAlign: "right", color: "#475569", fontWeight: 600, whiteSpace: "nowrap" }}>
                                                {g.total_reales != null ? formatBRL(g.total_reales) : "—"}
                                            </td>
                                            <td style={{ padding: "14px 16px", textAlign: "right", color: "#0f172a", fontWeight: 800, whiteSpace: "nowrap" }}>
                                                {g.total_dolares != null ? formatUSD(g.total_dolares) : "—"}
                                            </td>
                                            <td style={{ padding: "14px 16px" }}>
                                                <span
                                                    style={{
                                                        background: g.origen_usd?.includes("CALCULADO") ? "#fef3c7" : g.origen_usd?.includes("CLAUDE") ? "#e0e7ff" : "#f1f5f9",
                                                        color: g.origen_usd?.includes("CALCULADO") ? "#92400e" : g.origen_usd?.includes("CLAUDE") ? "#4338ca" : "#475569",
                                                        padding: "3px 8px",
                                                        borderRadius: 6,
                                                        fontSize: "0.72rem",
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    {g.origen_usd || "—"}
                                                </span>
                                            </td>
                                            <td style={{ padding: "14px 16px", color: "#64748b", fontSize: "0.85rem" }}>
                                                {g.observaciones || "—"}
                                            </td>
                                            <td style={{ padding: "14px 16px", textAlign: "center", whiteSpace: "nowrap" }}>
                                                <button
                                                    onClick={() => abrirModalEditar(g)}
                                                    style={{
                                                        background: "none",
                                                        border: "none",
                                                        cursor: "pointer",
                                                        fontSize: "1rem",
                                                        marginRight: 8,
                                                        padding: 4,
                                                    }}
                                                    title="Editar gasto"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    onClick={() => handleEliminarGasto(g.id)}
                                                    style={{
                                                        background: "none",
                                                        border: "none",
                                                        cursor: "pointer",
                                                        fontSize: "1rem",
                                                        padding: 4,
                                                    }}
                                                    title="Eliminar gasto"
                                                >
                                                    🗑️
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal Crear / Editar */}
            {modalAbierto && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "rgba(15,23,42,0.6)",
                        backdropFilter: "blur(4px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 9999,
                        padding: 16,
                    }}
                >
                    <div
                        style={{
                            background: "white",
                            borderRadius: 20,
                            padding: 28,
                            width: "100%",
                            maxWidth: 520,
                            boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
                            border: "1px solid #e2e8f0",
                        }}
                    >
                        <h2 style={{ margin: "0 0 18px 0", color: "#0f172a", fontSize: "1.35rem", fontWeight: 800 }}>
                            {gastoEditando ? "✏️ Editar Gasto" : "➕ Registrar Nuevo Gasto"}
                        </h2>

                        <form onSubmit={handleGuardarGasto}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                                <div>
                                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: 6 }}>
                                        Fecha (opcional)
                                    </label>
                                    <input
                                        type="date"
                                        value={formGasto.fecha}
                                        onChange={(e) => setFormGasto({ ...formGasto, fecha: e.target.value })}
                                        style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: 6 }}>
                                        Concepto *
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ej: OFICINA, SHED..."
                                        required
                                        value={formGasto.concepto}
                                        onChange={(e) => setFormGasto({ ...formGasto, concepto: e.target.value })}
                                        style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: 14 }}>
                                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: 6 }}>
                                    Categoría / Detalle
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ej: ALQUILER, SUELDO BRIAN, CONTADOR..."
                                    value={formGasto.categoria}
                                    onChange={(e) => setFormGasto({ ...formGasto, categoria: e.target.value })}
                                    style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                                />
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                                <div>
                                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: 6 }}>
                                        Total Reales (BRL)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={formGasto.total_reales}
                                        onChange={(e) => setFormGasto({ ...formGasto, total_reales: e.target.value })}
                                        style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: 6 }}>
                                        Total Dólares (USD)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={formGasto.total_dolares}
                                        onChange={(e) => setFormGasto({ ...formGasto, total_dolares: e.target.value })}
                                        style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: 14 }}>
                                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: 6 }}>
                                    Origen USD
                                </label>
                                <select
                                    value={formGasto.origen_usd}
                                    onChange={(e) => setFormGasto({ ...formGasto, origen_usd: e.target.value })}
                                    style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "white", boxSizing: "border-box" }}
                                >
                                    <option value="PLANILLA">PLANILLA</option>
                                    <option value="CALCULADO 5.1">CALCULADO 5.1</option>
                                    <option value="CLAUDE CHAT">CLAUDE CHAT</option>
                                    <option value="OTRO">OTRO</option>
                                </select>
                            </div>

                            <div style={{ marginBottom: 20 }}>
                                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: 6 }}>
                                    Observaciones
                                </label>
                                <input
                                    type="text"
                                    placeholder="Notas adicionales..."
                                    value={formGasto.observaciones}
                                    onChange={(e) => setFormGasto({ ...formGasto, observaciones: e.target.value })}
                                    style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                                />
                            </div>

                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                                <button
                                    type="button"
                                    onClick={cerrarModal}
                                    style={{ padding: "10px 18px", background: "#f1f5f9", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, color: "#475569" }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={guardando}
                                    style={{ padding: "10px 22px", background: "#2563eb", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}
                                >
                                    {guardando ? "Guardando..." : "Guardar Gasto"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
