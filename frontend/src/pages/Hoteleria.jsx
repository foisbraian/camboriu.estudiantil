import React, { useEffect, useState } from "react";
import api, { BASE_URL } from "../api";

export default function Hoteleria() {
    const [hoteles, setHoteles] = useState([]);
    const [selectedHotelId, setSelectedHotelId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [empresas, setEmpresas] = useState([]);
    const [reservas, setReservas] = useState([]);
    const [pagos, setPagos] = useState([]);

    const [activeTab, setActiveTab] = useState("reservas");

    // Modal States
    const [showHotelModal, setShowHotelModal] = useState(false);
    const [newHotelName, setNewHotelName] = useState("");

    const [showReservaModal, setShowReservaModal] = useState(false);
    const [reservaForm, setReservaForm] = useState({
        empresa_id: "", fecha_ingreso: "", fecha_salida: "",
        cant_single: 0, tarifa_single: 0,
        cant_doble: 0, tarifa_doble: 0,
        cant_triple: 0, tarifa_triple: 0,
        cant_cuadruple: 0, tarifa_cuadruple: 0,
        cant_quintuple: 0, tarifa_quintuple: 0
    });

    const [showPagoModal, setShowPagoModal] = useState(false);
    const [pagoForm, setPagoForm] = useState({
        empresa_id: "", reserva_id: "", monto: "", fecha: "", metodo: "Transferencia", nota: ""
    });

    const [liqEmpresaId, setLiqEmpresaId] = useState("");

    const fetchData = async () => {
        setLoading(true);
        try {
            const [hotRes, empRes, resRes, pagRes] = await Promise.all([
                api.get("/hoteleria/hoteles/"),
                api.get("/empresas/"),
                api.get("/hoteleria/reservas/"),
                api.get("/hoteleria/pagos/")
            ]);
            setHoteles(hotRes.data);
            setEmpresas(empRes.data);
            setReservas(resRes.data);
            setPagos(pagRes.data);

            if (hotRes.data.length > 0 && !selectedHotelId) {
                setSelectedHotelId(hotRes.data[0].id);
            }
            setError("");
        } catch (err) {
            setError("Error al cargar datos de hotelería.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCreateHotel = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post("/hoteleria/hoteles/", { nombre: newHotelName });
            setHoteles([...hoteles, res.data]);
            setSelectedHotelId(res.data.id);
            setShowHotelModal(false);
            setNewHotelName("");
        } catch (err) {
            alert(err.response?.data?.detail || "Error al crear hotel");
        }
    };

    const handleCreateReserva = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...reservaForm, hotel_id: selectedHotelId };
            await api.post("/hoteleria/reservas/", payload);
            // Re-fetch everything to get relations or update locally
            fetchData();
            setShowReservaModal(false);
        } catch (err) {
            alert(err.response?.data?.detail || "Error al crear reserva. Revisa las fechas.");
        }
    };

    const handleDeleteReserva = async (id) => {
        if (!window.confirm("¿Seguro que deseas eliminar esta reserva?")) return;
        try {
            await api.delete(`/hoteleria/reservas/${id}`);
            setReservas(reservas.filter(r => r.id !== id));
        } catch (err) {
            alert("Error al eliminar reserva");
        }
    };

    const handleCreatePago = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...pagoForm, hotel_id: selectedHotelId, reserva_id: pagoForm.reserva_id || null };
            await api.post("/hoteleria/pagos/", payload);
            // Re-fetch
            fetchData();
            setShowPagoModal(false);
        } catch (err) {
            alert(err.response?.data?.detail || "Error al registrar pago");
        }
    };

    const handleDownloadLiquidacion = () => {
        if (!liqEmpresaId) return alert("Selecciona una empresa");
        window.open(`${BASE_URL}/hoteleria/liquidacion/${selectedHotelId}/${liqEmpresaId}`, "_blank");
    };

    const selectedHotel = hoteles.find(h => h.id === selectedHotelId);
    const hotelReservas = reservas.filter(r => r.hotel_id === selectedHotelId);
    const hotelPagos = pagos.filter(p => p.hotel_id === selectedHotelId);
    const empresaReservas = hotelReservas.filter(r => String(r.empresa_id) === String(pagoForm.empresa_id));

    return (
        <div style={{ minHeight: "100%", padding: "30px 40px", background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 35%, #312e81 100%)", color: "white" }}>
            <section style={{ marginBottom: 30 }}>
                <p style={{ letterSpacing: "0.3em", fontSize: "0.75rem", textTransform: "uppercase", color: "rgba(248,250,252,0.7)" }}>Operaciones</p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h1 style={{ margin: 0, fontSize: "2.8rem", fontWeight: 800 }}>🏨 Hotelería</h1>
                    <button
                        onClick={() => setShowHotelModal(true)}
                        style={{ background: "#0ea5e9", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8, fontWeight: "bold", cursor: "pointer" }}>
                        + Nuevo Hotel
                    </button>
                </div>
            </section>

            <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 24, alignItems: "flex-start" }}>
                {/* SIDEBAR HOTELES */}
                <div style={{ background: "rgba(15,23,42,0.65)", borderRadius: 18, padding: 18, boxShadow: "0 20px 45px rgba(15,15,42,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <p style={{ margin: "0 0 12px 0", fontSize: "0.85rem", letterSpacing: "0.08em", color: "rgba(248,250,252,0.7)", textTransform: "uppercase" }}>Hoteles</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {loading && hoteles.length === 0 ? <p>Cargando...</p> : null}
                        {hoteles.map((hotel) => {
                            const isActive = selectedHotelId === hotel.id;
                            return (
                                <button
                                    key={hotel.id}
                                    onClick={() => setSelectedHotelId(hotel.id)}
                                    style={{
                                        textAlign: "left",
                                        padding: "14px 16px",
                                        borderRadius: 14,
                                        border: isActive ? `1px solid #a855f7` : "1px solid rgba(255,255,255,0.1)",
                                        background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                                        color: "white",
                                        cursor: "pointer",
                                        transition: "all 0.2s"
                                    }}
                                >
                                    <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{hotel.nombre}</div>
                                </button>
                            );
                        })}
                        {hoteles.length === 0 && !loading && <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>No hay hoteles creados.</span>}
                    </div>
                </div>

                {/* MAIN DASHBOARD */}
                <div style={{ background: "white", borderRadius: 28, boxShadow: "0 30px 80px rgba(15,23,42,0.25)", overflow: "hidden", color: "#1e293b", minHeight: "60vh" }}>
                    {error && <div style={{ padding: 20, background: "#fee2e2", color: "#b91c1c", fontWeight: 600 }}>{error}</div>}

                    {!selectedHotel ? (
                        <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>Selecciona o crea un hotel para comenzar.</div>
                    ) : (
                        <div>
                            {/* TABS */}
                            <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
                                {["reservas", "pagos", "liquidacion"].map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        style={{
                                            padding: "20px 30px", border: "none", background: "transparent", cursor: "pointer",
                                            fontWeight: activeTab === tab ? 700 : 500,
                                            color: activeTab === tab ? "#0ea5e9" : "#64748b",
                                            borderBottom: activeTab === tab ? "3px solid #0ea5e9" : "3px solid transparent",
                                            textTransform: "capitalize", fontSize: "1.05rem"
                                        }}>
                                        {tab === "liquidacion" ? "Estado de Cuenta" : tab}
                                    </button>
                                ))}
                            </div>

                            <div style={{ padding: 30 }}>
                                {/* ========== TAB RESERVAS ========== */}
                                {activeTab === "reservas" && (
                                    <div>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                                            <h2 style={{ margin: 0 }}>Reservas en {selectedHotel.nombre}</h2>
                                            <button onClick={() => {
                                                setReservaForm({ empresa_id: "", fecha_ingreso: "", fecha_salida: "", cant_single: 0, tarifa_single: 0, cant_doble: 0, tarifa_doble: 0, cant_triple: 0, tarifa_triple: 0, cant_cuadruple: 0, tarifa_cuadruple: 0, cant_quintuple: 0, tarifa_quintuple: 0 });
                                                setShowReservaModal(true);
                                            }} style={{ background: "#10b981", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontWeight: "bold" }}>+ Agregar Reserva</button>
                                        </div>

                                        <div style={{ overflowX: "auto" }}>
                                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.95rem" }}>
                                                <thead>
                                                    <tr style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left", color: "#64748b" }}>
                                                        <th style={{ padding: 12 }}>Empresa</th>
                                                        <th style={{ padding: 12 }}>In / Out</th>
                                                        <th style={{ padding: 12 }}>Noches</th>
                                                        <th style={{ padding: 12 }}>Habitaciones</th>
                                                        <th style={{ padding: 12 }}>Tarifa Total/Noche</th>
                                                        <th style={{ padding: 12 }}>Subtotal</th>
                                                        <th style={{ padding: 12 }}>Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {hotelReservas.length === 0 && <tr><td colSpan="7" style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>No hay reservas</td></tr>}
                                                    {hotelReservas.map(r => {
                                                        const inDate = new Date(r.fecha_ingreso);
                                                        const outDate = new Date(r.fecha_salida);
                                                        const noches = Math.max(0, (outDate - inDate) / (1000 * 60 * 60 * 24));

                                                        const tarNoche =
                                                            (r.cant_single * r.tarifa_single) +
                                                            (r.cant_doble * r.tarifa_doble) +
                                                            (r.cant_triple * r.tarifa_triple) +
                                                            (r.cant_cuadruple * r.tarifa_cuadruple) +
                                                            (r.cant_quintuple * r.tarifa_quintuple);

                                                        const subtotal = tarNoche * noches;

                                                        const habs = [];
                                                        if (r.cant_single > 0) habs.push(`SGL(${r.cant_single})`);
                                                        if (r.cant_doble > 0) habs.push(`DBL(${r.cant_doble})`);
                                                        if (r.cant_triple > 0) habs.push(`TPL(${r.cant_triple})`);
                                                        if (r.cant_cuadruple > 0) habs.push(`CPL(${r.cant_cuadruple})`);
                                                        if (r.cant_quintuple > 0) habs.push(`QPL(${r.cant_quintuple})`);

                                                        return (
                                                            <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                                                <td style={{ padding: 12, fontWeight: "bold" }}>{r.empresa?.nombre}</td>
                                                                <td style={{ padding: 12 }}>{r.fecha_ingreso} <br /> {r.fecha_salida}</td>
                                                                <td style={{ padding: 12 }}>{noches}</td>
                                                                <td style={{ padding: 12, fontSize: "0.85rem", color: "#475569" }}>{habs.join(", ")}</td>
                                                                <td style={{ padding: 12 }}>${tarNoche.toLocaleString()}</td>
                                                                <td style={{ padding: 12, fontWeight: "bold", color: "#0ea5e9" }}>${subtotal.toLocaleString()}</td>
                                                                <td style={{ padding: 12 }}>
                                                                    <button onClick={() => handleDeleteReserva(r.id)} style={{ background: "#ef4444", color: "white", padding: "4px 8px", borderRadius: 4, border: "none", cursor: "pointer", fontSize: "0.8rem" }}>Eliminar</button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* ========== TAB PAGOS ========== */}
                                {activeTab === "pagos" && (
                                    <div>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                                            <h2 style={{ margin: 0 }}>Pagos y Señas a {selectedHotel.nombre}</h2>
                                            <button onClick={() => {
                                                setPagoForm({ empresa_id: "", reserva_id: "", monto: "", fecha: "", metodo: "Transferencia", nota: "" });
                                                setShowPagoModal(true);
                                            }} style={{ background: "#10b981", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontWeight: "bold" }}>+ Registrar Pago</button>
                                        </div>

                                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.95rem" }}>
                                            <thead>
                                                <tr style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left", color: "#64748b" }}>
                                                    <th style={{ padding: 12 }}>Fecha</th>
                                                    <th style={{ padding: 12 }}>Empresa Pagadora</th>
                                                    <th style={{ padding: 12 }}>Reserva / Grupo</th>
                                                    <th style={{ padding: 12 }}>Monto</th>
                                                    <th style={{ padding: 12 }}>Método</th>
                                                    <th style={{ padding: 12 }}>Nota</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {hotelPagos.length === 0 && <tr><td colSpan="6" style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>No hay pagos registrados</td></tr>}
                                                {hotelPagos.map(p => {
                                                    const emp = empresas.find(e => e.id === p.empresa_id);
                                                    const reserva = reservas.find(r => r.id === p.reserva_id);
                                                    const reservaLabel = reserva ? `#${reserva.id} · ${reserva.fecha_ingreso} - ${reserva.fecha_salida}` : "General";
                                                    return (
                                                        <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                                            <td style={{ padding: 12 }}>{p.fecha}</td>
                                                            <td style={{ padding: 12, fontWeight: "bold" }}>{emp?.nombre}</td>
                                                            <td style={{ padding: 12, color: "#475569" }}>{reservaLabel}</td>
                                                            <td style={{ padding: 12, fontWeight: "bold", color: "#10b981" }}>${p.monto.toLocaleString()}</td>
                                                            <td style={{ padding: 12 }}>{p.metodo}</td>
                                                            <td style={{ padding: 12, color: "#64748b" }}>{p.nota}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* ========== TAB LIQUIDACION ========== */}
                                {activeTab === "liquidacion" && (
                                    <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center", padding: "40px 0" }}>
                                        <h2 style={{ color: "#334155" }}>Descargar Estado de Cuenta</h2>
                                        <p style={{ color: "#64748b", marginBottom: 30 }}>Genera un Excel automático consolidando todas las reservas, calculando totales de noches y descontando las señas y pagos realizados.</p>

                                        <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
                                            <div style={{ width: "100%", textAlign: "left" }}>
                                                <label style={{ fontWeight: "bold", fontSize: "0.9rem", color: "#475569" }}>Seleccionar Empresa</label>
                                                <select value={liqEmpresaId} onChange={e => setLiqEmpresaId(e.target.value)} style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #cbd5e1", marginTop: 6 }}>
                                                    <option value="">-- Elige una empresa --</option>
                                                    {empresas.map(emp => (
                                                        <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <button
                                                onClick={handleDownloadLiquidacion}
                                                style={{ width: "100%", background: "#a855f7", color: "white", border: "none", padding: "14px", borderRadius: 8, fontSize: "1.1rem", fontWeight: "bold", cursor: "pointer", marginTop: 10, display: "flex", justifyContent: "center", alignItems: "center", gap: 10 }}>
                                                📄 Descargar Liquidación Excel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* MODALES OVERLAYS */}
            {/* Modal Crear Hotel */}
            {showHotelModal && (
                <div style={modalOverlayStyle}>
                    <div style={modalContentStyle}>
                        <h3>Nuevo Hotel</h3>
                        <form onSubmit={handleCreateHotel} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                            <input required placeholder="Nombre del Hotel" value={newHotelName} onChange={e => setNewHotelName(e.target.value)} style={inputStyle} />
                            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                                <button type="button" onClick={() => setShowHotelModal(false)} style={btnCancel}>Cancelar</button>
                                <button type="submit" style={btnSubmit}>Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Crear Reserva */}
            {showReservaModal && (
                <div style={modalOverlayStyle}>
                    <div style={{ ...modalContentStyle, width: 600 }}>
                        <h3>Nueva Reserva</h3>
                        <form onSubmit={handleCreateReserva} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15 }}>
                                <div>
                                    <label style={labelStyle}>Empresa</label>
                                    <select required value={reservaForm.empresa_id} onChange={e => setReservaForm({ ...reservaForm, empresa_id: e.target.value })} style={inputStyle}>
                                        <option value="">Selecciona empresa</option>
                                        {empresas.map(emp => <option key={emp.id} value={emp.id}>{emp.nombre}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                    <div>
                                        <label style={labelStyle}>Ingreso</label>
                                        <input type="date" required value={reservaForm.fecha_ingreso} onChange={e => setReservaForm({ ...reservaForm, fecha_ingreso: e.target.value })} style={inputStyle} />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Salida</label>
                                        <input type="date" required value={reservaForm.fecha_salida} onChange={e => setReservaForm({ ...reservaForm, fecha_salida: e.target.value })} style={inputStyle} />
                                    </div>
                                </div>
                            </div>

                            <hr style={{ border: "0.5px solid #e2e8f0" }} />
                            <p style={{ margin: 0, fontWeight: "bold", fontSize: "0.9rem", color: "#475569" }}>Habitaciones y Tarifas (por noche)</p>

                            <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr", gap: 10, alignItems: "center" }}>
                                <span />
                                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Habitaciones</span>
                                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Tarifa</span>
                            </div>

                            {["single", "doble", "triple", "cuadruple", "quintuple"].map(tipo => (
                                <div key={tipo} style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr", gap: 10, alignItems: "center" }}>
                                    <span style={{ textTransform: "capitalize", fontSize: "0.9rem" }}>{tipo}</span>
                                    <input type="number" min="0" placeholder="Cantidad"
                                        value={reservaForm[`cant_${tipo}`]}
                                        onChange={e => setReservaForm({ ...reservaForm, [`cant_${tipo}`]: parseInt(e.target.value) || 0 })} style={inputStyle} />
                                    <input type="number" min="0" placeholder="$ Tarifa"
                                        value={reservaForm[`tarifa_${tipo}`]}
                                        onChange={e => setReservaForm({ ...reservaForm, [`tarifa_${tipo}`]: parseInt(e.target.value) || 0 })} style={inputStyle} />
                                </div>
                            ))}

                            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 10 }}>
                                <button type="button" onClick={() => setShowReservaModal(false)} style={btnCancel}>Cancelar</button>
                                <button type="submit" style={btnSubmit}>Guardar Reserva</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Crear Pago */}
            {showPagoModal && (
                <div style={modalOverlayStyle}>
                    <div style={modalContentStyle}>
                        <h3>Registrar Pago / Seña</h3>
                        <form onSubmit={handleCreatePago} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                            <div>
                                <label style={labelStyle}>Empresa</label>
                                <select required value={pagoForm.empresa_id} onChange={e => setPagoForm({ ...pagoForm, empresa_id: e.target.value, reserva_id: "" })} style={inputStyle}>
                                    <option value="">Selecciona empresa</option>
                                    {empresas.map(emp => <option key={emp.id} value={emp.id}>{emp.nombre}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Reserva / Grupo (opcional)</label>
                                <select value={pagoForm.reserva_id} onChange={e => setPagoForm({ ...pagoForm, reserva_id: e.target.value })} style={inputStyle} disabled={!pagoForm.empresa_id}>
                                    <option value="">Pago general de liquidación</option>
                                    {empresaReservas.map(res => (
                                        <option key={res.id} value={res.id}>#{res.id} · {res.fecha_ingreso} - {res.fecha_salida}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                <div>
                                    <label style={labelStyle}>Fecha de Pago</label>
                                    <input type="date" required value={pagoForm.fecha} onChange={e => setPagoForm({ ...pagoForm, fecha: e.target.value })} style={inputStyle} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Monto ($)</label>
                                    <input type="number" required min="1" value={pagoForm.monto} onChange={e => setPagoForm({ ...pagoForm, monto: parseInt(e.target.value) })} style={inputStyle} />
                                </div>
                            </div>
                            <div>
                                <label style={labelStyle}>Método</label>
                                <select value={pagoForm.metodo} onChange={e => setPagoForm({ ...pagoForm, metodo: e.target.value })} style={inputStyle}>
                                    <option>Transferencia</option>
                                    <option>Efectivo</option>
                                    <option>Cheque</option>
                                    <option>Otro</option>
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Nota (opcional)</label>
                                <input placeholder="Comprobante #1234" value={pagoForm.nota} onChange={e => setPagoForm({ ...pagoForm, nota: e.target.value })} style={inputStyle} />
                            </div>

                            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 10 }}>
                                <button type="button" onClick={() => setShowPagoModal(false)} style={btnCancel}>Cancelar</button>
                                <button type="submit" style={btnSubmit}>Guardar Pago</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// Estilos para modales inline para simplificar
const modalOverlayStyle = {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.6)", zIndex: 1000,
    display: "flex", justifyContent: "center", alignItems: "center"
};
const modalContentStyle = {
    background: "white", padding: 30, borderRadius: 16, width: 400,
    boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", color: "#1e293b"
};
const inputStyle = {
    width: "100%", padding: 10, borderRadius: 6, border: "1px solid #cbd5e1",
    fontSize: "0.95rem", boxSizing: "border-box"
};
const labelStyle = {
    display: "block", fontSize: "0.85rem", fontWeight: "bold", color: "#64748b", marginBottom: 4
};
const btnCancel = {
    padding: "10px 16px", background: "#e2e8f0", border: "none", borderRadius: 6,
    color: "#475569", fontWeight: "bold", cursor: "pointer"
};
const btnSubmit = {
    padding: "10px 16px", background: "#0ea5e9", border: "none", borderRadius: 6,
    color: "white", fontWeight: "bold", cursor: "pointer"
};
