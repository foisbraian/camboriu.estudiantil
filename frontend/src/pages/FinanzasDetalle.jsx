import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { BASE_URL } from "../api";


// Acepta tanto punto como coma como separador decimal (ej: "126,5" o "126.5")
function parseDecimal(val) {
    if (val === "" || val === null || val === undefined) return 0;
    const normalized = String(val).trim().replace(/,/g, ".");
    const n = parseFloat(normalized);
    return isNaN(n) ? 0 : n;
}

export default function FinanzasDetalle() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [resumen, setResumen] = useState(null);
    const [pagos, setPagos] = useState([]);
    const [descuento, setDescuento] = useState(0); // Porcentaje de descuento
    const [grupoDetalle, setGrupoDetalle] = useState(null); // Para el modal de detalle del grupo
    const [loadingDetalle, setLoadingDetalle] = useState(false);
    const [pagantesFinalesForm, setPagantesFinalesForm] = useState({});

    const [preciosMensuales, setPreciosMensuales] = useState([]);
    const [nuevoMensualForm, setNuevoMensualForm] = useState({
        servicio: "parque_con_comida",
        mes: 10,
        precio: 0
    });

    const SERVICIOS_MAP = {
        "parque": "Parque (General)",
        "parque_con_comida": "Parque con Comida",
        "parque_sin_comida": "Parque sin Comida",
        "campamento": "Campamento Americano (General)",
        "campamento_con_comida": "Campamento Americano con Comida",
        "campamento_sin_comida": "Campamento Americano sin Comida",
        "zacarias": "Zacarias (General)",
        "zacarias_con_comida": "Zacarias con Comida",
        "zacarias_sin_comida": "Zacarias sin Comida",
        "pool": "Pool (General)",
        "pool_con_comida": "Pool con Comida",
        "pool_sin_comida": "Pool sin Comida",
        "disco": "Discoteca",
        "disco_opcional": "Noche Opcional (Discoteca)",
        "cena": "Cena de velas",
        "hielo": "Bar de hielo",
        "surf": "Surf",
        "unipraias": "Parque Unipraias",
        "beto": "Beto Carrero",
        "barco": "Barco Pirata",
        "cristo": "Cristo Luz",
        "sunset": "Sunset",
        "quinta_comida": "Quinta Comida",
        "multiparque": "Multiparque",
        "combo": "Combo",
        "almuerzo": "Almuerzo en Restaurante",
        "cena_restaurante": "Cena en Restaurante"
    };

    const MESES = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    // Form para configuración
    const [configForm, setConfigForm] = useState({
        moneda: "USD",
        moneda_liquidacion: "USD",
        tasa_cambio: 5.3,
        servicios_monedas: "{}",
        precio_disco_individual: 0,
        precio_disco_opcional: 0,
        precio_parque_individual: 0,
        precio_parque_con_comida: 0,
        precio_parque_sin_comida: 0,
        precio_campamento_individual: 0,
        precio_campamento_con_comida: 0,
        precio_campamento_sin_comida: 0,
        precio_zacarias_individual: 0,
        precio_zacarias_con_comida: 0,
        precio_zacarias_sin_comida: 0,
        precio_pool_individual: 0,
        precio_pool_con_comida: 0,
        precio_pool_sin_comida: 0,
        precio_cena_velas: 0,
        precio_bar_hielo: 0,
        precio_surf: 0,
        precio_unipraias: 0,
        precio_beto: 0,
        precio_barco: 0,
        precio_cristo: 0,
        precio_sunset: 0,
        precio_quinta_comida: 0,
        precio_multiparque: 0,
        es_combo: false,
        precio_combo: 0,
        combo_discos: 0,
        combo_parque: false,
        combo_pool: false,
        combo_cena_velas: false,
        combo_bar_hielo: false,
        combo_surf: false,
        combo_unipraias: false,
        combo_beto: false,
        combo_barco: false,
        combo_cristo: false,
        combo_sunset: false,
        combo_quinta_comida: false,
        combo_multiparque: false,
        precio_almuerzo: 0,
        precio_cena: 0,

        disco_liberados_ratio: 0,
        disco_padres_gratis: false,
        disco_guias_gratis: false,
        parque_liberados_ratio: 0,
        parque_padres_gratis: false,
        parque_guias_gratis: false,
        campamento_liberados_ratio: 0,
        campamento_padres_gratis: false,
        campamento_guias_gratis: false,
        zacarias_liberados_ratio: 0,
        zacarias_padres_gratis: false,
        zacarias_guias_gratis: false,
        pool_liberados_ratio: 0,
        pool_padres_gratis: false,
        pool_guias_gratis: false,
    });

    const [pagoForm, setPagoForm] = useState({
        monto: 0,
        moneda: "USD",
        tasa_cambio: 5.3,
        fecha: new Date().toLocaleDateString('en-CA'),
        metodo: "Transferencia",
        nota: "",
    });

    const getServicioMoneda = (sKey) => {
        try {
            const map = typeof configForm.servicios_monedas === "string" 
                ? JSON.parse(configForm.servicios_monedas || "{}") 
                : (configForm.servicios_monedas || {});
            return map[sKey] || configForm.moneda_liquidacion || "USD";
        } catch {
            return configForm.moneda_liquidacion || "USD";
        }
    };

    const setServicioMoneda = (sKey, nuevaMoneda) => {
        try {
            const map = typeof configForm.servicios_monedas === "string" 
                ? JSON.parse(configForm.servicios_monedas || "{}") 
                : { ...(configForm.servicios_monedas || {}) };
            map[sKey] = nuevaMoneda;
            setConfigForm(prev => ({
                ...prev,
                servicios_monedas: JSON.stringify(map)
            }));
        } catch (e) {
            console.error("Error setting servicio moneda", e);
        }
    };

    // Componente reutilizable para definir el precio de un servicio con selector de moneda USD / BRL
    const PrecioInput = ({ label, servicioKey, valueKey, extraContent = null, highlight = false }) => {
        const monedaActual = getServicioMoneda(servicioKey);
        const tasa = Number(configForm.tasa_cambio) > 0 ? Number(configForm.tasa_cambio) : 5.3;
        const precioValor = Number(configForm[valueKey]) || 0;
        
        let conversionInfo = null;
        if (precioValor > 0) {
            if (monedaActual === "BRL") {
                conversionInfo = `≈ US$ ${(precioValor / tasa).toFixed(2)}`;
            } else if (monedaActual === "USD") {
                conversionInfo = `≈ R$ ${(precioValor * tasa).toFixed(2)}`;
            }
        }

        return (
            <div style={{
                padding: highlight ? 12 : 10,
                background: highlight ? "#fef9c3" : "#f8fafc",
                borderRadius: 8,
                border: highlight ? "1px solid #fde68a" : "1px solid #e2e8f0",
                display: "flex",
                flexDirection: "column",
                gap: 6
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: 600, color: highlight ? "#854d0e" : "#475569" }}>
                        {label}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <button
                            type="button"
                            onClick={() => setServicioMoneda(servicioKey, "USD")}
                            style={{
                                padding: "2px 7px",
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                borderRadius: 4,
                                border: "1px solid",
                                borderColor: monedaActual === "USD" ? "#2563eb" : "#cbd5e1",
                                background: monedaActual === "USD" ? "#2563eb" : "#ffffff",
                                color: monedaActual === "USD" ? "#ffffff" : "#64748b",
                                cursor: "pointer"
                            }}
                        >
                            USD
                        </button>
                        <button
                            type="button"
                            onClick={() => setServicioMoneda(servicioKey, "BRL")}
                            style={{
                                padding: "2px 7px",
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                borderRadius: 4,
                                border: "1px solid",
                                borderColor: monedaActual === "BRL" ? "#16a34a" : "#cbd5e1",
                                background: monedaActual === "BRL" ? "#16a34a" : "#ffffff",
                                color: monedaActual === "BRL" ? "#ffffff" : "#64748b",
                                cursor: "pointer"
                            }}
                        >
                            BRL (R$)
                        </button>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: monedaActual === "BRL" ? "#16a34a" : "#2563eb", minWidth: 32 }}>
                        {monedaActual === "BRL" ? "R$" : "US$"}
                    </span>
                    <input
                        type="text"
                        inputMode="decimal"
                        value={configForm[valueKey] ?? 0}
                        onChange={e => setConfigForm({ ...configForm, [valueKey]: parseDecimal(e.target.value) })}
                        style={{
                            width: "100%",
                            padding: "6px 8px",
                            borderRadius: 6,
                            border: highlight ? "1px solid #facc15" : "1px solid #cbd5e1",
                            background: "white",
                            fontSize: "0.9rem"
                        }}
                    />
                </div>

                {conversionInfo && (
                    <span style={{ fontSize: "0.72rem", color: "#64748b", textAlign: "right" }}>
                        {conversionInfo} (tasa {tasa})
                    </span>
                )}

                {extraContent}
            </div>
        );
    };

    // Componente helper para inputs de liberados
    const LiberadosInputs = ({ prefix, label }) => (
        <div style={{ padding: "8px 10px", background: "#f1f5f9", borderRadius: 8, marginTop: 5 }}>
            <p style={{ margin: "0 0 4px 0", fontSize: "0.7rem", fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>Liberados {label}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ fontSize: "0.75rem" }}>Ratio:</span>
                    <input
                        type="text" inputMode="decimal"
                        placeholder="Ratio"
                        value={configForm[`${prefix}_liberados_ratio`]}
                        onChange={e => setConfigForm({ ...configForm, [`${prefix}_liberados_ratio`]: parseDecimal(e.target.value) })}
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
            const cfg = resR.data.config || {};
            const normalizedMoneda = cfg.moneda === "ARS" ? "USD" : (cfg.moneda || "USD");
            const normalizedMonedaLiq = cfg.moneda_liquidacion === "ARS" ? "USD" : (cfg.moneda_liquidacion || normalizedMoneda);
            const tasaDef = cfg.tasa_cambio ? Number(cfg.tasa_cambio) : 5.3;
            setConfigForm({
                ...cfg,
                moneda: normalizedMoneda,
                moneda_liquidacion: normalizedMonedaLiq,
                tasa_cambio: tasaDef,
                servicios_monedas: cfg.servicios_monedas || "{}"
            });

            setPagoForm(prev => ({
                ...prev,
                tasa_cambio: tasaDef
            }));

            const resP = await api.get(`/finanzas/pagos/${id}`);
            setPagos(resP.data);

            const resM = await api.get(`/finanzas/config/${id}/mensuales`);
            setPreciosMensuales(resM.data);

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

    useEffect(() => {
        if (!resumen || !resumen.grupos) return;
        const next = {};
        resumen.grupos.forEach((g) => {
            next[g.id] = g.pagantes_finales_servicios || {};
        });
        setPagantesFinalesForm(next);
    }, [resumen]);

    async function guardarConfig() {
        await api.post("/finanzas/config", {
            ...configForm,
            empresa_id: Number(id),
            tasa_cambio: Number(configForm.tasa_cambio) || 5.3,
            moneda_liquidacion: configForm.moneda_liquidacion || "USD",
            moneda: configForm.moneda_liquidacion || configForm.moneda || "USD"
        });
        alert("Configuración de precios y monedas guardada con éxito");
        cargarTodo();
    }

    async function guardarPrecioMensual(e) {
        e.preventDefault();
        try {
            await api.post(`/finanzas/config/mensuales?empresa_id=${id}`, nuevoMensualForm);
            alert("Precio mensual guardado");
            cargarTodo();
        } catch (err) {
            console.error(err);
            alert("Error al guardar precio mensual: " + (err.response?.data?.detail || err.message));
        }
    }

    async function eliminarPrecioMensual(overrideId) {
        if (!window.confirm("¿Eliminar este precio mensual?")) return;
        try {
            await api.delete(`/finanzas/config/mensuales/${overrideId}`);
            alert("Precio mensual eliminado");
            cargarTodo();
        } catch (err) {
            console.error(err);
            alert("Error al eliminar precio mensual: " + (err.response?.data?.detail || err.message));
        }
    }

    async function registrarPago(e) {
        e.preventDefault();
        const tasa = Number(pagoForm.tasa_cambio) > 0 ? Number(pagoForm.tasa_cambio) : (Number(configForm.tasa_cambio) || 5.3);
        await api.post("/finanzas/pagos", {
            ...pagoForm,
            empresa_id: Number(id),
            tasa_cambio: tasa
        });
        setPagoForm({
            monto: 0,
            moneda: "USD",
            tasa_cambio: tasa,
            fecha: new Date().toLocaleDateString('en-CA'),
            metodo: "Transferencia",
            nota: ""
        });
        alert("Pago registrado con éxito");
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

    async function guardarPagantesFinales(grupoId, servicioKey) {
        const rawValue = pagantesFinalesForm[grupoId]?.[servicioKey];
        const value = rawValue === "" || rawValue === null || typeof rawValue === "undefined" ? null : Number(rawValue);

        if (value !== null && Number.isNaN(value)) {
            alert("Ingresá un número válido para los pagantes finales");
            return;
        }

        await api.put(`/finanzas/grupo/${grupoId}/pagantes`, { pagantes_finales: value, servicio: servicioKey });
        alert("Pagantes finales actualizados");
        cargarTodo();
    }

    const formatMoney = (val, monedaEspecífica) => {
        const monedaRaw = monedaEspecífica || (resumen && resumen.moneda_liquidacion) || (configForm && configForm.moneda_liquidacion) || (configForm && configForm.moneda) || "USD";
        const moneda = (monedaRaw === "ARS" || !monedaRaw) ? "USD" : monedaRaw;
        return new Intl.NumberFormat("es-AR", { 
            style: "currency", 
            currency: moneda, 
            minimumFractionDigits: 2,
            maximumFractionDigits: 2 
        }).format(val || 0);
    };

    if (!resumen) return <div style={{ padding: 40 }}>Cargando datos...</div>;

    const tasaEmpresa = (resumen && Number(resumen.tasa_cambio) > 0) ? Number(resumen.tasa_cambio) : (Number(configForm.tasa_cambio) > 0 ? Number(configForm.tasa_cambio) : 5.3);
    const totalConDescuento = (resumen?.total_venta || 0) * (1 - descuento / 100);
    const saldoFinal = totalConDescuento - (resumen?.total_pagado || 0);

    return (
        <div style={{ padding: "40px 20px", maxWidth: "1050px" }}>
            <button
                onClick={() => navigate("/finanzas")}
                style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontWeight: 700, marginBottom: 20 }}
            >
                ← Volver al Dashboard
            </button>

            <h1 style={{ color: "#1e293b", marginBottom: 25 }}>Finanzas: <span style={{ color: "#2563eb" }}>{resumen.empresa}</span></h1>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 30, marginBottom: 40 }}>
                {/* CONFIGURACIÓN DE PRECIOS */}
                <div style={{ background: "white", padding: 25, borderRadius: 12, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
                    <h3 style={{ marginTop: 0, marginBottom: 15 }}>⚙️ Configuración de Precios y Monedas</h3>
                    
                    {/* PANEL DE MONEDA BASE Y TASA DE CAMBIO */}
                    <div style={{ padding: 14, background: "#f1f5f9", borderRadius: 10, border: "1px solid #cbd5e1", marginBottom: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <div>
                                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                                    Moneda de Liquidación:
                                </span>
                                <select 
                                    value={configForm.moneda_liquidacion || configForm.moneda || "USD"} 
                                    onChange={e => setConfigForm({ ...configForm, moneda_liquidacion: e.target.value, moneda: e.target.value })}
                                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #cbd5e1", background: "white", fontWeight: 700, fontSize: "0.85rem" }}
                                >
                                    <option value="USD">USD (Dólares US$)</option>
                                    <option value="BRL">BRL (Reales R$)</option>
                                </select>
                                <small style={{ fontSize: "0.7rem", color: "#64748b", display: "block", marginTop: 2 }}>
                                    Moneda del balance consolidado final.
                                </small>
                            </div>

                            <div>
                                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                                    💱 Tasa de Cambio Pactada:
                                </span>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#2563eb" }}>1 USD =</span>
                                    <input
                                        type="text" inputMode="decimal"
                                        value={configForm.tasa_cambio ?? 5.3}
                                        onChange={e => setConfigForm({ ...configForm, tasa_cambio: parseDecimal(e.target.value) })}
                                        placeholder="5.30"
                                        style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #2563eb", background: "white", fontWeight: 800, color: "#1e40af", fontSize: "0.95rem" }}
                                    />
                                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#16a34a" }}>BRL</span>
                                </div>
                                <small style={{ fontSize: "0.7rem", color: "#64748b", display: "block", marginTop: 2 }}>
                                    Convierte servicios y pagos en Reales.
                                </small>
                            </div>
                        </div>

                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", color: "#1e293b" }}>
                            <input
                                type="checkbox"
                                checked={configForm.es_combo}
                                onChange={e => setConfigForm({ ...configForm, es_combo: e.target.checked })}
                            />
                            Manejar servicios principales por paquete COMBO
                        </label>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                        {!configForm.es_combo ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <PrecioInput
                                    label="Discoteca Individual"
                                    servicioKey="disco"
                                    valueKey="precio_disco_individual"
                                    extraContent={<LiberadosInputs prefix="disco" label="Disco" />}
                                />

                                <PrecioInput
                                    label="🌟 Noche Opcional (Discoteca)"
                                    servicioKey="disco_opcional"
                                    valueKey="precio_disco_opcional"
                                    highlight={true}
                                />

                                {/* Parque */}
                                <div style={{ padding: 12, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                                    <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#334155", display: "block", marginBottom: 8 }}>
                                        🎡 Parque Acuático
                                    </span>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                        <PrecioInput
                                            label="Con Comida"
                                            servicioKey="parque_con_comida"
                                            valueKey="precio_parque_con_comida"
                                        />
                                        <PrecioInput
                                            label="Sin Comida"
                                            servicioKey="parque_sin_comida"
                                            valueKey="precio_parque_sin_comida"
                                        />
                                    </div>
                                    <LiberadosInputs prefix="parque" label="Parque" />
                                </div>

                                {/* Campamento */}
                                <div style={{ padding: 12, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                                    <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#334155", display: "block", marginBottom: 8 }}>
                                        🏕️ Campamento Americano
                                    </span>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                        <PrecioInput
                                            label="Con Comida"
                                            servicioKey="campamento_con_comida"
                                            valueKey="precio_campamento_con_comida"
                                        />
                                        <PrecioInput
                                            label="Sin Comida"
                                            servicioKey="campamento_sin_comida"
                                            valueKey="precio_campamento_sin_comida"
                                        />
                                    </div>
                                    <LiberadosInputs prefix="campamento" label="Campamento" />
                                </div>

                                {/* Zacarias */}
                                <div style={{ padding: 12, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                                    <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#334155", display: "block", marginBottom: 8 }}>
                                        🌲 Zacarias
                                    </span>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                        <PrecioInput
                                            label="Con Comida"
                                            servicioKey="zacarias_con_comida"
                                            valueKey="precio_zacarias_con_comida"
                                        />
                                        <PrecioInput
                                            label="Sin Comida"
                                            servicioKey="zacarias_sin_comida"
                                            valueKey="precio_zacarias_sin_comida"
                                        />
                                    </div>
                                    <LiberadosInputs prefix="zacarias" label="Zacarias" />
                                </div>

                                {/* Pool / Water */}
                                <div style={{ padding: 12, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                                    <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#334155", display: "block", marginBottom: 8 }}>
                                        🏊 Pool / Water Park
                                    </span>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                        <PrecioInput
                                            label="Con Comida"
                                            servicioKey="pool_con_comida"
                                            valueKey="precio_pool_con_comida"
                                        />
                                        <PrecioInput
                                            label="Sin Comida"
                                            servicioKey="pool_sin_comida"
                                            valueKey="precio_pool_sin_comida"
                                        />
                                    </div>
                                    <LiberadosInputs prefix="pool" label="Pool" />
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                    <PrecioInput
                                        label="Cena de Velas"
                                        servicioKey="cena"
                                        valueKey="precio_cena_velas"
                                    />
                                    <PrecioInput
                                        label="Bar de Hielo"
                                        servicioKey="hielo"
                                        valueKey="precio_bar_hielo"
                                    />
                                </div>

                                {/* Almuerzos y Cenas */}
                                <div style={{ padding: 12, background: "#fef3c7", borderRadius: 8, border: "1px solid #fde68a" }}>
                                    <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#92400e", display: "block", marginBottom: 8 }}>
                                        🍽️ Almuerzos y Cenas (Restaurantes)
                                    </span>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                        <PrecioInput
                                            label="Almuerzo / pax"
                                            servicioKey="almuerzo"
                                            valueKey="precio_almuerzo"
                                        />
                                        <PrecioInput
                                            label="Cena / pax"
                                            servicioKey="cena_restaurante"
                                            valueKey="precio_cena"
                                        />
                                    </div>
                                </div>

                                {/* Actividades adicionales */}
                                <div style={{ padding: 12, background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0" }}>
                                    <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#166534", display: "block", marginBottom: 8 }}>
                                        🏄 Paseos y Actividades Adicionales
                                    </span>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                        <PrecioInput label="Surf" servicioKey="surf" valueKey="precio_surf" />
                                        <PrecioInput label="Parque Unipraias" servicioKey="unipraias" valueKey="precio_unipraias" />
                                        <PrecioInput label="Beto Carrero" servicioKey="beto" valueKey="precio_beto" />
                                        <PrecioInput label="Barco Pirata" servicioKey="barco" valueKey="precio_barco" />
                                        <PrecioInput label="Cristo Luz" servicioKey="cristo" valueKey="precio_cristo" />
                                        <PrecioInput label="Sunset" servicioKey="sunset" valueKey="precio_sunset" />
                                        <PrecioInput label="Quinta Comida" servicioKey="quinta_comida" valueKey="precio_quinta_comida" />
                                        <PrecioInput label="Multiparque" servicioKey="multiparque" valueKey="precio_multiparque" />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ padding: 15, background: "#f0fdf4", borderRadius: 8, display: "flex", flexDirection: "column", gap: 12 }}>
                                <PrecioInput
                                    label="Precio Total del Combo"
                                    servicioKey="combo"
                                    valueKey="precio_combo"
                                />

                                <div style={{ display: "flex", gap: 15, fontSize: "0.85rem", flexWrap: "wrap", padding: 10, background: "white", borderRadius: 6, border: "1px solid #bbf7d0" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>Cant. Discos:</span>
                                        <input
                                            type="text" inputMode="decimal"
                                            value={configForm.combo_discos}
                                            onChange={e => setConfigForm({ ...configForm, combo_discos: parseDecimal(e.target.value) })}
                                            style={{ width: 60, padding: 4, borderRadius: 4, border: "1px solid #cbd5e1" }}
                                        />
                                    </div>
                                    <label><input type="checkbox" checked={configForm.combo_parque} onChange={e => setConfigForm({ ...configForm, combo_parque: e.target.checked })} /> Parque</label>
                                    <label><input type="checkbox" checked={configForm.combo_pool} onChange={e => setConfigForm({ ...configForm, combo_pool: e.target.checked })} /> Pool</label>
                                    <label><input type="checkbox" checked={configForm.combo_cena_velas} onChange={e => setConfigForm({ ...configForm, combo_cena_velas: e.target.checked })} /> Cena</label>
                                    <label><input type="checkbox" checked={configForm.combo_bar_hielo} onChange={e => setConfigForm({ ...configForm, combo_bar_hielo: e.target.checked })} /> Bar hielo</label>
                                    <label><input type="checkbox" checked={configForm.combo_surf} onChange={e => setConfigForm({ ...configForm, combo_surf: e.target.checked })} /> Surf</label>
                                    <label><input type="checkbox" checked={configForm.combo_unipraias} onChange={e => setConfigForm({ ...configForm, combo_unipraias: e.target.checked })} /> Unipraias</label>
                                    <label><input type="checkbox" checked={configForm.combo_beto} onChange={e => setConfigForm({ ...configForm, combo_beto: e.target.checked })} /> Beto Carrero</label>
                                    <label><input type="checkbox" checked={configForm.combo_barco} onChange={e => setConfigForm({ ...configForm, combo_barco: e.target.checked })} /> Barco Pirata</label>
                                    <label><input type="checkbox" checked={configForm.combo_cristo} onChange={e => setConfigForm({ ...configForm, combo_cristo: e.target.checked })} /> Cristo Luz</label>
                                    <label><input type="checkbox" checked={configForm.combo_sunset} onChange={e => setConfigForm({ ...configForm, combo_sunset: e.target.checked })} /> Sunset</label>
                                    <label><input type="checkbox" checked={configForm.combo_quinta_comida || false} onChange={e => setConfigForm({ ...configForm, combo_quinta_comida: e.target.checked })} /> 5ta Comida</label>
                                    <label><input type="checkbox" checked={configForm.combo_multiparque || false} onChange={e => setConfigForm({ ...configForm, combo_multiparque: e.target.checked })} /> Multiparque</label>
                                </div>
                                <LiberadosInputs prefix="disco" label="Combo (Basado en Disco)" />

                                <PrecioInput
                                    label="🌟 Precio Noche Opcional (Fuera de Combo)"
                                    servicioKey="disco_opcional"
                                    valueKey="precio_disco_opcional"
                                    highlight={true}
                                />
                            </div>
                        )}

                        <button onClick={guardarConfig} style={{ padding: 12, background: "#1e293b", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: "0.95rem" }}>
                            💾 Guardar Configuración de Precios y Monedas
                        </button>
                    </div>
                </div>

                {/* CONFIGURACIÓN DE PRECIOS MENSUALES */}
                <div style={{ background: "white", padding: 25, borderRadius: 12, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", gridColumn: "span 2" }}>
                    <h3 style={{ marginTop: 0, marginBottom: 20 }}>📅 Precios Especiales por Mes</h3>
                    
                    {preciosMensuales.length === 0 ? (
                        <p style={{ color: "#64748b", fontSize: "0.85rem", fontStyle: "italic" }}>No hay precios mensuales configurados para esta empresa. Se usarán los precios generales.</p>
                    ) : (
                        <div style={{ overflowX: "auto", marginBottom: 20 }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
                                <thead>
                                    <tr style={{ background: "#f8fafc" }}>
                                        <th style={{ padding: "8px 12px", borderBottom: "1px solid #cbd5e1" }}>Servicio</th>
                                        <th style={{ padding: "8px 12px", borderBottom: "1px solid #cbd5e1" }}>Mes</th>
                                        <th style={{ padding: "8px 12px", borderBottom: "1px solid #cbd5e1" }}>Precio Especial</th>
                                        <th style={{ padding: "8px 12px", borderBottom: "1px solid #cbd5e1", textAlign: "right" }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {preciosMensuales.map(pm => (
                                        <tr key={pm.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                            <td style={{ padding: "8px 12px", fontWeight: 600 }}>{SERVICIOS_MAP[pm.servicio] || pm.servicio}</td>
                                            <td style={{ padding: "8px 12px" }}>{MESES[pm.mes - 1]}</td>
                                            <td style={{ padding: "8px 12px", color: "#2563eb", fontWeight: 700 }}>{formatMoney(pm.precio)}</td>
                                            <td style={{ padding: "8px 12px", textAlign: "right" }}>
                                                <button 
                                                    onClick={() => eliminarPrecioMensual(pm.id)}
                                                    style={{ padding: "3px 8px", background: "#ef4444", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.75rem" }}
                                                >
                                                    Eliminar
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <form onSubmit={guardarPrecioMensual} style={{ display: "flex", gap: 10, alignItems: "flex-end", background: "#f8fafc", padding: 15, borderRadius: 8, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1, minWidth: 150 }}>
                            <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>Servicio</span>
                            <select 
                                value={nuevoMensualForm.servicio}
                                onChange={e => setNuevoMensualForm({ ...nuevoMensualForm, servicio: e.target.value })}
                                style={{ padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", background: "white" }}
                            >
                                {Object.entries(SERVICIOS_MAP).map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, width: 120 }}>
                            <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>Mes</span>
                            <select 
                                value={nuevoMensualForm.mes}
                                onChange={e => setNuevoMensualForm({ ...nuevoMensualForm, mes: parseDecimal(e.target.value) })}
                                style={{ padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", background: "white" }}
                            >
                                {MESES.map((nombre, idx) => (
                                    <option key={idx} value={idx + 1}>{nombre}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, width: 120 }}>
                            <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>Precio</span>
                            <input 
                                type="text" inputMode="decimal"
                                min="0"
                                value={nuevoMensualForm.precio || ""}
                                onChange={e => setNuevoMensualForm({ ...nuevoMensualForm, precio: parseDecimal(e.target.value) })}
                                placeholder="Precio"
                                required
                                style={{ padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
                            />
                        </div>
                        <button 
                            type="submit"
                            style={{ padding: "9px 15px", background: "#2563eb", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700, height: 36 }}
                        >
                            Agregar Precio Especial
                        </button>
                    </form>
                </div>

                {/* REGISTRO DE PAGOS */}
                <div style={{ background: "white", padding: 25, borderRadius: 12, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
                    <h3 style={{ marginTop: 0, marginBottom: 15 }}>💸 Registrar Pago</h3>
                    <form onSubmit={registrarPago} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 10 }}>
                            <div>
                                <label style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700, display: "block", marginBottom: 4 }}>
                                    Monto Recibido:
                                </label>
                                <input
                                    type="text" inputMode="decimal"
                                    placeholder="0.00"
                                    value={pagoForm.monto || ""}
                                    onChange={e => setPagoForm({ ...pagoForm, monto: parseDecimal(e.target.value) })}
                                    required
                                    style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #cbd5e1", boxSizing: "border-box", fontWeight: 700, fontSize: "1rem" }}
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700, display: "block", marginBottom: 4 }}>
                                    Moneda del Pago:
                                </label>
                                <select
                                    value={pagoForm.moneda || "USD"}
                                    onChange={e => setPagoForm({ ...pagoForm, moneda: e.target.value })}
                                    style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #cbd5e1", boxSizing: "border-box", background: "white", fontWeight: 700 }}
                                >
                                    <option value="USD">USD (US$ Dólares)</option>
                                    <option value="BRL">BRL (R$ Reales)</option>
                                </select>
                            </div>
                        </div>

                        {pagoForm.moneda === "BRL" && (
                            <div style={{ padding: 10, background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                                    <label style={{ fontSize: "0.78rem", color: "#166534", fontWeight: 700 }}>
                                        Tasa de cambio para este pago:
                                    </label>
                                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                        <span style={{ fontSize: "0.75rem", color: "#166534" }}>1 USD =</span>
                                        <input
                                            type="text" inputMode="decimal"
                                            value={pagoForm.tasa_cambio ?? tasaEmpresa}
                                            onChange={e => setPagoForm({ ...pagoForm, tasa_cambio: parseDecimal(e.target.value) })}
                                            style={{ width: 65, padding: "4px 6px", borderRadius: 4, border: "1px solid #86efac", fontWeight: 700, textAlign: "center" }}
                                        />
                                    </div>
                                </div>
                                {Number(pagoForm.monto) > 0 && (
                                    <div style={{ marginTop: 6, fontSize: "0.85rem", color: "#15803d", fontWeight: 700 }}>
                                        💰 Cierra la cuenta como: US$ {(Number(pagoForm.monto) / (Number(pagoForm.tasa_cambio) > 0 ? Number(pagoForm.tasa_cambio) : tasaEmpresa)).toFixed(2)}
                                    </div>
                                )}
                            </div>
                        )}

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            <div>
                                <label style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700, display: "block", marginBottom: 4 }}>
                                    Fecha:
                                </label>
                                <input
                                    type="date"
                                    value={pagoForm.fecha}
                                    onChange={e => setPagoForm({ ...pagoForm, fecha: e.target.value })}
                                    required
                                    style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700, display: "block", marginBottom: 4 }}>
                                    Método:
                                </label>
                                <select
                                    value={pagoForm.metodo}
                                    onChange={e => setPagoForm({ ...pagoForm, metodo: e.target.value })}
                                    style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #cbd5e1", boxSizing: "border-box", background: "white" }}
                                >
                                    <option>Transferencia</option>
                                    <option>Pix</option>
                                    <option>Efectivo</option>
                                    <option>Cheque</option>
                                </select>
                            </div>
                        </div>

                        <input
                            type="text"
                            placeholder="Nota / Observación (ej: Depósito bancario, seña, etc.)"
                            value={pagoForm.nota}
                            onChange={e => setPagoForm({ ...pagoForm, nota: e.target.value })}
                            style={{ padding: 10, borderRadius: 6, border: "1px solid #cbd5e1" }}
                        />
                        <button type="submit" style={{ padding: 12, background: "#059669", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: "0.95rem" }}>
                            ✅ Confirmar y Acreditar Pago
                        </button>
                    </form>
                </div>
            </div>

            {/* RESUMEN FINANCIERO */}
            <div id="finance-report" style={{ background: "white", padding: 30, borderRadius: 12, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", marginBottom: 40 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <h3 style={{ margin: 0 }}>📊 Resumen de Servicios por Grupo</h3>
                    <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={() => window.print()} style={{ padding: "8px 15px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer", fontSize: "0.85rem" }}>🖨️ Imprimir</button>
                        <button
                            onClick={() => window.open(`${BASE_URL}/excel/finanzas/${id}`, "_blank")}
                            style={{ padding: "8px 15px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer", fontSize: "0.85rem" }}
                        >
                            📄 Excel
                        </button>
                        <button
                            onClick={() => window.open(`/imprimir-vouchers-empresa/${id}`, "_blank")}
                            style={{ padding: "8px 15px", background: "#334155", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}
                        >
                            🖨️ Vouchers (Toda la Empresa)
                        </button>
                        <button
                            onClick={() => window.open(`/declaracion-jurada/${id}`, "_blank")}
                            style={{ padding: "8px 15px", background: "#7c3aed", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}
                        >
                            📄 Declaración Jurada
                        </button>
                    </div>
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                            <th style={{ padding: 12, borderBottom: "2px solid #e2e8f0" }}>Grupo</th>
                            <th style={{ padding: 12, borderBottom: "2px solid #e2e8f0" }}>PAX</th>
                            <th style={{ padding: 12, borderBottom: "2px solid #e2e8f0" }}>Servicios y Precio Unitario</th>
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
                                    <td style={{ padding: 12, textAlign: "right", fontWeight: 800, color: "#1e293b" }}>{formatMoney(g.subtotal)}</td>
                                </tr>
                                {g.servicios.map((s, idx) => {
                                    const esBRL = s.moneda === "BRL";
                                    return (
                                        <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9", fontSize: "0.85rem" }}>
                                            <td style={{ padding: "8px 12px", paddingLeft: 30 }}>
                                                <span style={{
                                                    padding: "2px 6px",
                                                    borderRadius: 4,
                                                    fontSize: "0.7rem",
                                                    fontWeight: 700,
                                                    marginRight: 6,
                                                    background: esBRL ? "#dcfce7" : "#dbeafe",
                                                    color: esBRL ? "#15803d" : "#1d4ed8"
                                                }}>
                                                    {esBRL ? "R$" : "US$"}
                                                </span>
                                                <strong>{s.servicio}</strong>
                                            </td>
                                            <td style={{ padding: "8px 12px" }}>{s.descripcion}</td>
                                            <td style={{ padding: "8px 12px", color: "#64748b" }}>
                                                <span style={{ fontWeight: 700, color: esBRL ? "#15803d" : "#1d4ed8" }}>
                                                    {formatMoney(s.precio_u, s.moneda)}
                                                </span> x {s.cantidad} (Cant)
                                                {(() => {
                                                    if (!g.fecha_entrada) return null;
                                                    const parts = g.fecha_entrada.split("-");
                                                    if (parts.length < 2) return null;
                                                    const mesNum = Number(parts[1]);
                                                    let matchingKey = s.servicio_key;
                                                    const override = preciosMensuales.find(pm => {
                                                        if (pm.mes !== mesNum) return false;
                                                        if (pm.servicio === matchingKey) return true;
                                                        if (matchingKey.startsWith("parque") && pm.servicio === "parque") return true;
                                                        if (matchingKey.startsWith("pool") && pm.servicio === "pool") return true;
                                                        return false;
                                                    });
                                                    if (override) {
                                                        return <span style={{ marginLeft: 6, padding: "2px 6px", background: "#dbeafe", color: "#1e40af", borderRadius: 4, fontSize: "0.7rem", fontWeight: 700 }}>Especial {MESES[mesNum - 1]}</span>;
                                                    }
                                                    return null;
                                                })()} x
                                                <b style={{ color: "#2563eb", marginLeft: 4 }}>{s.pax} Pagantes</b>
                                                <span style={{ fontSize: "0.75rem", marginLeft: 4 }}>/ Total: {s.pax_original}</span>

                                                {s.servicio_key && (
                                                    <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: "#475569" }}>
                                                            Pagantes finales:
                                                            <input
                                                                type="text" inputMode="decimal"
                                                                min="0"
                                                                value={pagantesFinalesForm[g.id]?.[s.servicio_key] ?? ""}
                                                                onChange={(e) => {
                                                                    const nextValue = e.target.value;
                                                                    setPagantesFinalesForm((prev) => ({
                                                                        ...prev,
                                                                        [g.id]: {
                                                                            ...(prev[g.id] || {}),
                                                                            [s.servicio_key]: nextValue
                                                                        }
                                                                    }));
                                                                }}
                                                                style={{ width: 80, padding: "3px 6px", borderRadius: 6, border: "1px solid #cbd5e1" }}
                                                            />
                                                        </label>
                                                        <button
                                                            onClick={() => guardarPagantesFinales(g.id, s.servicio_key)}
                                                            style={{ padding: "4px 10px", background: "#0f172a", color: "white", border: "none", borderRadius: 4, fontSize: "0.75rem", cursor: "pointer" }}
                                                        >
                                                            Guardar
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: "8px 12px", textAlign: "right" }}>
                                                {esBRL ? (
                                                    <div>
                                                        <div style={{ fontWeight: 700, color: "#166534" }}>
                                                            {formatMoney(s.subtotal_original || s.subtotal, "BRL")}
                                                        </div>
                                                        <div style={{ fontSize: "0.72rem", color: "#64748b" }}>
                                                            ≈ {formatMoney(s.subtotal, "USD")} (tasa {s.tasa_cambio || tasaEmpresa})
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <div style={{ fontWeight: 700, color: "#1e293b" }}>
                                                            {formatMoney(s.subtotal, "USD")}
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>

                {/* TARJETA DE CIERRE DE CUENTA Y LIQUIDACIÓN MULTIDIVISA */}
                <div style={{
                    marginTop: 30,
                    padding: 24,
                    background: "#f8fafc",
                    borderRadius: 12,
                    border: "1px solid #e2e8f0"
                }}>
                    <h4 style={{ margin: "0 0 16px 0", color: "#0f172a", fontSize: "1.05rem", fontWeight: 800 }}>
                        💱 Cierre y Liquidación de Finanzas de la Empresa
                    </h4>

                    {/* DESGLOSE POR MONEDAS */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 15, marginBottom: 20 }}>
                        <div style={{ background: "white", padding: 14, borderRadius: 8, border: "1px solid #cbd5e1" }}>
                            <span style={{ fontSize: "0.75rem", color: "#1e40af", fontWeight: 700, textTransform: "uppercase" }}>
                                💵 Facturación en Dólares
                            </span>
                            <p style={{ margin: "6px 0 0 0", fontSize: "1.25rem", fontWeight: 800, color: "#1d4ed8" }}>
                                {formatMoney(resumen.total_venta_usd, "USD")}
                            </p>
                            <span style={{ fontSize: "0.72rem", color: "#64748b" }}>Servicios cobrados en USD</span>
                        </div>

                        <div style={{ background: "white", padding: 14, borderRadius: 8, border: "1px solid #cbd5e1" }}>
                            <span style={{ fontSize: "0.75rem", color: "#15803d", fontWeight: 700, textTransform: "uppercase" }}>
                                🇧🇷 Facturación en Reales
                            </span>
                            <p style={{ margin: "6px 0 0 0", fontSize: "1.25rem", fontWeight: 800, color: "#15803d" }}>
                                {formatMoney(resumen.total_venta_brl, "BRL")}
                            </p>
                            <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                                ≈ {formatMoney((resumen.total_venta_brl || 0) / tasaEmpresa, "USD")} (tasa {tasaEmpresa})
                            </span>
                        </div>

                        <div style={{ background: "white", padding: 14, borderRadius: 8, border: "1px solid #cbd5e1" }}>
                            <span style={{ fontSize: "0.75rem", color: "#475569", fontWeight: 700, textTransform: "uppercase" }}>
                                🔄 Tasa de Cambio Pactada
                            </span>
                            <p style={{ margin: "6px 0 0 0", fontSize: "1.25rem", fontWeight: 800, color: "#0f172a" }}>
                                1 USD = {tasaEmpresa} BRL
                            </p>
                            <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                                Liquidación en: <strong>{resumen.moneda_liquidacion || "USD"}</strong>
                            </span>
                        </div>
                    </div>

                    <div style={{ borderTop: "1px solid #cbd5e1", paddingTop: 18, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
                            <span style={{ fontSize: "0.95rem", color: "#475569", fontWeight: 600 }}>Total Venta Consolidado:</span>
                            <span style={{ fontSize: "1.3rem", fontWeight: 700, color: "#0f172a" }}>{formatMoney(resumen.total_venta)}</span>
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
                                            fontSize: "0.75rem",
                                            fontWeight: d === descuento ? 700 : 400
                                        }}
                                    >
                                        {d}%
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 15, marginTop: 5 }}>
                            <span style={{ fontSize: "1.1rem", fontWeight: 700 }}>Total Contrato Final:</span>
                            <span style={{ fontSize: "1.8rem", fontWeight: 900, color: "#1e293b" }}>{formatMoney(totalConDescuento)}</span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 15, color: "#059669" }}>
                            <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>Total Cobrado / Pagos Recibidos:</span>
                            <span style={{ fontSize: "1.3rem", fontWeight: 800 }}>{formatMoney(resumen.total_pagado)}</span>
                        </div>
                        {(resumen.total_pagado_usd > 0 || resumen.total_pagado_brl > 0) && (
                            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                                (Cobrado en USD: {formatMoney(resumen.total_pagado_usd, "USD")} · Cobrado en BRL: {formatMoney(resumen.total_pagado_brl, "BRL")})
                            </div>
                        )}

                        <div style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                            background: saldoFinal > 0 ? "#fef2f2" : "#f0fdf4",
                            border: saldoFinal > 0 ? "1px solid #fecaca" : "1px solid #bbf7d0",
                            padding: "14px 24px",
                            borderRadius: 10,
                            marginTop: 10
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
                                <span style={{ fontSize: "1.15rem", fontWeight: 700, color: saldoFinal > 0 ? "#dc2626" : "#16a34a" }}>
                                    {saldoFinal > 0 ? "Saldo Pendiente a Cobrar:" : "Saldo a Favor de la Empresa:"}
                                </span>
                                <span style={{ fontSize: "1.9rem", fontWeight: 900, color: saldoFinal > 0 ? "#b91c1c" : "#15803d" }}>
                                    {formatMoney(Math.abs(saldoFinal))}
                                </span>
                            </div>
                            <span style={{ fontSize: "0.85rem", color: "#475569", marginTop: 4 }}>
                                Equivalente en Reales a tasa {tasaEmpresa}: <strong style={{ color: "#0f172a" }}>{formatMoney(Math.abs(saldoFinal) * tasaEmpresa, "BRL")}</strong>
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* LISTADO DE PAGOS */}
            <div style={{ background: "white", padding: 30, borderRadius: 12, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
                <h3 style={{ marginTop: 0, marginBottom: 20 }}>📑 Historial de Pagos</h3>
                {pagos.length === 0 ? (
                    <p style={{ color: "#94a3b8" }}>No hay pagos registrados para esta empresa.</p>
                ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                                <th style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>Fecha</th>
                                <th style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>Monto Recibido</th>
                                <th style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>Tasa Cambio</th>
                                <th style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>Equivalente Liquidado (USD)</th>
                                <th style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>Método</th>
                                <th style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>Nota</th>
                                <th style={{ padding: 12, borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pagos.map(p => {
                                const mPago = p.moneda || "USD";
                                const tPago = p.tasa_cambio || tasaEmpresa;
                                const conv = p.monto_convertido !== null && p.monto_convertido !== undefined
                                    ? p.monto_convertido
                                    : (mPago === "BRL" ? (p.monto / tPago) : p.monto);
                                return (
                                    <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                        <td style={{ padding: 12 }}>{p.fecha}</td>
                                        <td style={{ padding: 12, fontWeight: 700 }}>
                                            <span style={{
                                                padding: "2px 6px",
                                                borderRadius: 4,
                                                fontSize: "0.72rem",
                                                marginRight: 6,
                                                background: mPago === "BRL" ? "#dcfce7" : "#dbeafe",
                                                color: mPago === "BRL" ? "#15803d" : "#1d4ed8"
                                            }}>
                                                {mPago}
                                            </span>
                                            {formatMoney(p.monto, mPago)}
                                        </td>
                                        <td style={{ padding: 12, color: "#64748b", fontSize: "0.85rem" }}>
                                            {mPago === "BRL" ? `1 USD = ${tPago}` : "-"}
                                        </td>
                                        <td style={{ padding: 12, fontWeight: 700, color: "#059669" }}>
                                            {formatMoney(conv, "USD")}
                                        </td>
                                        <td style={{ padding: 12 }}>{p.metodo}</td>
                                        <td style={{ padding: 12, color: "#64748b", fontSize: "0.85rem" }}>{p.nota}</td>
                                        <td style={{ padding: 12, textAlign: "right" }}>
                                            <button onClick={() => eliminarPago(p.id)} style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Eliminar</button>
                                        </td>
                                    </tr>
                                );
                            })}
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
                                            onClick={() => window.open(a.es_comida ? `${BASE_URL}/vouchers/comida/${a.comida_id}` : `/imprimir-voucher/${a.id}`, "_blank")}
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

