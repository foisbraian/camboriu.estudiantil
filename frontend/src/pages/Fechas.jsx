import { useState, useEffect } from "react";
import api from "../api";

export default function Fechas() {
  const [eventos, setEventos] = useState([]);
  const [evento_id, setEvento] = useState("");
  const [fecha, setFecha] = useState("");
  const [alcohol, setAlcohol] = useState(false);

  // Cargar eventos al montar el componente
  useEffect(() => {
    cargarEventos();
  }, []);

  async function cargarEventos() {
    try {
      const response = await api.get("/eventos/");
      setEventos(response.data);
      
      // Seleccionar el primer evento por defecto si hay eventos
      if (response.data.length > 0) {
        setEvento(response.data[0].id);
      }
    } catch (error) {
      console.error("Error cargando eventos:", error);
      alert("Error al cargar eventos");
    }
  }

  async function crear() {
    if (!evento_id) {
      alert("Selecciona un evento");
      return;
    }
    
    if (!fecha) {
      alert("Selecciona una fecha");
      return;
    }

    try {
      await api.post("/eventos/fecha/", {
        evento_id: Number(evento_id),
        fecha,
        con_alcohol: alcohol,
      });

      alert("Fecha creada");
      
      // Limpiar formulario
      setFecha("");
      setAlcohol(false);
    } catch (error) {
      console.error("Error creando fecha:", error);
      alert("Error al crear fecha");
    }
  }

  return (
    <div>
      <h2>Crear Fecha Evento</h2>

      <select 
        value={evento_id} 
        onChange={(e) => setEvento(e.target.value)}
        style={{ marginRight: "10px" }}
      >
        <option value="">Selecciona un evento</option>
        {eventos.map((evento) => (
          <option key={evento.id} value={evento.id}>
            {evento.nombre} ({evento.tipo})
          </option>
        ))}
      </select>

      <input 
        type="date" 
        value={fecha}
        onChange={(e) => setFecha(e.target.value)} 
      />

      <label>
        Alcohol
        <input 
          type="checkbox" 
          checked={alcohol}
          onChange={(e) => setAlcohol(e.target.checked)} 
        />
      </label>

      <button onClick={crear}>Crear</button>
    </div>
  );
}