import { useState, useEffect } from "react";
import api from "../api";

export default function Eventos() {
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("DISCO");
  const [capacidad, setCapacidad] = useState(0);
  const [complejo, setComplejo] = useState("");
  const [lista, setLista] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editNombre, setEditNombre] = useState("");
  const [editCapacidad, setEditCapacidad] = useState(0);
  const [editComplejo, setEditComplejo] = useState("");

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    const res = await api.get("/eventos/");
    setLista(res.data);
  }

  async function crear() {
    await api.post("/eventos/", {
      nombre,
      tipo,
      capacidad_maxima: Number(capacidad),
      complejo: tipo === "DISCO" ? complejo.trim() || null : null,
    });
    alert("Evento creado");
    cargar();
  }

  async function eliminar(id) {
    if (!window.confirm("¿Seguro de eliminar? Se borrarán todas las fechas y asignaciones de este evento.")) return;
    try {
      await api.delete(`/eventos/${id}`);
      cargar();
    } catch (e) {
      alert("Error al eliminar");
    }
  }

  async function guardarEdicion(id) {
    if (!editNombre.trim()) {
      alert("El nombre no puede estar vacío");
      return;
    }
    try {
      await api.put(`/eventos/${id}`, {
        nombre: editNombre.trim(),
        capacidad_maxima: Number(editCapacidad),
        complejo: editComplejo.trim() || null,
      });
      setEditId(null);
      setEditNombre("");
      setEditCapacidad(0);
      setEditComplejo("");
      cargar();
    } catch (e) {
      alert("Error al actualizar evento");
    }
  }

  return (
    <div style={{ padding: "40px 20px", maxWidth: "800px" }}>
      <h2>Crear Evento</h2>

      <input
        placeholder="Nombre"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
      />

      <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
        <option value="DISCO">Disco</option>
        <option value="ZACARIAS">Zacarias</option>
        <option value="POOL">Cascata / Pool</option>
        <option value="MULTIPARQUE">Multiparque</option>
        <option value="PARADOR">Parador</option>
        <option value="HIELO">Bar de Hielo</option>
        <option value="CENA">Cena de Velas</option>
        <option value="CAMPAMENTO">Campamento Americano</option>
        <option value="BIENVENIDA">Bienvenida</option>
        <option value="SURF">Surf</option>
        <option value="UNIPRAIAS">Parque Unipraias</option>
        <option value="BETO">Beto Carrero</option>
        <option value="BARCO">Barco Pirata 🏴‍☠️</option>
        <option value="CRISTO">Cristo Luz</option>
        <option value="PARQUE">Parque (deprecated)</option>
        <option value="SUNSET">Sunset (deprecated)</option>
      </select>

      {tipo === "DISCO" && (
        <input
          placeholder="Complejo (ej: Greenvalley)"
          value={complejo}
          onChange={(e) => setComplejo(e.target.value)}
        />
      )}

      <input
        type="number"
        placeholder="Capacidad"
        value={capacidad || ""}
        onChange={(e) => setCapacidad(e.target.value)}
      />

      <button onClick={crear}>Crear</button>

      <div style={{ marginTop: 40 }}>
        <h3>Listado de Eventos</h3>
        <table border="1" cellPadding="10" style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Complejo</th>
              <th>Capacidad</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((ev) => (
              <tr key={ev.id}>
                <td>{ev.id}</td>
                <td>
                  {editId === ev.id ? (
                    <input
                      type="text"
                      value={editNombre}
                      onChange={(e) => setEditNombre(e.target.value)}
                      style={{ width: "100%", minWidth: 120, boxSizing: "border-box" }}
                      placeholder="Nombre del evento"
                    />
                  ) : (
                    ev.nombre
                  )}
                </td>
                <td>{ev.tipo}</td>
                <td>
                  {editId === ev.id ? (
                    ev.tipo === "DISCO" ? (
                      <input
                        placeholder="Complejo"
                        value={editComplejo}
                        onChange={(e) => setEditComplejo(e.target.value)}
                        style={{ width: "100%", minWidth: 140, boxSizing: "border-box" }}
                      />
                    ) : (
                      ev.complejo || ""
                    )
                  ) : (
                    ev.complejo || ""
                  )}
                </td>
                <td>
                  {editId === ev.id ? (
                    <input
                      type="number"
                      value={editCapacidad}
                      onChange={(e) => setEditCapacidad(e.target.value)}
                      style={{ width: 90 }}
                    />
                  ) : (
                    ev.capacidad_maxima
                  )}
                </td>
                <td>
                  {editId === ev.id ? (
                    <>
                      <button onClick={() => guardarEdicion(ev.id)}>Guardar</button>
                      <button
                        onClick={() => {
                          setEditId(null);
                          setEditNombre("");
                          setEditCapacidad(0);
                          setEditComplejo("");
                        }}
                        style={{ marginLeft: 6 }}
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setEditId(ev.id);
                        setEditNombre(ev.nombre || "");
                        setEditCapacidad(ev.capacidad_maxima);
                        setEditComplejo(ev.complejo || "");
                      }}
                    >
                      Editar
                    </button>
                  )}
                  <button style={{ background: "red", color: "white", marginLeft: 6 }} onClick={() => eliminar(ev.id)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
