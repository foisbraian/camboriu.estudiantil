import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import api from "../api";

const parseISODate = (value) => {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const formatISODate = (date) => {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatHumanDate = (date) => {
  if (!date) return "Seleccionar";
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short" }).replace(".", "");
};

const addMonths = (date, count) => {
  const d = new Date(date.getFullYear(), date.getMonth() + count, 1);
  return d;
};

const startOfCalendar = (date) => {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const weekday = (first.getDay() + 6) % 7; // lunes como inicio
  first.setDate(first.getDate() - weekday);
  return first;
};

const buildCalendarGrid = (date) => {
  const start = startOfCalendar(date);
  return Array.from({ length: 42 }, (_, idx) => {
    const d = new Date(start);
    d.setDate(start.getDate() + idx);
    return d;
  });
};

const isSameDay = (a, b) => {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
};

const isBetween = (target, start, end) => {
  if (!start || !end) return false;
  return target > start && target < end;
};

const DateRangeField = ({
  label = "Fechas",
  start,
  end,
  onStartChange,
  onEndChange,
  compact = false
}) => {
  const containerRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => parseISODate(start) || parseISODate(end) || new Date());
  const [tempRange, setTempRange] = useState({ start: parseISODate(start), end: parseISODate(end) });

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) return;
    setTempRange({ start: parseISODate(start), end: parseISODate(end) });
    const newBase = parseISODate(start) || parseISODate(end);
    if (newBase) {
      setVisibleMonth(newBase);
    }
  }, [start, end, isOpen]);

  const handleDayClick = (day) => {
    const dayDate = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    if (!tempRange.start || (tempRange.start && tempRange.end)) {
      setTempRange({ start: dayDate, end: null });
      onStartChange(formatISODate(dayDate));
      onEndChange("");
      return;
    }
    if (dayDate < tempRange.start) {
      const newRange = { start: dayDate, end: tempRange.start };
      setTempRange(newRange);
      onStartChange(formatISODate(newRange.start));
      onEndChange(formatISODate(newRange.end));
      return;
    }
    const newRange = { start: tempRange.start, end: dayDate };
    setTempRange(newRange);
    onStartChange(formatISODate(newRange.start));
    onEndChange(formatISODate(newRange.end));
  };

  const clearRange = () => {
    setTempRange({ start: null, end: null });
    onStartChange("");
    onEndChange("");
  };

  const openPicker = () => {
    setTempRange({ start: parseISODate(start), end: parseISODate(end) });
    setVisibleMonth(parseISODate(start) || parseISODate(end) || new Date());
    setIsOpen(true);
  };

  const monthsToRender = [0, 1].map((offset) => addMonths(visibleMonth, offset));

  const summaryStyle = {
    fontSize: compact ? "0.9rem" : "1rem",
    color: "rgba(248,250,252,0.95)",
    fontWeight: 600
  };

  return (
    <div style={{ width: "100%", position: "relative" }} ref={containerRef}>
      <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>{label}</label>
      <button
        type="button"
        onClick={openPicker}
        style={{
          width: "100%",
          borderRadius: 16,
          border: "1px solid #e2e8f0",
          background: "linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,58,138,0.9))",
          color: "white",
          padding: compact ? "12px 16px" : "16px 22px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          boxShadow: "0 18px 30px rgba(15, 23, 42, 0.25)",
          gap: 18,
          textAlign: "left"
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(248,250,252,0.7)", marginBottom: 2 }}>
            Entrada
          </div>
          <div style={summaryStyle}>{formatHumanDate(parseISODate(start))}</div>
        </div>
        <div style={{ width: 32, height: 2, background: "rgba(248,250,252,0.4)", borderRadius: 999 }}></div>
        <div style={{ flex: 1, textAlign: "right" }}>
          <div style={{ fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(248,250,252,0.7)", marginBottom: 2 }}>
            Salida
          </div>
          <div style={{ ...summaryStyle, textAlign: "right" }}>{formatHumanDate(parseISODate(end))}</div>
        </div>
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            zIndex: 20,
            top: "calc(100% + 8px)",
            left: 0,
            right: 0,
            background: "white",
            borderRadius: 20,
            boxShadow: "0 30px 60px rgba(15,23,42,0.2)",
            padding: 20
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))}
              style={{
                border: "none",
                background: "rgba(15,23,42,0.05)",
                width: 36,
                height: 36,
                borderRadius: 12,
                cursor: "pointer"
              }}
            >
              ‹
            </button>
            <span style={{ fontWeight: 700, color: "#0f172a" }}>Seleccioná tu estadía</span>
            <button
              type="button"
              onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}
              style={{
                border: "none",
                background: "rgba(15,23,42,0.05)",
                width: 36,
                height: 36,
                borderRadius: 12,
                cursor: "pointer"
              }}
            >
              ›
            </button>
          </div>

          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {monthsToRender.map((monthDate) => {
              const grid = buildCalendarGrid(monthDate);
              const label = monthDate.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
              return (
                <div key={label} style={{ flex: "1 1 260px" }}>
                  <div style={{ textTransform: "capitalize", fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>{label}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, fontSize: "0.75rem", color: "#94a3b8", marginBottom: 6 }}>
                    {["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"].map((day) => (
                      <div key={day} style={{ textAlign: "center" }}>{day}</div>
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                    {grid.map((day) => {
                      const isCurrentMonth = day.getMonth() === monthDate.getMonth();
                      const selectedStart = tempRange.start && isSameDay(day, tempRange.start);
                      const selectedEnd = tempRange.end && isSameDay(day, tempRange.end);
                      const inRange = isBetween(day, tempRange.start, tempRange.end);
                      return (
                        <button
                          key={`${label}-${day.toISOString()}`}
                          type="button"
                          onClick={() => handleDayClick(day)}
                          style={{
                            height: 40,
                            borderRadius: selectedStart || selectedEnd ? 12 : 8,
                            border: "none",
                            cursor: "pointer",
                            fontWeight: selectedStart || selectedEnd ? 700 : 500,
                            background: selectedStart || selectedEnd
                              ? "linear-gradient(135deg, #2563eb, #ec4899)"
                              : inRange
                                ? "rgba(37,99,235,0.1)"
                                : "transparent",
                            color: selectedStart || selectedEnd
                              ? "white"
                              : isCurrentMonth
                                ? "#0f172a"
                                : "#cbd5f5"
                          }}
                        >
                          {day.getDate()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
            <button
              type="button"
              onClick={clearRange}
              style={{
                border: "none",
                background: "transparent",
                color: "#ef4444",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                border: "none",
                background: "linear-gradient(135deg, #2563eb, #ec4899)",
                color: "white",
                padding: "10px 28px",
                borderRadius: 999,
                cursor: "pointer",
                fontWeight: 700
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default function EmpresaDetalle() {
  const { id } = useParams();

  const [empresa, setEmpresa] = useState(null);
  const [grupos, setGrupos] = useState([]);

  const [form, setForm] = useState({
    nombre: "",
    cantidad_estudiantes: 0,
    cantidad_padres: 0,
    cantidad_guias: 0,
    fecha_entrada: "",
    fecha_salida: "",
    discos_compradas: 0,
    permite_alcohol: false,
    parque_acceso: false,
    parque_con_comida: false,
    pool_acceso: false,
    pool_con_comida: false,
  });

  const [editingGroup, setEditingGroup] = useState(null);

  // Form State for EDITING (separate from creation form to avoid conflicts)
  const [editForm, setEditForm] = useState({
    nombre: "",
    cantidad_estudiantes: 0,
    cantidad_padres: 0,
    cantidad_guias: 0,
    fecha_entrada: "",
    fecha_salida: "",
    discos_compradas: 0,
    permite_alcohol: false,
    parque_acceso: false,
    parque_con_comida: false,
    pool_acceso: false,
    pool_con_comida: false,
  });


  const cargar = useCallback(async () => {
    const e = await api.get(`/empresas/${id}`);
    setEmpresa(e.data);
    const g = await api.get(`/grupos/empresa/${id}`);
    setGrupos(g.data);
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function set(k, v) {
    setForm({ ...form, [k]: v });
  }

  function setEdit(k, v) {
    setEditForm({ ...editForm, [k]: v });
  }

  async function crearGrupo(e) {
    e.preventDefault();

    if (form.fecha_entrada && form.fecha_salida && form.fecha_salida <= form.fecha_entrada) {
      alert("❌ Error: La fecha de salida debe ser posterior a la fecha de entrada.");
      return;
    }

    await api.post("/grupos", {
      ...form,
      empresa_id: id,
    });

    alert("Grupo creado");
    setForm({
      nombre: "",
      cantidad_estudiantes: 0,
      cantidad_padres: 0,
      cantidad_guias: 0,
      fecha_entrada: "",
      fecha_salida: "",
      discos_compradas: 0,
      permite_alcohol: false,
      parque_acceso: false,
      parque_con_comida: false,
      pool_acceso: false,
      pool_con_comida: false,
    });

    cargar();
  }

  function handleEditClick(g) {
    setEditingGroup(g);
    setEditForm({
      nombre: g.nombre,
      cantidad_estudiantes: g.cantidad_estudiantes,
      cantidad_padres: g.cantidad_padres,
      cantidad_guias: g.cantidad_guias,
      fecha_entrada: g.fecha_entrada,
      fecha_salida: g.fecha_salida,
      discos_compradas: g.discos_compradas,
      permite_alcohol: g.permite_alcohol,
      parque_acceso: g.parque_acceso,
      parque_con_comida: g.parque_con_comida,
      pool_acceso: g.pool_acceso,
      pool_con_comida: g.pool_con_comida,
    });
  }

  async function guardarEdicion(e) {
    e.preventDefault();

    if (editForm.fecha_entrada && editForm.fecha_salida && editForm.fecha_salida <= editForm.fecha_entrada) {
      alert("❌ Error: La fecha de salida debe ser posterior a la fecha de entrada.");
      return;
    }

    try {
      await api.put(`/grupos/${editingGroup.id}`, {
        ...editForm,
        empresa_id: id // Mantener empresa
      });
      alert("Grupo actualizado");
      setEditingGroup(null);
      cargar();
    } catch (error) {
      alert("Error al actualizar");
    }
  }

  async function eliminarGrupo(grupoId) {
    if (!window.confirm("¿Estás seguro de eliminar este grupo? Se borrarán también sus vouchers y asignaciones relacionadas.")) return;
    try {
      await api.delete(`/grupos/${grupoId}`);
      alert("Grupo eliminado");
      cargar();
    } catch (error) {
      alert("Error al eliminar el grupo");
    }
  }

  if (!empresa) return <p>Cargando...</p>;

  return (
    <div style={{ padding: 20, maxWidth: 900 }}>
      <h2>{empresa.nombre}</h2>

      {/* ================= NUEVO GRUPO ================= */}
      <h3>Nuevo Grupo</h3>

      <form
        onSubmit={crearGrupo}
        style={{
          display: "grid",
          gap: 14,
          padding: 18,
          border: "1px solid #ddd",
          borderRadius: 8,
          marginBottom: 30,
          background: "#fafafa",
        }}
      >
        {/* ================= NOMBRE ================= */}
        <div>
          <label>Nombre del grupo</label>
          <input
            style={{ width: "100%" }}
            value={form.nombre}
            onChange={(e) => set("nombre", e.target.value)}
          />
        </div>

        {/* ================= PAX breakdown ================= */}
        <div style={{ display: "flex", gap: 10 }}>
          <div>
            <label>Estudiantes</label>
            <input
              type="number"
              style={{ width: 80 }}
              value={form.cantidad_estudiantes}
              onChange={(e) => set("cantidad_estudiantes", e.target.value)}
            />
          </div>
          <div>
            <label>Padres</label>
            <input
              type="number"
              style={{ width: 80 }}
              value={form.cantidad_padres}
              onChange={(e) => set("cantidad_padres", e.target.value)}
            />
          </div>
          <div>
            <label>Guias</label>
            <input
              type="number"
              style={{ width: 80 }}
              value={form.cantidad_guias}
              onChange={(e) => set("cantidad_guias", e.target.value)}
            />
          </div>
        </div>

        {/* ================= DISCOS ================= */}
        <div style={{ display: "flex", gap: 20 }}>
          <div>

            <div>
              <label>Discos</label>
              <input
                type="number"
                value={form.discos_compradas}
                onChange={(e) => set("discos_compradas", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ================= FECHAS ================= */}
        <DateRangeField
          label="Fechas del viaje"
          start={form.fecha_entrada}
          end={form.fecha_salida}
          onStartChange={(value) => set("fecha_entrada", value)}
          onEndChange={(value) => set("fecha_salida", value)}
        />

        {/* ================= ALCOHOL ================= */}
        <label>
          <input
            type="checkbox"
            checked={form.permite_alcohol}
            onChange={(e) => set("permite_alcohol", e.target.checked)}
          />
          Permite alcohol
        </label>

        {/* ================= PARQUE ================= */}
        <fieldset style={{ padding: 10 }}>
          <legend>Parque</legend>

          <label>
            <input
              type="checkbox"
              checked={form.parque_acceso}
              onChange={(e) => set("parque_acceso", e.target.checked)}
            />
            Acceso
          </label>

          <label style={{ marginLeft: 20 }}>
            <input
              type="checkbox"
              checked={form.parque_con_comida}
              onChange={(e) => set("parque_con_comida", e.target.checked)}
            />
            Con comida
          </label>
        </fieldset>

        {/* ================= POOL ================= */}
        <fieldset style={{ padding: 10 }}>
          <legend>Pool Party</legend>

          <label>
            <input
              type="checkbox"
              checked={form.pool_acceso}
              onChange={(e) => set("pool_acceso", e.target.checked)}
            />
            Acceso
          </label>

          <label style={{ marginLeft: 20 }}>
            <input
              type="checkbox"
              checked={form.pool_con_comida}
              onChange={(e) => set("pool_con_comida", e.target.checked)}
            />
            Con comida
          </label>
        </fieldset>

        <button>Crear grupo</button>
      </form>

      {/* ================= LISTA GRUPOS ================= */}
      <h3>Grupos</h3>

      {grupos.map((g) => (
        <div
          key={g.id}
          style={{
            border: "1px solid #ddd",
            padding: 10,
            marginBottom: 8,
            borderRadius: 6,
            background: "#fff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <div>
            <b>{g.nombre}</b> — {g.cantidad_estudiantes} est | {g.cantidad_padres} pdr | {g.cantidad_guias} guia ({g.cantidad_pax} total)<br />
            <small>{g.fecha_entrada} → {g.fecha_salida}</small>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => handleEditClick(g)} style={{ padding: "5px 10px", fontSize: "0.8rem", cursor: "pointer" }}>
              Editar
            </button>
            <button
              onClick={() => eliminarGrupo(g.id)}
              style={{ padding: "5px 10px", fontSize: "0.8rem", background: "#fef2f2", color: "#ef4444", border: "1px solid #fee2e2", borderRadius: 4, cursor: "pointer" }}
            >
              Eliminar
            </button>
          </div>
        </div>
      ))}

      {/* ================= MODAL EDITAR ================= */}
      {editingGroup && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999
        }}>
          <div style={{
            background: "white", padding: 20, borderRadius: 8, width: 500, maxHeight: "90vh", overflowY: "auto"
          }}>
            <h3>Editar Grupo</h3>
            <form onSubmit={guardarEdicion} style={{ display: "grid", gap: 10 }}>

              {/* COPY PASTE OF FORM INPUTS LINKED TO editForm / setEdit */}
              <div>
                <label>Nombre</label>
                <input style={{ width: "100%" }} value={editForm.nombre} onChange={e => setEdit("nombre", e.target.value)} />
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <label>Est: <input type="number" style={{ width: 50 }} value={editForm.cantidad_estudiantes} onChange={e => setEdit("cantidad_estudiantes", e.target.value)} /></label>
                <label>Pdr: <input type="number" style={{ width: 50 }} value={editForm.cantidad_padres} onChange={e => setEdit("cantidad_padres", e.target.value)} /></label>
                <label>Gui: <input type="number" style={{ width: 50 }} value={editForm.cantidad_guias} onChange={e => setEdit("cantidad_guias", e.target.value)} /></label>
              </div>

              <div>
                <label>Discos: <input type="number" value={editForm.discos_compradas} onChange={e => setEdit("discos_compradas", e.target.value)} /></label>
              </div>

              <DateRangeField
                label="Fechas"
                start={editForm.fecha_entrada}
                end={editForm.fecha_salida}
                onStartChange={(value) => setEdit("fecha_entrada", value)}
                onEndChange={(value) => setEdit("fecha_salida", value)}
                compact
              />

              <label><input type="checkbox" checked={editForm.permite_alcohol} onChange={e => setEdit("permite_alcohol", e.target.checked)} /> Alcohol</label>

              <div style={{ border: "1px solid #eee", padding: 5 }}>
                <b>Parque:</b>
                <label><input type="checkbox" checked={editForm.parque_acceso} onChange={e => setEdit("parque_acceso", e.target.checked)} /> Acceso</label>
                <label style={{ marginLeft: 10 }}><input type="checkbox" checked={editForm.parque_con_comida} onChange={e => setEdit("parque_con_comida", e.target.checked)} /> Comida</label>
              </div>

              <div style={{ border: "1px solid #eee", padding: 5 }}>
                <b>Pool:</b>
                <label><input type="checkbox" checked={editForm.pool_acceso} onChange={e => setEdit("pool_acceso", e.target.checked)} /> Acceso</label>
                <label style={{ marginLeft: 10 }}><input type="checkbox" checked={editForm.pool_con_comida} onChange={e => setEdit("pool_con_comida", e.target.checked)} /> Comida</label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setEditingGroup(null)} style={{ background: "gray", color: "white" }}>Cancelar</button>
                <button style={{ background: "blue", color: "white" }}>Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
