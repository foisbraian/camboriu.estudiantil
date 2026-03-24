import { useState, useEffect } from "react";
import api from "../api";

export default function Eventos() {
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("DISCO");
  const [capacidad, setCapacidad] = useState(0);
  const [complejo, setComplejo] = useState("");
  const [lista, setLista] = useState([]);
  const [editId, setEditId] = useState(null);
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

  async function guardarCapacidad(id) {
    await api.put(`/eventos/${id}`, {
      capacidad_maxima: Number(editCapacidad),
      complejo: editComplejo.trim() || null,
    });
    setEditId(null);
    setEditCapacidad(0);
    setEditComplejo("");
    cargar();
  }

  return (
    <div style={{ padding: "40px 20px", maxWidth: "800px" }}>
      <h2>Crear Evento</h2>

      <input placeholder="Nombre" onChange={(e) => setNombre(e.target.value)} />

      <select onChange={(e) => setTipo(e.target.value)}>
        <option value="DISCO">Disco</option>
        <option value="PARQUE">Parque</option>
        <option value="POOL">Pool</option>
        <option value="CENA">Cena de velas</option>
        <option value="HIELO">Bar de hielo</option>
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
                <td>{ev.nombre}</td>
                <td>{ev.tipo}</td>
                <td>{ev.complejo || ""}</td>
                <td>
                  {editId === ev.id ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <input
                        type="number"
                        value={editCapacidad}
                        onChange={(e) => setEditCapacidad(e.target.value)}
                        style={{ width: 90 }}
                      />
                      {ev.tipo === "DISCO" && (
                        <input
                          placeholder="Complejo"
                          value={editComplejo}
                          onChange={(e) => setEditComplejo(e.target.value)}
                          style={{ width: 180 }}
                        />
                      )}
                    </div>
                  ) : (
                    ev.capacidad_maxima
                  )}
                </td>
                <td>
                  {editId === ev.id ? (
                    <>
                      <button onClick={() => guardarCapacidad(ev.id)}>Guardar</button>
                      <button
                        onClick={() => {
                          setEditId(null);
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
                        setEditCapacidad(ev.capacidad_maxima);
                        setEditComplejo(ev.complejo || "");
                      }}
                    >
                      Editar capacidad
                    </button>
                  )}
                  <button style={{ background: "red", color: "white" }} onClick={() => eliminar(ev.id)}>
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
