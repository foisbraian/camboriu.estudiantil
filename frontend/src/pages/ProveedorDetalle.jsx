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
    const footerSumEnabled = headers.map((_, idx) => {
        if (Array.isArray(payload?.footerSumEnabled) && typeof payload.footerSumEnabled[idx] === "boolean") {
            return payload.footerSumEnabled[idx];
        }
        return true;
    });
    return { headers, rows: normalizedRows, footerSumEnabled };
};

export default function ProveedorDetalle() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [proveedor, setProveedor] = useState(null);
    const [spreadsheet, setSpreadsheet] = useState({ headers: [], rows: [], footerSumEnabled: [] });
    const [loading, setLoading] = useState(true);

    const cargar = useCallback(async () => {
        try {
            const res = await api.get(`/proveedores/${id}`);
            setProveedor(res.data);
            setSpreadsheet(normalizeSpreadsheet(JSON.parse(res.data.data)));
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
        const newFooter = [...(spreadsheet.footerSumEnabled || []), true];
        setSpreadsheet({ ...spreadsheet, headers: newHeaders, rows: newRows, footerSumEnabled: newFooter });
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
        const newFooter = [...(spreadsheet.footerSumEnabled || [])];
        newFooter.splice(index, 1);
        setSpreadsheet({ ...spreadsheet, headers: newHeaders, rows: newRows, footerSumEnabled: newFooter });
    };

    const toggleFooterSum = (index) => {
        const alignedFooter = spreadsheet.headers.map((_, idx) => {
            if (typeof spreadsheet.footerSumEnabled?.[idx] === "boolean") {
                return spreadsheet.footerSumEnabled[idx];
            }
            return true;
        });
        const newFooter = [...alignedFooter];
        newFooter[index] = !newFooter[index];
        setSpreadsheet({ ...spreadsheet, footerSumEnabled: newFooter });
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
                                            <button id="print-controls" onClick={() => removeColumn(i)} style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: "0.7rem", cursor: "pointer", padding: 0 }}>✕</button>
                                        </div>
                                    </th>
                                ))}
                                <th id="print-controls" style={{ width: 40 }}>
                                    <button onClick={addColumn} style={{ background: "#eff6ff", color: "#3b82f6", border: "none", borderRadius: 4, cursor: "pointer", padding: "4px 8px" }}>+</button>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {spreadsheet.rows.map((row, ri) => (
                                <tr key={ri} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                    <td style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.7rem", borderRight: "1px solid #e2e8f0", background: "#f8fafc" }}>
                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                            {ri + 1}
                                            <button id="print-controls" onClick={() => remoteRow(ri)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: 0, marginTop: 4 }}>🗑️</button>
                                        </div>
                                    </td>
                                    {row.map((cell, ci) => (
                                        <td key={ci} style={{ padding: 0, borderRight: "1px solid #e2e8f0" }}>
                                            <input
                                                value={cell}
                                                onChange={(e) => updateCell(ri, ci, e.target.value)}
                                                style={{
                                                    width: "100%",
                                                    padding: 12,
                                                    border: "none",
                                                    outline: "none",
                                                    fontSize: "0.95rem",
                                                    color: "#475569"
                                                }}
                                            />
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
                                        {spreadsheet.footerSumEnabled?.[i] ? (
                                            <>
                                                <div style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase", marginBottom: 2 }}>Suma Total</div>
                                                <div>{calculateColSum(i)}</div>
                                                <button
                                                    id="print-controls"
                                                    onClick={() => toggleFooterSum(i)}
                                                    style={{ marginTop: 6, background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "0.75rem" }}
                                                >
                                                    Quitar suma
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <div style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase", marginBottom: 2 }}>Sin cálculo</div>
                                                <div style={{ color: "#cbd5e1", fontWeight: 600 }}>—</div>
                                                <button
                                                    id="print-controls"
                                                    onClick={() => toggleFooterSum(i)}
                                                    style={{ marginTop: 6, background: "transparent", border: "none", color: "#16a34a", cursor: "pointer", fontSize: "0.75rem" }}
                                                >
                                                    Mostrar suma
                                                </button>
                                            </>
                                        )}
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
