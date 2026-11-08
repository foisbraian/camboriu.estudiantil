import { useState, useEffect } from "react";
import api from "../api";

export default function Fechas() {
  const [eventos, setEventos] = useState([]);
  const [evento_id, setEvento] = useState("");
  const [fecha, setFecha] = useState("");
  const [tipoAlcohol, setTipoAlcohol] = useState("sin");
  const [show, setShow] = useState("");
  const [animador, setAnimador] = useState("");

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

  const eventoObj = eventos.find((ev) => ev.id === Number(evento_id));
  const tipoEv = (eventoObj?.tipo || "").toUpperCase();
  const nomEv = (eventoObj?.nombre || "").toUpperCase();
  const esDisco = tipoEv === "DISCO" || nomEv.includes("DISCO") || nomEv.includes("BOLICHE");

  const permiteShowAnimador =
    esDisco ||
    tipoEv === "ZACARIAS" ||
    tipoEv === "PARADOR" ||
    tipoEv === "POOL" ||
    tipoEv === "CABRAL" ||
    nomEv.includes("ZACARIAS") ||
    nomEv.includes("PARADOR") ||
    nomEv.includes("CASCATA") ||
    nomEv.includes("CAROLINA") ||
    nomEv.includes("CABRAL");

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
        con_alcohol: tipoAlcohol === "con" || tipoAlcohol === "mix",
        es_mix_evento: tipoAlcohol === "mix",
        show: show.trim() || null,
        animador: animador.trim() || null,
      });

      alert("Fecha creada");
      
      // Limpiar formulario
      setFecha("");
      setTipoAlcohol("sin");
      setShow("");
      setAnimador("");
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

      {esDisco && (
        <label style={{ marginLeft: "10px" }}>
          Modalidad Alcohol:
          <select 
            value={tipoAlcohol}
            onChange={(e) => setTipoAlcohol(e.target.value)}
            style={{ marginLeft: "5px" }}
          >
            <option value="sin">🟡 Sin Alcohol</option>
            <option value="mix">🟠 Mix / Pulsera</option>
            <option value="con">🔴 Con Alcohol</option>
          </select>
        </label>
      )}

      {permiteShowAnimador && (
        <div style={{ marginTop: 12, padding: "10px 12px", background: "#f8fafc", borderRadius: 8, border: "1px dashed #94a3b8", maxWidth: 450 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1e293b" }}>
              🔒 Anotaciones Internas (Admin y Equipo)
            </span>
            <span style={{ fontSize: "0.72rem", background: "#e2e8f0", color: "#475569", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>
              No visible para empresas
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: "0.8rem", color: "#475569", fontWeight: 600 }}>
                🎤 Show:
              </label>
              <input
                type="text"
                placeholder="ej: Robot LED / Banda"
                value={show}
                onChange={(e) => setShow(e.target.value)}
                style={{ width: "100%", padding: "6px 8px", borderRadius: "5px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: "0.8rem", color: "#475569", fontWeight: 600 }}>
                🎧 Animador / DJ:
              </label>
              <input
                type="text"
                placeholder="ej: Animador Leo"
                value={animador}
                onChange={(e) => setAnimador(e.target.value)}
                style={{ width: "100%", padding: "6px 8px", borderRadius: "5px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
              />
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <button onClick={crear}>Crear</button>
      </div>
    </div>
  );
}