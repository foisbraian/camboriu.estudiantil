import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";

const normalizeSpreadsheet = (payload) => {
    const headers = Array.isArray(payload?.headers) ? payload.headers : [];
    const rowsData = Array.isArray(payload?.rows) ? payload.rows : [];
    const normalizedRows = rowsData.map((row) => {
        if (!Array.isArray(row)) {
            return Array(headers.length).fill("");
        }
        const newRow = Array(headers.length).fill("");
        row.forEach((cell, idx) => {
            if (idx < headers.length) {
                newRow[idx] = cell ?? "";
            }
        });
        return newRow;
    });
    const footerCalculations = headers.map((_, idx) => {
        const raw = payload?.footerCalculations?.[idx];
        if (raw === "sum" || raw === "count" || raw === "none") {
            return raw;
        }
        if (Array.isArray(payload?.footerSumEnabled) && payload.footerSumEnabled[idx] === false) {
            return "none";
        }
        return "sum";
    });
    const columnConfigs = headers.map((_, idx) => {
        const raw = payload?.columnConfigs?.[idx];
        if (raw && raw.type === "select" && Array.isArray(raw.options)) {
            return {
                type: "select",
                options: raw.options.map((opt) => opt?.toString?.() ?? "").filter((opt) => opt !== "")
            };
        }
        return { type: "text", options: [] };
    });
    return { headers, rows: normalizedRows, footerCalculations, columnConfigs };
};

