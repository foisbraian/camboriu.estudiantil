import { useEffect, useState, useCallback, useMemo } from "react";
import TimelineCalendar from "../components/TimelineCalendar";
import MobileDayView from "../components/MobileDayView";
import api from "../api";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export default function AdminCalendar() {
  const [resources, setResources] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [calendarApi, setCalendarApi] = useState(null);
  const role = localStorage.getItem("auth_role");
  const readOnly = role === "calendar";

  const handleRegisterRef = useCallback((api) => {
    setCalendarApi(api);
  }, []);

  const now = new Date();
  const [mesSeleccionado, setMesSeleccionado] = useState(now.getMonth());
  const [anioSeleccionado, setAnioSeleccionado] = useState(now.getFullYear());
  const [filtroAlcohol, setFiltroAlcohol] = useState("global");

  // Filtrado de recursos (empresas y grupos)
  const filteredResources = useMemo(() => {
    if (filtroAlcohol === "global") return resources;

    return resources.filter(res => {
      // Siempre mantener la fila de eventos globales y resumenes
      if (res.id === "eventos") return true;

      // Si es un grupo (tiene parentId)
      if (res.parentId) {
        if (filtroAlcohol === "con-alcohol") {
          return res.extendedProps?.permite_alcohol === true;
        } else if (filtroAlcohol === "sin-alcohol") {
          return res.extendedProps?.permite_alcohol === false;
        }
      }

      // Si es una empresa (no tiene parentId, pero no es "eventos")
      // Mostrar solo si tiene algun grupo que coincida con el filtro
      if (res.extendedProps?.esEmpresa) {
        const hasChildren = resources.some(child =>
          child.parentId === res.id &&
          ((filtroAlcohol === "con-alcohol" && child.extendedProps?.permite_alcohol === true) ||
           (filtroAlcohol === "sin-alcohol" && child.extendedProps?.permite_alcohol === false))
        );
        return hasChildren;
      }

      return true;
    });
  }, [resources, filtroAlcohol]);

  // No ocultar más el menú aquí, ya que el Layout lo maneja
  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    const detect = () => {
      if (typeof window === "undefined") return;
      const matches = window.matchMedia("(max-width: 900px)").matches;
      const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
      const uaMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      setIsMobile(matches || uaMobile);
    };

    detect();
    window.addEventListener("resize", detect);
    return () => window.removeEventListener("resize", detect);
  }, []);

  // Escuchar evento de descarga desde el Layout
  useEffect(() => {
    const handleDescargar = (e) => {
      const { mes, anio } = e.detail;
      setMesSeleccionado(mes);
      setAnioSeleccionado(anio);

      if (calendarApi) {
        const primerDia = new Date(anio, mes, 1);
        calendarApi.navegarAMes(primerDia);
      }
      setTimeout(() => window.print(), 400);
    };

    window.addEventListener("descargarPDF", handleDescargar);
    return () => window.removeEventListener("descargarPDF", handleDescargar);
  }, [calendarApi]);


  async function cargar() {
    try {
      setLoading(true);
      const res = await api.get("/calendario/");
      setResources(res.data.resources);
      setEvents(res.data.events);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      
      {/* Control Filtrado flotante o header */}
      <div 
        className="hide-on-print"
        style={{ 
          position: "absolute", 
          top: "10px", 
          right: "20px", 
          zIndex: 10,
          background: "white",
          padding: "6px 12px",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}
      >
        <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#334155" }}>Filtro:</label>
        <select 
          value={filtroAlcohol} 
          onChange={(e) => setFiltroAlcohol(e.target.value)}
          style={{ 
            fontSize: "0.85rem", 
            padding: "4px 8px", 
            borderRadius: "4px", 
            border: "1px solid #cbd5e1",
            outline: "none"
          }}
        >
          <option value="global">Global (Todos)</option>
          <option value="con-alcohol">Con Alcohol</option>
          <option value="sin-alcohol">Sin Alcohol</option>
        </select>
      </div>

      {isMobile ? (
        <MobileDayView resources={filteredResources} events={events} loading={loading} />
      ) : (
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <div id="print-title" style={{ display: "none" }}>
            <h2 style={{ margin: "0 0 8px 0", fontSize: "1.4rem" }}>
              Calendario — {MESES[mesSeleccionado]} {anioSeleccionado}
            </h2>
          </div>

          <TimelineCalendar
            onRegisterRef={handleRegisterRef}
            resources={filteredResources}
            events={events}
            readOnly={readOnly}
          />
        </div>
      )}
    </div>
  );
}
