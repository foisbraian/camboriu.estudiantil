import { useEffect, useState } from "react";
import api from "../api";
import ResumenCalendarView from "../components/ResumenCalendarView";

const MESES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

const SEL = {
  fontSize: "0.75rem",
  padding: "2px 4px",
  borderRadius: 4,
  border: "1px solid #475569",
  outline: "none",
  background: "#334155",
  color: "#e2e8f0",
  cursor: "pointer",
};

export default function CalendarioResumen() {
  const [resources, setResources] = useState([]);
  const [events,    setEvents]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const now  = new Date();
  const [mes,  setMes]  = useState(now.getMonth());
  const [anio, setAnio] = useState(now.getFullYear());
  const anios = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  useEffect(() => { cargar(); }, []); // eslint-disable-line

  async function cargar() {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/calendario/resumen");
      setResources(res.data.resources);
      setEvents(res.data.events);
    } catch (e) {
      console.error("Error cargando resumen", e);
      setError("Error al cargar datos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="resumen-container"
      style={{
        display: "flex", flexDirection: "column",
        height: "100vh", overflow: "hidden",
        background: "#f8fafc",
      }}
    >
      {/* Controls bar (Compact) */}
      <div
        className="hide-on-print"
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "4px 8px",
          background: "#1e293b", borderBottom: "1px solid #334155",
          flexShrink: 0,
        }}
      >
        <span style={{ color: "#e2e8f0", fontWeight: 800, fontSize: "0.8rem", marginRight: 4 }}>
          📊 Resumen
        </span>

        <select value={mes} onChange={(e) => setMes(Number(e.target.value))} style={SEL}>
          {MESES.map((m, i) => (
            <option key={i} value={i} style={{ background: "#1e293b" }}>{m}</option>
          ))}
        </select>

        <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} style={SEL}>
          {anios.map((a) => (
            <option key={a} value={a} style={{ background: "#1e293b" }}>{a}</option>
          ))}
        </select>

        <button
          onClick={cargar}
          title="Actualizar datos"
          style={{
            background: "#2563eb", color: "white",
            border: "none", borderRadius: 4,
            padding: "2px 8px", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
          }}
        >
          ↻
        </button>

        <button
          onClick={() => window.print()}
          title="Imprimir / Exportar a PDF"
          style={{
            background: "#10b981", color: "white",
            border: "none", borderRadius: 4,
            padding: "2px 8px", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
            marginLeft: "auto"
          }}
        >
          🖨️ Imprimir
        </button>
      </div>

      {/* Content */}
      <div className="resumen-content" style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        <style>{`
          @media print {
            @page { size: landscape; margin: 10mm; }
            html, body, #root, .resumen-container {
              height: auto !important;
              min-height: auto !important;
              overflow: visible !important;
              background: white !important;
            }
            .hide-on-print { display: none !important; }
            .resumen-content {
              overflow: visible !important;
              position: static !important;
              display: block !important;
            }
            /* Forzar a que los navegadores impriman los colores de fondo */
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            /* Achicar tabla para que entre en una hoja */
            table {
              width: 100% !important;
              max-width: 100% !important;
            }
            th, td { padding: 1px !important; }
            /* Evitar cortes a la mitad de una fila */
            tr { page-break-inside: avoid; }
          }
        `}</style>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#64748b", fontSize: "0.9rem", gap: 8 }}>
            <span>⏳</span> Cargando...
          </div>
        ) : error ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#ef4444" }}>
            {error}
          </div>
        ) : (
          <ResumenCalendarView
            resources={resources}
            events={events}
            mes={mes}
            anio={anio}
          />
        )}
      </div>
    </div>
  );
}