export default function ProveedorDetalle() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [proveedor, setProveedor] = useState(null);
    const [spreadsheet, setSpreadsheet] = useState({ headers: [], rows: [], footerCalculations: [], columnConfigs: [] });
    const [columnFilters, setColumnFilters] = useState({});
    const [loading, setLoading] = useState(true);

    const cargar = useCallback(async () => {
        try {
            const res = await api.get(`/proveedores/${id}`);
            setProveedor(res.data);
            setSpreadsheet(normalizeSpreadsheet(JSON.parse(res.data.data)));
            setColumnFilters({});
        } catch (e) {
            console.error("Error al cargar detalle", e);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const guardar = async () => {
        try {
            await api.put(`/proveedores/${id}`, {
                nombre: proveedor.nombre,
                data: JSON.stringify(spreadsheet)
            });
            alert("✅ Planilla guardada correctamente");
        } catch (e) {
            alert("❌ Error al guardar");
        }
    };

    // --- Handlers Planilla ---
    const updateHeader = (index, value) => {
        const newHeaders = [...spreadsheet.headers];
        newHeaders[index] = value;
        setSpreadsheet({ ...spreadsheet, headers: newHeaders });
    };

    const updateCell = (rowIndex, colIndex, value) => {
        const newRows = [...spreadsheet.rows];
        newRows[rowIndex][colIndex] = value;
        setSpreadsheet({ ...spreadsheet, rows: newRows });
    };

    const addRow = () => {
        const newRow = new Array(spreadsheet.headers.length).fill("");
        setSpreadsheet({ ...spreadsheet, rows: [...spreadsheet.rows, newRow] });
    };

    const remoteRow = (index) => {
        const newRows = [...spreadsheet.rows];
        newRows.splice(index, 1);
        setSpreadsheet({ ...spreadsheet, rows: newRows });
    };

    const addColumn = () => {
        const newHeaders = [...spreadsheet.headers, "Nueva Columna"];
        const newRows = spreadsheet.rows.map(row => [...row, ""]);
        const newFooter = [...(spreadsheet.footerCalculations || []), "sum"];
        const newColumnConfigs = [...(spreadsheet.columnConfigs || []), { type: "text", options: [] }];
        setSpreadsheet({ ...spreadsheet, headers: newHeaders, rows: newRows, footerCalculations: newFooter, columnConfigs: newColumnConfigs });
    };

    const removeColumn = (index) => {
        if (spreadsheet.headers.length <= 1) return;
        const newHeaders = [...spreadsheet.headers];
        newHeaders.splice(index, 1);
        const newRows = spreadsheet.rows.map(row => {
            const nr = [...row];
            nr.splice(index, 1);
            return nr;
        });
        const newFooter = [...(spreadsheet.footerCalculations || [])];
        newFooter.splice(index, 1);
        const newFilters = { ...columnFilters };
        delete newFilters[index];
        const shiftedFilters = {};
        Object.keys(newFilters).forEach((key) => {
            const k = Number(key);
            shiftedFilters[k > index ? k - 1 : k] = newFilters[key];
        });
        const newColumnConfigs = [...(spreadsheet.columnConfigs || [])];
        newColumnConfigs.splice(index, 1);
        setColumnFilters(shiftedFilters);
        setSpreadsheet({ ...spreadsheet, headers: newHeaders, rows: newRows, footerCalculations: newFooter, columnConfigs: newColumnConfigs });
    };

    const setFooterCalculationMode = (index, mode) => {
        const allowed = new Set(["sum", "count", "none"]);
        const normalizedMode = allowed.has(mode) ? mode : "sum";
        const alignedFooter = spreadsheet.headers.map((_, idx) => {
            const raw = spreadsheet.footerCalculations?.[idx];
            if (raw === "sum" || raw === "count" || raw === "none") {
                return raw;
            }
            return "sum";
        });
        const newFooter = [...alignedFooter];
        newFooter[index] = normalizedMode;
        setSpreadsheet({ ...spreadsheet, footerCalculations: newFooter });
    };

    const updateFilter = (index, value) => {
        const newFilters = { ...columnFilters };
        if (!value) {
            delete newFilters[index];
        } else {
            newFilters[index] = value;
        }
        setColumnFilters(newFilters);
    };

    const clearFilters = () => {
        setColumnFilters({});
    };

    const configureColumn = (index) => {
        const alignedConfigs = spreadsheet.headers.map((_, idx) => {
            const raw = spreadsheet.columnConfigs?.[idx];
            if (raw && raw.type === "select" && Array.isArray(raw.options)) {
                return raw;
            }
            return { type: "text", options: [] };
        });
        const currentConfig = alignedConfigs[index];
        const initialValue = currentConfig.type === "select" ? currentConfig.options.join(", ") : "";
        const response = window.prompt("Ingresa las opciones para la lista desplegable separadas por coma. Deja vacío para volver a texto libre.", initialValue);
        if (response === null) return;
        const options = response
            .split(",")
            .map((opt) => opt.trim())
            .filter((opt) => opt.length > 0);
        const newConfigs = [...alignedConfigs];
        if (options.length === 0) {
            newConfigs[index] = { type: "text", options: [] };
        } else {
            newConfigs[index] = { type: "select", options };
        }
        setSpreadsheet({ ...spreadsheet, columnConfigs: newConfigs });
    };

    const columnValueOptions = spreadsheet.headers.map((_, idx) => {
        const valueSet = new Set();
        spreadsheet.rows.forEach((row) => {
            const value = row[idx];
            if (value !== undefined && value !== null && value !== "") {
                valueSet.add(value.toString());
            }
        });
        if (spreadsheet.columnConfigs?.[idx]?.type === "select") {
            spreadsheet.columnConfigs[idx].options.forEach((opt) => {
                if (opt !== "") valueSet.add(opt);
            });
        }
        return Array.from(valueSet).sort((a, b) => a.localeCompare(b, "es", { numeric: true, sensitivity: "base" }));
    });

    const filteredRows = spreadsheet.rows
        .map((row, originalIndex) => ({ row, originalIndex }))
        .filter(({ row }) => {
            return Object.entries(columnFilters).every(([colIndex, filterValue]) => {
                const idx = Number(colIndex);
                const cellValue = row[idx] ?? "";
                if (!filterValue) return true;
                return cellValue.toString() === filterValue;
            });
        });

    const formatCSVValue = (value) => {
        const str = (value ?? "").toString();
        if (/[",\n]/.test(str)) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const exportToExcel = () => {
        if (!spreadsheet.headers.length) {
            alert("No hay datos para exportar");
            return;
        }
        const headerRow = spreadsheet.headers.map(formatCSVValue).join(",");
        const dataRows = spreadsheet.rows.map((row) => row.map(formatCSVValue).join(","));
        const csvContent = [headerRow, ...dataRows].join("\n");
        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const safeName = proveedor?.nombre ? proveedor.nombre.replace(/[^a-zA-Z0-9-_]/g, "_") : "planilla";
        const date = new Date().toISOString().split("T")[0];
        link.href = url;
        link.download = `${safeName}-${date}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // --- Cálculos ---
    const calculateColSum = (colIndex) => {
        let sum = 0;
        spreadsheet.rows.forEach(row => {
            const val = parseFloat(row[colIndex]);
            if (!isNaN(val)) sum += val;
        });
        return sum.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
    };

    const calculateColCount = (colIndex) => {
        let count = 0;
        spreadsheet.rows.forEach(row => {
            const raw = row[colIndex];
            if (raw === 0) {
                count += 1;
                return;
            }
            if (raw === null || raw === undefined) return;
            if (raw.toString().trim() === "") return;
            count += 1;
        });
        return count;
    };

    if (loading) return <div style={{ padding: 40 }}>Cargando...</div>;
    if (!proveedor) return <div style={{ padding: 40 }}>No se encontró el proveedor.</div>;

    return (
        <div style={{ padding: "30px 40px", height: "100%", overflowY: "auto" }}>

            {/* Header Acciones */}
            <div id="print-controls" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
                <div>
                    <button onClick={() => navigate("/proveedores")} style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", fontSize: "0.9rem", padding: 0 }}>
                        ← Volver a lista
                    </button>
                    <h1 style={{ margin: "5px 0 0 0", color: "#1e293b", fontWeight: 800 }}>{proveedor.nombre}</h1>
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                    <button onClick={guardar} className="btn-primary" style={{ padding: "10px 20px" }}>
                        💾 Guardar Cambios
                    </button>
                    <button onClick={exportToExcel} style={{ background: "#f1f5f9", color: "#0f172a", padding: "10px 20px", border: "1px solid #cbd5e1", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>
                        ⬇️ Exportar Excel
                    </button>
                    <button onClick={() => window.print()} style={{ background: "#10b981", color: "white", padding: "10px 20px", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>
                        🖨️ Imprimir Planilla
                    </button>
                </div>
            </div>

            {/* Título sólo para imprimir */}
            <div id="print-title" style={{ display: "none" }}>
                <h1 style={{ textAlign: "center", marginBottom: 40, borderBottom: "2px solid #1e293b", paddingBottom: 10 }}>
                    Planilla de Proveedor: {proveedor.nombre}
                </h1>
            </div>

            {/* Spreadsheet UI */}
            <div style={{ background: "white", borderRadius: 16, boxShadow: "0 10px 30px rgba(0,0,0,0.06)", overflow: "hidden", border: "1px solid #e2e8f0" }}>

                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                        <thead style={{ background: "#f8fafc" }}>
                            <tr>
                                <th style={{ width: 50, borderRight: "1px solid #e2e8f0" }}></th>
                                {spreadsheet.headers.map((h, i) => (
                                    <th key={i} style={{ padding: 12, borderRight: "1px solid #e2e8f0", borderBottom: "2px solid #cbd5e1" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <input
                                                value={h}
                                                onChange={(e) => updateHeader(i, e.target.value)}
                                                style={{
                                                    background: "transparent",
                                                    border: "none",
                                                    fontWeight: 700,
                                                    color: "#334155",
                                                    textAlign: "center",
                                                    width: "100%",
                                                    outline: "none"
                                                }}
                                            />
                                            {spreadsheet.columnConfigs?.[i]?.type === "select" && (
                                                <span style={{ fontSize: "0.7rem", color: "#0f172a", background: "#e2e8f0", padding: "2px 6px", borderRadius: 999 }}>Lista</span>
                                            )}
                                            <button id="print-controls" onClick={() => configureColumn(i)} style={{ background: "transparent", border: "none", color: "#0f172a", fontSize: "0.75rem", cursor: "pointer", padding: 0 }}>⚙️</button>
                                            <button id="print-controls" onClick={() => removeColumn(i)} style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: "0.7rem", cursor: "pointer", padding: 0 }}>✕</button>
                                        </div>
                                    </th>
                                ))}
                                <th id="print-controls" style={{ width: 40 }}>
                                    <button onClick={addColumn} style={{ background: "#eff6ff", color: "#3b82f6", border: "none", borderRadius: 4, cursor: "pointer", padding: "4px 8px" }}>+</button>
                                </th>
                            </tr>
                            <tr id="print-controls">
                                <th style={{ borderRight: "1px solid #e2e8f0", padding: 8, textAlign: "left", fontSize: "0.75rem", color: "#94a3b8" }}>
                                    Filtros
                                    {Object.keys(columnFilters).length > 0 && (
                                        <button onClick={clearFilters} style={{ marginLeft: 8, background: "transparent", border: "none", color: "#3b82f6", cursor: "pointer", fontSize: "0.75rem" }}>
                                            Limpiar
                                        </button>
                                    )}
                                </th>
                                {spreadsheet.headers.map((_, idx) => (
                                    <th key={`filter-${idx}`} style={{ padding: 8, borderRight: "1px solid #e2e8f0" }}>
                                        <select
                                            value={columnFilters[idx] || ""}
                                            onChange={(e) => updateFilter(idx, e.target.value)}
                                            style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: "0.8rem", background: "white" }}
                                        >
                                            <option value="">Todos</option>
                                            {columnValueOptions[idx].map((option) => (
                                                <option key={`${idx}-${option}`} value={option}>
                                                    {option}
                                                </option>
                                            ))}
                                        </select>
                                    </th>
                                ))}
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.map(({ row, originalIndex }) => (
                                <tr key={`row-${originalIndex}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                    <td style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.7rem", borderRight: "1px solid #e2e8f0", background: "#f8fafc" }}>
                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                            {originalIndex + 1}
                                            <button id="print-controls" onClick={() => remoteRow(originalIndex)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: 0, marginTop: 4 }}>🗑️</button>
                                        </div>
                                    </td>
                                    {row.map((cell, ci) => (
                                        <td key={ci} style={{ padding: 0, borderRight: "1px solid #e2e8f0" }}>
                                            {spreadsheet.columnConfigs?.[ci]?.type === "select" && spreadsheet.columnConfigs?.[ci]?.options?.length ? (
                                                <select
                                                    value={cell}
                                                    onChange={(e) => updateCell(originalIndex, ci, e.target.value)}
                                                    style={{
                                                        width: "100%",
                                                        padding: 12,
                                                        border: "none",
                                                        outline: "none",
                                                        fontSize: "0.95rem",
                                                        color: "#0f172a",
                                                        background: "#f8fafc"
                                                    }}
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {spreadsheet.columnConfigs[ci].options.map((opt) => (
                                                        <option key={`${ci}-${opt}`} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input
                                                    value={cell}
                                                    onChange={(e) => updateCell(originalIndex, ci, e.target.value)}
                                                    style={{
                                                        width: "100%",
                                                        padding: 12,
                                                        border: "none",
                                                        outline: "none",
                                                        fontSize: "0.95rem",
                                                        color: "#475569"
                                                    }}
                                                />
                                            )}
                                        </td>
                                    ))}
                                    <td id="print-controls"></td>
                                </tr>
                            ))}

                            {/* Botón agregar fila */}
                            <tr id="print-controls">
                                <td style={{ borderRight: "1px solid #e2e8f0", background: "#f8fafc" }}></td>
                                <td colSpan={spreadsheet.headers.length} style={{ padding: 10 }}>
                                    <button onClick={addRow} style={{ background: "#f0fdf4", color: "#16a34a", border: "1px dashed #bbf7d0", width: "100%", padding: 8, borderRadius: 8, fontSize: "0.85rem", fontWeight: 600 }}>
                                        + Nueva Fila
                                    </button>
                                </td>
                                <td></td>
                            </tr>

                            {/* Pie de Cálculos (Totales) */}
                            <tr style={{ background: "#f8fafc", fontWeight: 800, color: "#1e293b" }}>
                                <td style={{ padding: 12, borderRight: "1px solid #e2e8f0" }}>∑</td>
                                {spreadsheet.headers.map((h, i) => (
                                    <td key={i} style={{ padding: 12, borderRight: "1px solid #e2e8f0", textAlign: "right" }}>
                                        {(() => {
                                            const mode = spreadsheet.footerCalculations?.[i] || "sum";
                                            if (mode === "sum") {
                                                return (
                                                    <>
                                                        <div style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase", marginBottom: 2 }}>Suma Total</div>
                                                        <div>{calculateColSum(i)}</div>
                                                    </>
                                                );
                                            }
                                            if (mode === "count") {
                                                return (
                                                    <>
                                                        <div style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase", marginBottom: 2 }}>Conteo Activos</div>
                                                        <div style={{ fontSize: "1.1rem" }}>{calculateColCount(i)}</div>
                                                    </>
                                                );
                                            }
                                            return (
                                                <>
                                                    <div style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase", marginBottom: 2 }}>Sin cálculo</div>
                                                    <div style={{ color: "#cbd5e1", fontWeight: 600 }}>—</div>
                                                </>
                                            );
                                        })()}
                                        <div id="print-controls" style={{ marginTop: 8 }}>
                                            <label style={{ display: "block", fontSize: "0.65rem", color: "#94a3b8", textTransform: "uppercase", marginBottom: 2 }}>Modo</label>
                                            <select
                                                value={spreadsheet.footerCalculations?.[i] || "sum"}
                                                onChange={(e) => setFooterCalculationMode(i, e.target.value)}
                                                style={{ width: "100%", padding: "4px 6px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: "0.75rem", background: "white" }}
                                            >
                                                <option value="sum">Suma</option>
                                                <option value="count">Conteo</option>
                                                <option value="none">Sin cálculo</option>
                                            </select>
                                        </div>
                                    </td>
                                ))}
                                <td id="print-controls"></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Nota pie */}
            <p style={{ marginTop: 20, color: "#94a3b8", fontSize: "0.85rem", fontStyle: "italic" }}>
                * Las celdas se calculan automáticamente si contienen solo números. Puedes agregar tantas columnas y filas como necesites para el proveedor.
            </p>

        </div>
    );
}
