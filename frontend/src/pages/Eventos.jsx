import { useState, useEffect } from "react";
import api from "../api";

export default function Eventos() {
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("DISCO");
  const [capacidad, setCapacidad] = useState(0);
  const [lista, setLista] = useState([]);
  const role = localStorage.getItem("auth_role");
  const readOnly = role === "calendar";

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    const res = await api.get("/eventos/");
    setLista(res.data);
  }

  async function crear() {
    if (readOnly) return;
    await api.post("/eventos/", {
      nombre,
      tipo,
      capacidad_maxima: Number(capacidad),
    });
    alert("Evento creado");
    cargar();
  }

  async function eliminar(id) {
    if (readOnly) return;
    if (!window.confirm("¿Seguro de eliminar? Se borrarán todas las fechas y asignaciones de este evento.")) return;
    try {
      await api.delete(`/eventos/${id}`);
      cargar();
    } catch (e) {
      alert("Error al eliminar");
    }
  }

  return (
    <div style={{ padding: "40px 20px", maxWidth: "800px" }}>
      {readOnly && (
        <p style={{ background: "#e0f2fe", padding: 12, borderRadius: 8, color: "#0c4a6e" }}>
          Estás viendo los eventos en modo solo lectura.
        </p>
      )}

      {!readOnly && (
        <div>
          <h2>Crear Evento</h2>

          <input placeholder="Nombre" onChange={(e) => setNombre(e.target.value)} />

          <select onChange={(e) => setTipo(e.target.value)}>
            <option value="DISCO">Disco</option>
            <option value="PARQUE">Parque</option>
            <option value="POOL">Pool</option>
            <option value="CENA">Cena de velas</option>
          </select>

          <input
            type="number"
            placeholder="Capacidad"
            onChange={(e) => setCapacidad(e.target.value)}
          />

          <button onClick={crear}>Crear</button>
        </div>
      )}

      <div style={{ marginTop: 40 }}>
        <h3>Listado de Eventos</h3>
        <table border="1" cellPadding="10" style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Capacidad</th>
              {!readOnly && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {lista.map((ev) => (
              <tr key={ev.id}>
                <td>{ev.id}</td>
                <td>{ev.nombre}</td>
                <td>{ev.tipo}</td>
                <td>{ev.capacidad_maxima}</td>
                {!readOnly && (
                  <td>
                    <button style={{ background: "red", color: "white" }} onClick={() => eliminar(ev.id)}>
                      Eliminar
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
