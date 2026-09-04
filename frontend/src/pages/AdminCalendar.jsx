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
  const [filtroEmpresa, setFiltroEmpresa] = useState("todas");
  const [showFiltros, setShowFiltros] = useState(true);

  // Lista de empresas derivada de los resources
  const empresas = useMemo(() => {
    return resources
      .filter(r => r.extendedProps?.esEmpresa)
      .sort((a, b) => {
        const nombreA = (a.extendedProps?.empresaNombre || a.title || "").toLowerCase();
        const nombreB = (b.extendedProps?.empresaNombre || b.title || "").toLowerCase();
        return nombreA.localeCompare(nombreB, "es");
      });
  }, [resources]);

  // Filtrado de recursos (empresas y grupos)
  const filteredResources = useMemo(() => {
    return resources.filter(res => {
      // Siempre mantener la fila de eventos globales
      if (res.id === "servicios-parent" || String(res.id).startsWith("servicio-")) return true;

      // Filtro por empresa
      if (filtroEmpresa !== "todas") {
        const empresaResourceId = `empresa-${filtroEmpresa}`;
        // Ocultar otras empresas
        if (res.extendedProps?.esEmpresa && res.id !== empresaResourceId) return false;
        // Ocultar grupos de otras empresas
        if (res.parentId && res.parentId !== empresaResourceId) return false;
      }

      // Filtro alcohol (sobre los grupos que quedaron)
      if (filtroAlcohol !== "global") {
        if (res.parentId) {
          if (filtroAlcohol === "con-alcohol") return res.extendedProps?.permite_alcohol === true && !res.extendedProps?.es_mix_grupo;
          if (filtroAlcohol === "sin-alcohol") return res.extendedProps?.permite_alcohol === false && !res.extendedProps?.es_mix_grupo;
          if (filtroAlcohol === "mix-alcohol") return res.extendedProps?.es_mix_grupo === true;
        }
        if (res.extendedProps?.esEmpresa) {
          const empresaResourceId = res.id;
          const hasChildren = resources.some(child =>
            child.parentId === empresaResourceId &&
            ((filtroAlcohol === "con-alcohol" && child.extendedProps?.permite_alcohol === true && !child.extendedProps?.es_mix_grupo) ||
             (filtroAlcohol === "sin-alcohol" && child.extendedProps?.permite_alcohol === false && !child.extendedProps?.es_mix_grupo) ||
             (filtroAlcohol === "mix-alcohol" && child.extendedProps?.es_mix_grupo === true))
          );
          return hasChildren;
        }
      }

      return true;
    });
  }, [resources, filtroAlcohol, filtroEmpresa]);

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
      
      {/* Control Filtrado Superior (Inline / Collapsible) */}
      {showFiltros ? (
        <div 
          className="hide-on-print"
          style={{ 
            background: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Filtros Activos</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {/* Filtro por empresa */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#475569" }}>Empresa:</label>
              <select 
                value={filtroEmpresa} 
                onChange={(e) => setFiltroEmpresa(e.target.value)}
                style={{ 
                  fontSize: "0.82rem", 
                  padding: "4px 8px", 
                  borderRadius: "6px", 
                  border: "1px solid #cbd5e1",
                  outline: "none",
                  maxWidth: "160px",
                  background: filtroEmpresa !== "todas" ? "#eff6ff" : "white",
                  color: filtroEmpresa !== "todas" ? "#1d4ed8" : "#334155",
                  fontWeight: filtroEmpresa !== "todas" ? 700 : 400,
                }}
              >
                <option value="todas">Todas</option>
                {empresas.map(e => (
                  <option key={e.id} value={e.extendedProps?.empresaId}>
                    {e.extendedProps?.empresaNombre || e.title}
                  </option>
                ))}
              </select>
              {filtroEmpresa !== "todas" && (
                <button
                  onClick={() => setFiltroEmpresa("todas")}
                  title="Quitar filtro de empresa"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    color: "#94a3b8",
                    padding: "0 2px",
                    lineHeight: 1,
                  }}
                >✕</button>
              )}
            </div>

            {/* Separador */}
            <div style={{ width: 1, height: 20, background: "#cbd5e1" }} />

            {/* Filtro alcohol */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#475569" }}>Alcohol:</label>
              <select 
                value={filtroAlcohol} 
                onChange={(e) => setFiltroAlcohol(e.target.value)}
                style={{ 
                  fontSize: "0.82rem", 
                  padding: "4px 8px", 
                  borderRadius: "6px", 
                  border: "1px solid #cbd5e1",
                  outline: "none",
                  background: filtroAlcohol !== "global" ? "#eff6ff" : "white",
                  color: filtroAlcohol !== "global" ? "#1d4ed8" : "#334155",
                  fontWeight: filtroAlcohol !== "global" ? 700 : 400,
                }}
              >
                <option value="global">Todos</option>
                <option value="con-alcohol">Con Alcohol</option>
                <option value="mix-alcohol">Mix (Pulsera)</option>
                <option value="sin-alcohol">Sin Alcohol</option>
              </select>
            </div>

            {/* Separador */}
            <div style={{ width: 1, height: 20, background: "#cbd5e1" }} />

            {/* Botón Ocultar */}
            <button
              onClick={() => setShowFiltros(false)}
              style={{
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "#64748b",
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                padding: "4px 10px",
                cursor: "pointer",
              }}
            >
              Ocultar
            </button>
          </div>
        </div>
      ) : (
        <button
          className="hide-on-print"
          onClick={() => setShowFiltros(true)}
          style={{
            position: "absolute",
            top: "12px",
            right: "20px",
            zIndex: 100,
            fontSize: "0.8rem",
            fontWeight: 600,
            color: "#1e293b",
            background: "white",
            border: "1px solid #cbd5e1",
            borderRadius: "6px",
            padding: "6px 12px",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          Mostrar Filtros
        </button>
      )}

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
