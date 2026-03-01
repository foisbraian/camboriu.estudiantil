import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import api from "../api";

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
        <div style={{ display: "flex", gap: 20 }}>
          <div>
            <label>Fecha entrada</label>
            <input
              type="date"
              value={form.fecha_entrada}
              onChange={(e) => set("fecha_entrada", e.target.value)}
            />
          </div>

          <div>
            <label>Fecha salida</label>
            <input
              type="date"
              value={form.fecha_salida}
              onChange={(e) => set("fecha_salida", e.target.value)}
            />
          </div>
        </div>

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

          <button onClick={() => handleEditClick(g)} style={{ padding: "5px 10px", fontSize: "0.8rem" }}>
            Editar
          </button>
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

              <div style={{ display: "flex", gap: 10 }}>
                <label>Entrada: <input type="date" value={editForm.fecha_entrada} onChange={e => setEdit("fecha_entrada", e.target.value)} /></label>
                <label>Salida: <input type="date" value={editForm.fecha_salida} onChange={e => setEdit("fecha_salida", e.target.value)} /></label>
              </div>

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
