import { useState, useEffect, useCallback } from "react";
import api from "../api";

// ─── Chips de tipo de comida ────────────────────────────────────────────────
const TIPO_COMIDA_COLORS = {
  desayuno: { bg: "#fff3e0", color: "#e65100", border: "#ffcc02" },
  almuerzo: { bg: "#e8f5e9", color: "#2e7d32", border: "#a5d6a7" },
  cena:     { bg: "#e8eaf6", color: "#1e3a5f", border: "#9fa8da" },
};

function TipoChip({ tipo }) {
  const cfg = TIPO_COMIDA_COLORS[tipo?.toLowerCase()] || {
    bg: "#f1f5f9", color: "#475569", border: "#cbd5e1",
  };
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 12,
      fontSize: "0.75rem",
      fontWeight: 700,
      background: cfg.bg,
      color: cfg.color,
      border: `1px solid ${cfg.border}`,
      textTransform: "capitalize",
    }}>
      {tipo}
    </span>
  );
}

// ─── Spinner ────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
      <div style={{
        width: 36, height: 36, border: "4px solid #e2e8f0",
        borderTop: "4px solid #1e3a5f", borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
    </div>
  );
}

// ─── Sección contenedor ─────────────────────────────────────────────────────
function Section({ title, children, action }) {
  return (
    <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 14, marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e3a5f" }}>{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Input inline genérico ─────────────────────────────────────────────────
const inputStyle = {
  width: "100%",
  padding: "6px 10px",
  borderRadius: 6,
  border: "1px solid #cbd5e1",
  fontSize: "0.85rem",
  boxSizing: "border-box",
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
export default function AnotacionGrupoPanel({
  grupoId,
  grupoNombre,
  empresaNombre,
  fechaEntrada,
  fechaSalida,
  onClose,
}) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Composición
  const [hombres, setHombres] = useState("");
  const [mujeres, setMujeres] = useState("");
  const [tripulacion, setTripulacion] = useState("");
  const [guardandoComp, setGuardandoComp] = useState(false);
  const [savedComp, setSavedComp] = useState(false);

  // Notas generales
  const [notas, setNotas] = useState("");
  const [guardandoNotas, setGuardandoNotas] = useState(false);
  const [savedNotas, setSavedNotas] = useState(false);

  // Hoteles
  const [hoteles, setHoteles] = useState([]);
  const [addingHotel, setAddingHotel] = useState(false);
  const [editingHotelId, setEditingHotelId] = useState(null);
  const [hotelForm, setHotelForm] = useState(emptyHotelForm());

  // Comidas
  const [comidas, setComidas] = useState([]);
  const [addingComida, setAddingComida] = useState(false);
  const [editingComidaId, setEditingComidaId] = useState(null);
  const [comidaForm, setComidaForm] = useState(emptyComidaForm());

  // ── Carga inicial ──────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await api.get(`/anotaciones-grupo/${grupoId}`);
      const d = res.data;
      setHombres(d.cant_hombres ?? "");
      setMujeres(d.cant_mujeres ?? "");
      setTripulacion(d.cant_tripulacion ?? "");
      setNotas(d.notas_generales ?? "");
      setHoteles(d.hoteles || []);
      setComidas(d.comidas || []);
    } catch (e) {
      setError("No se pudo cargar la información del grupo.");
    } finally {
      setCargando(false);
    }
  }, [grupoId]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Guardar composición ────────────────────────────────────────────────
  const guardarComposicion = async () => {
    setGuardandoComp(true);
    try {
      await api.put(`/anotaciones-grupo/${grupoId}`, {
        cant_hombres: hombres !== "" ? Number(hombres) : null,
        cant_mujeres: mujeres !== "" ? Number(mujeres) : null,
        cant_tripulacion: tripulacion !== "" ? Number(tripulacion) : null,
        notas_generales: notas,
      });
      setSavedComp(true);
      setTimeout(() => setSavedComp(false), 2000);
    } catch {
      alert("Error al guardar composición");
    } finally {
      setGuardandoComp(false);
    }
  };

  // ── Guardar notas ──────────────────────────────────────────────────────
  const guardarNotas = async () => {
    setGuardandoNotas(true);
    try {
      await api.put(`/anotaciones-grupo/${grupoId}`, {
        cant_hombres: hombres !== "" ? Number(hombres) : null,
        cant_mujeres: mujeres !== "" ? Number(mujeres) : null,
        cant_tripulacion: tripulacion !== "" ? Number(tripulacion) : null,
        notas_generales: notas,
      });
      setSavedNotas(true);
      setTimeout(() => setSavedNotas(false), 2000);
    } catch {
      alert("Error al guardar notas");
    } finally {
      setGuardandoNotas(false);
    }
  };

  // ── Descargar Excel ────────────────────────────────────────────────────
  const descargarRooming = async () => {
    try {
      const response = await api.get(`/anotaciones-grupo/${grupoId}/rooming-excel`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `rooming_${grupoNombre.replace(/\s+/g, "_")}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Error al descargar el rooming list");
    }
  };

  // ── HOTELES ────────────────────────────────────────────────────────────
  const agregarHotel = async () => {
    if (!hotelForm.hotel_nombre.trim()) { alert("Ingresá el nombre del hotel"); return; }
    try {
      await api.post(`/anotaciones-grupo/${grupoId}/hoteles`, hotelForm);
      await cargar();
      setAddingHotel(false);
      setHotelForm(emptyHotelForm());
    } catch { alert("Error al agregar hotel"); }
  };

  const editarHotel = async (id) => {
    if (!hotelForm.hotel_nombre.trim()) { alert("Ingresá el nombre del hotel"); return; }
    try {
      await api.put(`/anotaciones-grupo/hoteles/${id}`, hotelForm);
      await cargar();
      setEditingHotelId(null);
      setHotelForm(emptyHotelForm());
    } catch { alert("Error al editar hotel"); }
  };

  const eliminarHotel = async (id) => {
    if (!window.confirm("¿Eliminar este segmento de hotel?")) return;
    try {
      await api.delete(`/anotaciones-grupo/hoteles/${id}`);
      await cargar();
    } catch { alert("Error al eliminar hotel"); }
  };

  const iniciarEditHotel = (h) => {
    setEditingHotelId(h.id);
    setHotelForm({
      hotel_nombre: h.hotel_nombre || "",
      cant_pax: h.cant_pax ?? "",
      fecha_ingreso: h.fecha_ingreso || "",
      fecha_salida: h.fecha_salida || "",
      notas: h.notas || "",
    });
    setAddingHotel(false);
  };

  // ── COMIDAS ────────────────────────────────────────────────────────────
  const agregarComida = async () => {
    if (!comidaForm.tipo_comida) { alert("Seleccioná el tipo de comida"); return; }
    if (!comidaForm.fecha) { alert("Ingresá la fecha"); return; }
    try {
      await api.post(`/anotaciones-grupo/${grupoId}/comidas`, comidaForm);
      await cargar();
      setAddingComida(false);
      setComidaForm(emptyComidaForm());
    } catch { alert("Error al agregar comida"); }
  };

  const editarComida = async (id) => {
    if (!comidaForm.tipo_comida) { alert("Seleccioná el tipo de comida"); return; }
    try {
      await api.put(`/anotaciones-grupo/comidas/${id}`, comidaForm);
      await cargar();
      setEditingComidaId(null);
      setComidaForm(emptyComidaForm());
    } catch { alert("Error al editar comida"); }
  };

  const eliminarComida = async (id) => {
    if (!window.confirm("¿Eliminar este registro de comida?")) return;
    try {
      await api.delete(`/anotaciones-grupo/comidas/${id}`);
      await cargar();
    } catch { alert("Error al eliminar comida"); }
  };

  const iniciarEditComida = (c) => {
    setEditingComidaId(c.id);
    setComidaForm({
      fecha: c.fecha || "",
      tipo_comida: c.tipo_comida || "",
      lugar: c.lugar || "",
      cant_pax: c.cant_pax ?? "",
      notas: c.notas || "",
    });
    setAddingComida(false);
  };

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* Estilos de animación inyectados en el head */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        .ag-panel {
          animation: slideInRight 0.28s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .ag-btn-icon {
          background: none;
          border: none;
          cursor: pointer;
          padding: 3px 7px;
          border-radius: 5px;
          font-size: 0.85rem;
          transition: background 0.15s;
        }
        .ag-btn-icon:hover { background: #f1f5f9; }
        .ag-btn-danger { color: #ef4444; }
        .ag-btn-edit  { color: #2563eb; }
        .ag-inline-form {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 7px;
          margin-top: 8px;
        }
        .ag-item-row {
          display: flex;
          align-items: flex-start;
          gap: 6px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 8px 10px;
          margin-bottom: 6px;
          font-size: 0.84rem;
        }
        .ag-save-pill {
          display: inline-block;
          background: #d1fae5;
          color: #065f46;
          border-radius: 12px;
          padding: 2px 10px;
          font-size: 0.78rem;
          font-weight: 700;
          margin-left: 8px;
          animation: fadeIn 0.2s;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.35)",
          zIndex: 1200,
        }}
      />

      {/* Panel drawer */}
      <div
        className="ag-panel"
        style={{
          position: "fixed",
          top: 0, right: 0,
          height: "100vh",
          width: 480,
          background: "#fff",
          boxShadow: "-6px 0 32px rgba(0,0,0,0.18)",
          zIndex: 1201,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div style={{
          background: "#1e3a5f",
          color: "#fff",
          padding: "18px 20px",
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          flexShrink: 0,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: "1.05rem", lineHeight: 1.2, marginBottom: 2 }}>
              {grupoNombre}
            </div>
            {empresaNombre && (
              <div style={{ fontSize: "0.82rem", opacity: 0.8, fontWeight: 400 }}>
                {empresaNombre}
                {fechaEntrada && (
                  <span style={{ marginLeft: 8, opacity: 0.7 }}>
                    {fechaEntrada}{fechaSalida ? ` → ${fechaSalida}` : ""}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Botón descarga Excel */}
          <button
            onClick={descargarRooming}
            title="Descargar Rooming Excel"
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.35)",
              color: "#fff",
              borderRadius: 7,
              padding: "6px 10px",
              cursor: "pointer",
              fontSize: "0.82rem",
              fontWeight: 600,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            🏨 Excel
          </button>

          {/* Botón cerrar */}
          <button
            onClick={onClose}
            title="Cerrar"
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "none",
              color: "#fff",
              borderRadius: 7,
              padding: "6px 10px",
              cursor: "pointer",
              fontSize: "1.1rem",
              fontWeight: 700,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >✕</button>
        </div>

        {/* ── Cuerpo ──────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>

          {cargando && <Spinner />}
          {error && (
            <div style={{ color: "#ef4444", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 12, fontSize: "0.85rem" }}>
              {error}
              <button onClick={cargar} style={{ marginLeft: 10, textDecoration: "underline", background: "none", border: "none", cursor: "pointer", color: "#dc2626" }}>
                Reintentar
              </button>
            </div>
          )}

          {!cargando && !error && (
            <>
              {/* ── Composición ──────────────────────────────────────── */}
              <Section title="👥 Composición del grupo">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                  <label style={labelStyle}>
                    Hombres
                    <input
                      type="number" min="0"
                      value={hombres}
                      onChange={e => setHombres(e.target.value)}
                      style={inputStyle}
                      placeholder="—"
                    />
                  </label>
                  <label style={labelStyle}>
                    Mujeres
                    <input
                      type="number" min="0"
                      value={mujeres}
                      onChange={e => setMujeres(e.target.value)}
                      style={inputStyle}
                      placeholder="—"
                    />
                  </label>
                  <label style={labelStyle}>
                    Tripulación
                    <input
                      type="number" min="0"
                      value={tripulacion}
                      onChange={e => setTripulacion(e.target.value)}
                      style={inputStyle}
                      placeholder="—"
                    />
                  </label>
                </div>
                <button
                  onClick={guardarComposicion}
                  disabled={guardandoComp}
                  style={btnPrimaryStyle}
                >
                  {guardandoComp ? "Guardando..." : "Guardar"}
                </button>
                {savedComp && <span className="ag-save-pill">Guardado ✓</span>}
              </Section>

              {/* ── Hoteles ──────────────────────────────────────────── */}
              <Section
                title="🏨 Hoteles"
                action={
                  !addingHotel && editingHotelId === null && (
                    <button
                      onClick={() => { setAddingHotel(true); setHotelForm(emptyHotelForm()); }}
                      style={btnAddStyle}
                      title="Agregar hotel"
                    >＋</button>
                  )
                }
              >
                {hoteles.length === 0 && !addingHotel && (
                  <p style={emptyStyle}>Sin hoteles registrados.</p>
                )}

                {hoteles.map(h => (
                  editingHotelId === h.id
                    ? (
                      <HotelForm
                        key={h.id}
                        form={hotelForm}
                        onChange={setHotelForm}
                        onSave={() => editarHotel(h.id)}
                        onCancel={() => { setEditingHotelId(null); setHotelForm(emptyHotelForm()); }}
                      />
                    ) : (
                      <div className="ag-item-row" key={h.id}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: "#1e3a5f", marginBottom: 2 }}>{h.hotel_nombre}</div>
                          <div style={{ color: "#64748b", fontSize: "0.8rem" }}>
                            {h.cant_pax && `${h.cant_pax} pax`}
                            {h.fecha_ingreso && ` · Check-in: ${h.fecha_ingreso}`}
                            {h.fecha_salida && ` → ${h.fecha_salida}`}
                          </div>
                          {h.notas && <div style={{ color: "#94a3b8", fontSize: "0.78rem", marginTop: 2, fontStyle: "italic" }}>{h.notas}</div>}
                        </div>
                        <button className="ag-btn-icon ag-btn-edit" onClick={() => iniciarEditHotel(h)} title="Editar">✏️</button>
                        <button className="ag-btn-icon ag-btn-danger" onClick={() => eliminarHotel(h.id)} title="Eliminar">🗑️</button>
                      </div>
                    )
                ))}

                {addingHotel && (
                  <HotelForm
                    form={hotelForm}
                    onChange={setHotelForm}
                    onSave={agregarHotel}
                    onCancel={() => { setAddingHotel(false); setHotelForm(emptyHotelForm()); }}
                  />
                )}
              </Section>

              {/* ── Programa de Comidas ───────────────────────────────── */}
              <Section
                title="🍽️ Programa de Comidas"
                action={
                  !addingComida && editingComidaId === null && (
                    <button
                      onClick={() => { setAddingComida(true); setComidaForm(emptyComidaForm()); }}
                      style={btnAddStyle}
                      title="Agregar comida"
                    >＋</button>
                  )
                }
              >
                {comidas.length === 0 && !addingComida && (
                  <p style={emptyStyle}>Sin comidas registradas.</p>
                )}

                {comidas.map(c => (
                  editingComidaId === c.id
                    ? (
                      <ComidaForm
                        key={c.id}
                        form={comidaForm}
                        onChange={setComidaForm}
                        onSave={() => editarComida(c.id)}
                        onCancel={() => { setEditingComidaId(null); setComidaForm(emptyComidaForm()); }}
                      />
                    ) : (
                      <div className="ag-item-row" key={c.id}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                            <TipoChip tipo={c.tipo_comida} />
                            <span style={{ color: "#475569", fontSize: "0.82rem" }}>{c.fecha}</span>
                          </div>
                          <div style={{ color: "#64748b", fontSize: "0.8rem" }}>
                            {c.lugar && `${c.lugar}`}
                            {c.cant_pax && ` · ${c.cant_pax} pax`}
                          </div>
                          {c.notas && <div style={{ color: "#94a3b8", fontSize: "0.78rem", marginTop: 2, fontStyle: "italic" }}>{c.notas}</div>}
                        </div>
                        <button className="ag-btn-icon ag-btn-edit" onClick={() => iniciarEditComida(c)} title="Editar">✏️</button>
                        <button className="ag-btn-icon ag-btn-danger" onClick={() => eliminarComida(c.id)} title="Eliminar">🗑️</button>
                      </div>
                    )
                ))}

                {addingComida && (
                  <ComidaForm
                    form={comidaForm}
                    onChange={setComidaForm}
                    onSave={agregarComida}
                    onCancel={() => { setAddingComida(false); setComidaForm(emptyComidaForm()); }}
                  />
                )}
              </Section>

              {/* ── Notas Generales ───────────────────────────────────── */}
              <Section title="📝 Notas Generales">
                <textarea
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  rows={4}
                  placeholder="Observaciones, detalles especiales, requerimientos del grupo..."
                  style={{
                    ...inputStyle,
                    resize: "vertical",
                    fontFamily: "inherit",
                    minHeight: 80,
                  }}
                />
                <div style={{ marginTop: 8 }}>
                  <button
                    onClick={guardarNotas}
                    disabled={guardandoNotas}
                    style={btnPrimaryStyle}
                  >
                    {guardandoNotas ? "Guardando..." : "Guardar notas"}
                  </button>
                  {savedNotas && <span className="ag-save-pill">Guardado ✓</span>}
                </div>
              </Section>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Sub-formulario Hotel ───────────────────────────────────────────────────
function HotelForm({ form, onChange, onSave, onCancel }) {
  const set = (k, v) => onChange(prev => ({ ...prev, [k]: v }));
  return (
    <div className="ag-inline-form">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 7 }}>
        <div>
          <label style={labelStyle}>
            Hotel *
            <input type="text" value={form.hotel_nombre} onChange={e => set("hotel_nombre", e.target.value)}
              style={inputStyle} placeholder="Nombre del hotel" />
          </label>
        </div>
        <div>
          <label style={labelStyle}>
            PAX
            <input type="number" min="0" value={form.cant_pax} onChange={e => set("cant_pax", e.target.value)}
              style={inputStyle} placeholder="0" />
          </label>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
        <label style={labelStyle}>
          Check-in
          <input type="date" value={form.fecha_ingreso} onChange={e => set("fecha_ingreso", e.target.value)}
            style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Check-out
          <input type="date" value={form.fecha_salida} onChange={e => set("fecha_salida", e.target.value)}
            style={inputStyle} />
        </label>
      </div>
      <label style={labelStyle}>
        Notas
        <input type="text" value={form.notas} onChange={e => set("notas", e.target.value)}
          style={inputStyle} placeholder="Notas opcionales" />
      </label>
      <div style={{ display: "flex", gap: 7, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={btnCancelStyle}>Cancelar</button>
        <button onClick={onSave} style={btnPrimaryStyle}>Guardar</button>
      </div>
    </div>
  );
}

// ─── Sub-formulario Comida ─────────────────────────────────────────────────
function ComidaForm({ form, onChange, onSave, onCancel }) {
  const set = (k, v) => onChange(prev => ({ ...prev, [k]: v }));
  return (
    <div className="ag-inline-form">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
        <label style={labelStyle}>
          Fecha *
          <input type="date" value={form.fecha} onChange={e => set("fecha", e.target.value)}
            style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Tipo *
          <select value={form.tipo_comida} onChange={e => set("tipo_comida", e.target.value)} style={inputStyle}>
            <option value="">— Seleccionar —</option>
            <option value="desayuno">Desayuno</option>
            <option value="almuerzo">Almuerzo</option>
            <option value="cena">Cena</option>
          </select>
        </label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 7 }}>
        <label style={labelStyle}>
          Lugar
          <input type="text" value={form.lugar} onChange={e => set("lugar", e.target.value)}
            style={inputStyle} placeholder="Restaurante, salón..." />
        </label>
        <label style={labelStyle}>
          PAX
          <input type="number" min="0" value={form.cant_pax} onChange={e => set("cant_pax", e.target.value)}
            style={inputStyle} placeholder="0" />
        </label>
      </div>
      <label style={labelStyle}>
        Notas
        <input type="text" value={form.notas} onChange={e => set("notas", e.target.value)}
          style={inputStyle} placeholder="Notas opcionales" />
      </label>
      <div style={{ display: "flex", gap: 7, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={btnCancelStyle}>Cancelar</button>
        <button onClick={onSave} style={btnPrimaryStyle}>Guardar</button>
      </div>
    </div>
  );
}

// ─── Helpers de estado inicial ──────────────────────────────────────────────
function emptyHotelForm() {
  return { hotel_nombre: "", cant_pax: "", fecha_ingreso: "", fecha_salida: "", notas: "" };
}
function emptyComidaForm() {
  return { fecha: "", tipo_comida: "", lugar: "", cant_pax: "", notas: "" };
}

// ─── Estilos compartidos ────────────────────────────────────────────────────
const labelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 3,
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "#475569",
};

const btnPrimaryStyle = {
  background: "#1e3a5f",
  color: "#fff",
  border: "none",
  borderRadius: 7,
  padding: "7px 16px",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: "0.84rem",
};

const btnCancelStyle = {
  background: "#f1f5f9",
  color: "#64748b",
  border: "1px solid #e2e8f0",
  borderRadius: 7,
  padding: "7px 14px",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: "0.84rem",
};

const btnAddStyle = {
  background: "#1e3a5f",
  color: "#fff",
  border: "none",
  borderRadius: "50%",
  width: 26,
  height: 26,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: "1rem",
  lineHeight: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  flexShrink: 0,
};

const emptyStyle = {
  fontSize: "0.82rem",
  color: "#94a3b8",
  margin: "4px 0 8px 0",
  fontStyle: "italic",
};
