import { useState } from "react";
import api from "../api";

export default function Asignaciones() {
  const [grupo, setGrupo] = useState("");
  const [fecha, setFecha] = useState("");

  async function asignar() {
    await api.post("/asignaciones/", {
      grupo_id: grupo,
      fecha_evento_id: fecha,
    });

    alert("Asignado");
  }

  return (
    <div>
      <h2>Asignar Grupo a Evento</h2>

      <input placeholder="grupo id" onChange={(e) => setGrupo(e.target.value)} />
      <input placeholder="fecha_evento id" onChange={(e) => setFecha(e.target.value)} />

      <button onClick={asignar}>Asignar</button>
    </div>
  );
}
