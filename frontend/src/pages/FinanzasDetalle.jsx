import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { BASE_URL } from "../api";

export default function FinanzasDetalle() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [resumen, setResumen] = useState(null);
    const [pagos, setPagos] = useState([]);
    const [descuento, setDescuento] = useState(0); // Porcentaje de descuento
    const [grupoDetalle, setGrupoDetalle] = useState(null); // Para el modal de detalle del grupo
    const [loadingDetalle, setLoadingDetalle] = useState(false);

    // Form para configuración
    const [configForm, setConfigForm] = useState({
        moneda: "ARS",
        precio_disco_individual: 0,
        precio_parque_individual: 0,
        precio_parque_con_comida: 0,
        precio_parque_sin_comida: 0,
        precio_pool_individual: 0,
        precio_pool_con_comida: 0,
        precio_pool_sin_comida: 0,
        precio_cena_velas: 0,
        precio_bar_hielo: 0,
        es_combo: false,
        precio_combo: 0,
        combo_discos: 0,
        combo_parque: false,
        combo_pool: false,

        disco_liberados_ratio: 0,
        disco_padres_gratis: false,
        disco_guias_gratis: false,
        parque_liberados_ratio: 0,
        parque_padres_gratis: false,
        parque_guias_gratis: false,
        pool_liberados_ratio: 0,
        pool_padres_gratis: false,
        pool_guias_gratis: false,
    });

    const [pagoForm, setPagoForm] = useState({
        monto: 0,
        fecha: new Date().toISOString().split("T")[0],
        metodo: "Transferencia",
        nota: "",
    });

    // Componente helper para inputs de liberados
    const LiberadosInputs = ({ prefix, label }) => (
        <div style={{ padding: "8px 10px", background: "#f1f5f9", borderRadius: 8, marginTop: 5 }}>
            <p style={{ margin: "0 0 4px 0", fontSize: "0.7rem", fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>Liberados {label}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ fontSize: "0.75rem" }}>Ratio:</span>
                    <input
                        type="number"
                        placeholder="Ratio"
                        value={configForm[`${prefix}_liberados_ratio`]}
                        onChange={e => setConfigForm({ ...configForm, [`${prefix}_liberados_ratio`]: Number(e.target.value) })}
                        style={{ width: 50, padding: "2px 5px", borderRadius: 4, border: "1px solid #cbd5e1" }}
                    />
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>: 1</span>
                </div>
                <label style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                    <input
                        type="checkbox"
                        checked={configForm[`${prefix}_padres_gratis`]}
                        onChange={e => setConfigForm({ ...configForm, [`${prefix}_padres_gratis`]: e.target.checked })}
                    /> Padres Gratis
                </label>
                <label style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                    <input
                        type="checkbox"
                        checked={configForm[`${prefix}_guias_gratis`]}
                        onChange={e => setConfigForm({ ...configForm, [`${prefix}_guias_gratis`]: e.target.checked })}
                    /> Guías Gratis
                </label>
            </div>
        </div>
    );

    const cargarTodo = useCallback(async () => {
        try {
            const resR = await api.get(`/finanzas/resumen/${id}`);
            setResumen(resR.data);
            setConfigForm(resR.data.config);

            const resP = await api.get(`/finanzas/pagos/${id}`);
            setPagos(resP.data);

            // Si el modal está abierto, refrescar también sus asignaciones
            if (grupoDetalle && grupoDetalle.grupo) {
                const resAsigs = await api.get(`/finanzas/asignaciones/${grupoDetalle.grupo.id}`);
                setGrupoDetalle(prev => ({ ...prev, asignaciones: resAsigs.data }));
            }
        } catch (err) {
            console.error(err);
        }
    }, [id, grupoDetalle]);

    useEffect(() => {
        cargarTodo();
    }, [cargarTodo]);

    async function guardarConfig() {
        await api.post("/finanzas/config", { ...configForm, empresa_id: Number(id) });
        alert("Configuración guardada");
        cargarTodo();
    }

    async function registrarPago(e) {
        e.preventDefault();
        await api.post("/finanzas/pagos", { ...pagoForm, empresa_id: Number(id) });
        setPagoForm({ monto: 0, fecha: new Date().toISOString().split("T")[0], metodo: "Transferencia", nota: "" });
        alert("Pago registrado");
        cargarTodo();
    }

    async function verDetalleGrupo(grupo) {
        setLoadingDetalle(true);
        setGrupoDetalle({ grupo, asignaciones: [] });
        try {
            console.log("Abriendo detalle grupo:", grupo.id);
            const res = await api.get(`/finanzas/asignaciones/${grupo.id}`);
            console.log("Asignaciones obtenidas:", res.data);
            setGrupoDetalle({ grupo, asignaciones: res.data });
        } catch (err) {
            console.error("Error al cargar detalle grupo:", err);
            alert("Error al cargar las asignaciones: " + (err.response?.data?.detail || err.message));
        } finally {
            setLoadingDetalle(false);
        }
    }

    async function eliminarPago(pagoId) {
        if (!window.confirm("¿Eliminar este pago?")) return;
        await api.delete(`/finanzas/pagos/${pagoId}`);
        cargarTodo();
    }

    const formatMoney = (val) => {
        const moneda = (configForm && configForm.moneda) ? configForm.moneda : "ARS";
        return new Intl.NumberFormat("es-AR", { 
            style: "currency", 
            currency: moneda, 
            maximumFractionDigits: 0 
        }).format(val || 0);
    };

    if (!resumen) return <div style={{ padding: 40 }}>Cargando datos...</div>;

    const totalConDescuento = resumen.total_venta * (1 - descuento / 100);
    const saldoFinal = totalConDescuento - resumen.total_pagado;

    return (
        <div style={{ padding: "40px 20px", maxWidth: "1000px" }}>
            <button
                onClick={() => navigate("/finanzas")}
                style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontWeight: 700, marginBottom: 20 }}
            >
                ← Volver al Dashboard
            </button>

            <h1 style={{ color: "#1e293b", marginBottom: 30 }}>Finanzas: <span style={{ color: "#2563eb" }}>{resumen.empresa}</span></h1>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 30, marginBottom: 40 }}>
                {/* CONFIGURACIÓN DE PRECIOS */}
                <div style={{ background: "white", padding: 25, borderRadius: 12, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
                    <h3 style={{ marginTop: 0, marginBottom: 20 }}>⚙️ Configuración de Precios</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontWeight: 600 }}>
                                <input
                                    type="checkbox"
                                    checked={configForm.es_combo}
                                    onChange={e => setConfigForm({ ...configForm, es_combo: e.target.checked })}
                                />
                                Manejar por COMBO
                            </label>

                            <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600 }}>
                                Moneda:
                                <select 
                                    value={configForm.moneda} 
                                    onChange={e => setConfigForm({ ...configForm, moneda: e.target.value })}
                                    style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #cbd5e1" }}
                                >
                                    <option value="ARS">ARS ($)</option>
                                    <option value="USD">USD (US$)</option>
                                    <option value="BRL">BRL (R$)</option>
                                </select>
                            </label>
                        </div>

                        {!configForm.es_combo ? (
                            <div style={{ padding: 15, background: "#f8fafc", borderRadius: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                                <div>
                                    <p style={{ margin: "0 0 4px 0", fontSize: "0.8rem", color: "#64748b" }}>Precio Discoteca (Indiv.)</p>
                                    <input
                                        type="number"
                                        value={configForm.precio_disco_individual}
                                        onChange={e => setConfigForm({ ...configForm, precio_disco_individual: Number(e.target.value) })}
                                        style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
                                    />
                                    <LiberadosInputs prefix="disco" label="Disco" />
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                    <p style={{ margin: "0 0 4px 0", fontSize: "0.8rem", color: "#64748b" }}>Precio Parque</p>
                                    <input
                                        type="number"
                                        value={configForm.precio_parque_individual}
                                        onChange={e => setConfigForm({ ...configForm, precio_parque_individual: Number(e.target.value) })}
                                        style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
                                    />
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                                        <div>
                                            <p style={{ margin: "0 0 4px 0", fontSize: "0.75rem", color: "#64748b" }}>Con comida</p>
                                            <input
                                                type="number"
                                                value={configForm.precio_parque_con_comida}
                                                onChange={e => setConfigForm({ ...configForm, precio_parque_con_comida: Number(e.target.value) })}
                                                style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
                                            />
                                        </div>
                                        <div>
                                            <p style={{ margin: "0 0 4px 0", fontSize: "0.75rem", color: "#64748b" }}>Sin comida</p>
                                            <input
                                                type="number"
                                                value={configForm.precio_parque_sin_comida}
                                                onChange={e => setConfigForm({ ...configForm, precio_parque_sin_comida: Number(e.target.value) })}
                                                style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
                                            />
                                        </div>
                                    </div>
                                    <LiberadosInputs prefix="parque" label="Parque" />
                                </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                        <p style={{ margin: "0 0 4px 0", fontSize: "0.8rem", color: "#64748b" }}>Precio Pool</p>
                                        <input
                                            type="number"
                                            value={configForm.precio_pool_individual}
                                            onChange={e => setConfigForm({ ...configForm, precio_pool_individual: Number(e.target.value) })}
                                            style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
                                        />
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                                            <div>
                                                <p style={{ margin: "0 0 4px 0", fontSize: "0.75rem", color: "#64748b" }}>Con comida</p>
                                                <input
                                                    type="number"
                                                    value={configForm.precio_pool_con_comida}
                                                    onChange={e => setConfigForm({ ...configForm, precio_pool_con_comida: Number(e.target.value) })}
                                                    style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
                                                />
                                            </div>
                                            <div>
                                                <p style={{ margin: "0 0 4px 0", fontSize: "0.75rem", color: "#64748b" }}>Sin comida</p>
                                                <input
                                                    type="number"
                                                    value={configForm.precio_pool_sin_comida}
                                                    onChange={e => setConfigForm({ ...configForm, precio_pool_sin_comida: Number(e.target.value) })}
                                                    style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
                                                />
                                            </div>
                                        </div>
                                        <LiberadosInputs prefix="pool" label="Pool" />
                                    </div>
                                </div>
                                <div style={{ padding: 15, background: "#fefce8", borderRadius: 8 }}>
                                    <p style={{ margin: "0 0 6px 0", fontSize: "0.8rem", color: "#92400e" }}>Cena de velas</p>
                                    <input
                                        type="number"
                                        value={configForm.precio_cena_velas}
                                        onChange={e => setConfigForm({ ...configForm, precio_cena_velas: Number(e.target.value) })}
                                        style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #fcd34d" }}
                                    />
                                </div>
                                <div style={{ padding: 15, background: "#eff6ff", borderRadius: 8 }}>
                                    <p style={{ margin: "0 0 6px 0", fontSize: "0.8rem", color: "#1d4ed8" }}>Bar de hielo</p>
                                    <input
                                        type="number"
                                        value={configForm.precio_bar_hielo}
                                        onChange={e => setConfigForm({ ...configForm, precio_bar_hielo: Number(e.target.value) })}
                                        style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #bfdbfe" }}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div style={{ padding: 15, background: "#f0fdf4", borderRadius: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                                <div>
                                    <p style={{ margin: "0 0 8px 0", fontSize: "0.85rem", color: "#166534" }}>Precio Total del Combo</p>
                                    <input
                                        type="number"
                                        value={configForm.precio_combo}
                                        onChange={e => setConfigForm({ ...configForm, precio_combo: Number(e.target.value) })}
                                        style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #bbf7d0" }}
                                    />
                                </div>
                                <div style={{ display: "flex", gap: 15, fontSize: "0.85rem" }}>
                                    <input
                                        type="number"
                                        placeholder="Cant. Discos"
                                        value={configForm.combo_discos}
                                        onChange={e => setConfigForm({ ...configForm, combo_discos: Number(e.target.value) })}
                                        style={{ width: 80, padding: 5 }}
                                    />
                                    <label><input type="checkbox" checked={configForm.combo_parque} onChange={e => setConfigForm({ ...configForm, combo_parque: e.target.checked })} /> Parque</label>
                                    <label><input type="checkbox" checked={configForm.combo_pool} onChange={e => setConfigForm({ ...configForm, combo_pool: e.target.checked })} /> Pool</label>
                                </div>
                                <LiberadosInputs prefix="disco" label="Combo (Basado en Disco)" />
                            </div>
                        )}
                        <button onClick={guardarConfig} style={{ padding: 12, background: "#1e293b", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>
                            Actualizar Precios
                        </button>
                    </div>
                </div>

                {/* REGISTRO DE PAGOS */}
                <div style={{ background: "white", padding: 25, borderRadius: 12, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
                    <h3 style={{ marginTop: 0, marginBottom: 20 }}>💸 Registrar Pago</h3>
                    <form onSubmit={registrarPago} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                        <input
                            type="number"
                            placeholder="Monto $"
                            value={pagoForm.monto || ""}
                            onChange={e => setPagoForm({ ...pagoForm, monto: Number(e.target.value) })}
                            required
                            style={{ padding: 10, borderRadius: 6, border: "1px solid #cbd5e1" }}
                        />
                        <input
                            type="date"
                            value={pagoForm.fecha}
                            onChange={e => setPagoForm({ ...pagoForm, fecha: e.target.value })}
                            required
                            style={{ padding: 10, borderRadius: 6, border: "1px solid #cbd5e1" }}
                        />
                        <select
                            value={pagoForm.metodo}
                            onChange={e => setPagoForm({ ...pagoForm, metodo: e.target.value })}
                            style={{ padding: 10, borderRadius: 6, border: "1px solid #cbd5e1" }}
                        >
                            <option>Transferencia</option>
                            <option>Efectivo</option>
                            <option>Cheque</option>
                        </select>
                        <input
                            type="text"
                            placeholder="Nota / Observación"
                            value={pagoForm.nota}
                            onChange={e => setPagoForm({ ...pagoForm, nota: e.target.value })}
                            style={{ padding: 10, borderRadius: 6, border: "1px solid #cbd5e1" }}
                        />
                        <button type="submit" style={{ padding: 12, background: "#059669", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>
                            Confirmar Pago
                        </button>
                    </form>
                </div>
            </div>

            {/* RESUMEN FINANCIERO */}
            <div id="finance-report" style={{ background: "white", padding: 30, borderRadius: 12, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", marginBottom: 40 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <h3 style={{ margin: 0 }}>📊 Resumen por Grupos</h3>
                    <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={() => window.print()} style={{ padding: "8px 15px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer", fontSize: "0.85rem" }}>🖨️ Imprimir</button>
                        <button
                            onClick={() => window.open(`${BASE_URL}/excel/finanzas/${id}`, "_blank")}
                            style={{ padding: "8px 15px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer", fontSize: "0.85rem" }}
                        >
                            📄 Excel
                        </button>
                    </div>
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                            <th style={{ padding: 12, borderBottom: "2px solid #e2e8f0" }}>Grupo</th>
                            <th style={{ padding: 12, borderBottom: "2px solid #e2e8f0" }}>PAX</th>
                            <th style={{ padding: 12, borderBottom: "2px solid #e2e8f0" }}>Servicios</th>
                            <th style={{ padding: 12, borderBottom: "2px solid #e2e8f0", textAlign: "right" }}>Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        {resumen.grupos.map(g => (
                            <React.Fragment key={g.id}>
                                <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                                    <td colSpan="3" style={{ padding: 12 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div>
                                                <strong>Grupo: {g.nombre}</strong>
                                                <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 400, marginLeft: 10 }}>
                                                    (Total: {g.pax} PAX)
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => verDetalleGrupo(g)}
                                                style={{ padding: "4px 10px", background: "#3b82f6", color: "white", border: "none", borderRadius: 4, fontSize: "0.75rem", cursor: "pointer" }}
                                            >
                                                🔍 Ver Detalle / Vouchers
                                            </button>
                                        </div>
                                    </td>
                                    <td style={{ padding: 12, textAlign: "right" }}>{formatMoney(g.subtotal)}</td>
                                </tr>
                                {g.servicios.map((s, idx) => (
                                    <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9", fontSize: "0.85rem" }}>
                                        <td style={{ padding: "8px 12px", paddingLeft: 30 }}>{s.servicio}</td>
                                        <td style={{ padding: "8px 12px" }}>{s.descripcion}</td>
                                        <td style={{ padding: "8px 12px", color: "#64748b" }}>
                                            {formatMoney(s.precio_u)} x {s.cantidad} (Cant) x
                                            <b style={{ color: "#2563eb", marginLeft: 4 }}>{s.pax} Pagantes</b>
                                            <span style={{ fontSize: "0.75rem", marginLeft: 4 }}>/ Total: {s.pax_original}</span>
                                        </td>
                                        <td style={{ padding: "8px 12px", textAlign: "right", color: "#64748b" }}>{formatMoney(s.subtotal)}</td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>

                <div style={{ marginTop: 30, borderTop: "2px solid #e2e8f0", paddingTop: 20, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
                        <span style={{ fontSize: "0.9rem", color: "#64748b" }}>Subtotal General:</span>
                        <span style={{ fontSize: "1.2rem", fontWeight: 600 }}>{formatMoney(resumen.total_venta)}</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
                        <span style={{ fontSize: "0.9rem", color: "#64748b" }}>Aplicar Descuento:</span>
                        <div style={{ display: "flex", gap: 5 }}>
                            {[0, 10, 15, 20].map(d => (
                                <button
                                    key={d}
                                    onClick={() => setDescuento(d)}
                                    style={{
                                        padding: "4px 8px",
                                        borderRadius: 4,
                                        border: "1px solid #cbd5e1",
                                        background: d === descuento ? "#2563eb" : "white",
                                        color: d === descuento ? "white" : "#1e293b",
                                        cursor: "pointer",
                                        fontSize: "0.75rem"
                                    }}
                                >
                                    {d}%
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 15, marginTop: 10 }}>
                        <span style={{ fontSize: "1.1rem", fontWeight: 700 }}>Total Final:</span>
                        <span style={{ fontSize: "1.8rem", fontWeight: 800, color: "#1e293b" }}>{formatMoney(totalConDescuento)}</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 15, color: "#059669" }}>
                        <span style={{ fontSize: "0.9rem" }}>Total Cobrado:</span>
                        <span style={{ fontSize: "1.1rem", fontWeight: 600 }}>{formatMoney(resumen.total_pagado)}</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 15, color: saldoFinal > 0 ? "#ef4444" : "#059669", background: saldoFinal > 0 ? "#fef2f2" : "#f0fdf4", padding: "10px 20px", borderRadius: 8, marginTop: 10 }}>
                        <span style={{ fontSize: "1.1rem", fontWeight: 700 }}>{saldoFinal > 0 ? "Saldo Pendiente:" : "Saldo a Favor:"}</span>
                        <span style={{ fontSize: "1.6rem", fontWeight: 800 }}>{formatMoney(Math.abs(saldoFinal))}</span>
                    </div>
                </div>
            </div>

            {/* LISTADO DE PAGOS */}
            <div style={{ background: "white", padding: 30, borderRadius: 12, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
                <h3 style={{ marginTop: 0, marginBottom: 20 }}>📑 Historial de Pagos</h3>
                {pagos.length === 0 ? (
                    <p style={{ color: "#94a3b8" }}>No hay pagos registrados.</p>
                ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                                <th style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>Fecha</th>
                                <th style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>Monto</th>
                                <th style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>Método</th>
                                <th style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>Nota</th>
                                <th style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {pagos.map(p => (
                                <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                    <td style={{ padding: 12 }}>{p.fecha}</td>
                                    <td style={{ padding: 12, fontWeight: 700, color: "#059669" }}>{formatMoney(p.monto)}</td>
                                    <td style={{ padding: 12 }}>{p.metodo}</td>
                                    <td style={{ padding: 12, color: "#64748b", fontSize: "0.85rem" }}>{p.nota}</td>
                                    <td style={{ padding: 12, textAlign: "right" }}>
                                        <button onClick={() => eliminarPago(p.id)} style={{ color: "red", background: "none", border: "none", cursor: "pointer" }}>Eliminar</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* MODAL DETALLE GRUPO / VOUCHERS */}
            {grupoDetalle && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
                    <div style={{ background: "white", padding: 30, borderRadius: 12, width: "90%", maxWidth: 600, maxHeight: "80vh", overflowY: "auto" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                            <h3 style={{ margin: 0 }}>📋 Detalle de Asignaciones</h3>
                            <button onClick={() => setGrupoDetalle(null)} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer" }}>&times;</button>
                        </div>

                        {loadingDetalle ? <p>Cargando...</p> : (
                            <div style={{ display: "grid", gap: 15 }}>
                                {grupoDetalle.asignaciones.length > 0 && (
                                    <button
                                        onClick={() => window.open(`/imprimir-vouchers-grupo/${grupoDetalle.grupo.id}`, "_blank")}
                                        style={{ marginBottom: 10, padding: "12px", background: "#334155", color: "white", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                                    >
                                        🖨️ Imprimir TODOS los Vouchers
                                    </button>
                                )}
                                {grupoDetalle.asignaciones.map(a => (
                                    <div key={a.id} style={{ padding: 15, border: "1px solid #e2e8f0", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <div>
                                            <div style={{ fontWeight: 700, color: "#1e293b" }}>{a.servicio}</div>
                                            <div style={{ fontSize: "0.85rem", color: "#64748b" }}>📅 {a.fecha}</div>
                                            <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>PAX Total: {a.pax}</div>
                                            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                                                <div style={{
                                                    fontSize: "0.75rem",
                                                    fontWeight: 700,
                                                    color: a.habilitado ? "#059669" : "#ef4444",
                                                }}>
                                                    {a.habilitado ? "✅ Habilitado" : "❌ Pago Pendiente"}
                                                </div>
                                                {a.habilitado && (
                                                    <div style={{
                                                        fontSize: "0.75rem",
                                                        fontWeight: 700,
                                                        color: a.voucher_usado ? "#ec4899" : "#3b82f6",
                                                    }}>
                                                        {a.voucher_usado ? `🎟️ USADO (${a.voucher_fecha_uso})` : "🎟️ DISPONIBLE"}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => window.open(`/imprimir-voucher/${a.id}`, "_blank")}
                                            disabled={!a.habilitado}
                                            style={{
                                                padding: "8px 12px",
                                                background: a.habilitado ? "#0ea5e9" : "#cbd5e1",
                                                color: "white",
                                                border: "none",
                                                borderRadius: 6,
                                                fontSize: "0.85rem",
                                                cursor: a.habilitado ? "pointer" : "not-allowed",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 5
                                            }}
                                        >
                                            🎟️ Imprimir Individual
                                        </button>
                                    </div>
                                ))}
                                {grupoDetalle.asignaciones.length === 0 && <p style={{ textAlign: "center", color: "#64748b" }}>No hay asignaciones registradas para este grupo.</p>}
                            </div>
                        )}

                        <div style={{ marginTop: 25, textAlign: "right" }}>
                            <button onClick={() => setGrupoDetalle(null)} style={{ padding: "10px 20px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer" }}>Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Estilos para impresión */}
            <style>{`
        @media print {
            body * { visibility: hidden; }
            #finance-report, #finance-report * { visibility: visible; }
            #finance-report { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; border: none; }
            button, .no-print { display: none !important; }
        }
      `}</style>
        </div >
    );
}
