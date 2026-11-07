import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import TimelineCalendar from "../components/TimelineCalendar";
import MobileDayView from "../components/MobileDayView";
import api from "../api";
import { getServiciosDisponibles, isEventoMatch } from "../utils/eventUtils";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export default function AdminCalendar() {
  const [searchParams] = useSearchParams();
  const fechaParam = searchParams.get("fecha") || searchParams.get("date");

  // Parsear fecha del parámetro URL (si proviene de notificación push o enlace directo)
  const targetDate = useMemo(() => {
    if (!fechaParam) return null;
    const clean = fechaParam.trim();
    const parts = clean.split("-");
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return new Date(y, m, d, 0, 0, 0);
      }
    }
    const parsed = new Date(clean);
    return isNaN(parsed.getTime()) ? null : parsed;
  }, [fechaParam]);

  const [resources, setResources] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [calendarApi, setCalendarApi] = useState(null);
  const role = localStorage.getItem("auth_role");
  const readOnly = role === "calendar" || role === "equipo";

  const handleRegisterRef = useCallback((api) => {
    setCalendarApi(api);
  }, []);

  const now = new Date();
  const [mesSeleccionado, setMesSeleccionado] = useState(() => targetDate ? targetDate.getMonth() : now.getMonth());
  const [anioSeleccionado, setAnioSeleccionado] = useState(() => targetDate ? targetDate.getFullYear() : now.getFullYear());
  const [filtroAlcohol, setFiltroAlcohol] = useState("global");
  const [filtroEmpresa, setFiltroEmpresa] = useState("todas");
  const [filtroServicio, setFiltroServicio] = useState("todos");
  const [showFiltros, setShowFiltros] = useState(true);

  const aniosDisponibles = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const list = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
    if (anioSeleccionado && !list.includes(anioSeleccionado)) {
      list.push(anioSeleccionado);
      list.sort((a, b) => a - b);
    }
    return list;
  }, [anioSeleccionado]);

  // Si cambia la fecha del parámetro URL (por ejemplo al tocar una notificación), navegar al mes y día
  useEffect(() => {
    if (targetDate) {
      const m = targetDate.getMonth();
      const y = targetDate.getFullYear();
      setMesSeleccionado(m);
      setAnioSeleccionado(y);
      if (calendarApi) {
        calendarApi.navegarAMes(new Date(y, m, 1));
        calendarApi.irAFecha(targetDate);
      }
    }
  }, [targetDate, calendarApi]);

  const navegarAlMes = (mes, anio) => {
    setMesSeleccionado(mes);
    setAnioSeleccionado(anio);
    calendarApi?.navegarAMes(new Date(anio, mes, 1));
  };

  const volverAHoy = () => {
    const hoy = new Date();
    navegarAlMes(hoy.getMonth(), hoy.getFullYear());
  };

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

  // Lista de servicios/lugares únicos derivada de los eventos
  const serviciosDisponibles = useMemo(() => {
    return getServiciosDisponibles(events);
  }, [events]);

  // Filtrado de recursos (empresas y grupos)
  const filteredResources = useMemo(() => {
    // IDs de resources (grupos) que tienen al menos una asignación del servicio filtrado
    const resourcesConServicio = filtroServicio !== "todos"
      ? new Set(
          events
            .filter(evt => isEventoMatch(evt, filtroServicio))
            .map(evt => String(evt.resourceId))
        )
      : null;

    // Grupos que cumplen con TODOS los filtros activos
    const validGroupIds = new Set();
    resources.forEach(res => {
      if (!res.parentId) return; // Solo grupos (hijos de empresas)

      // 1. Filtro por empresa
      if (filtroEmpresa !== "todas") {
        const empresaResourceId = `empresa-${filtroEmpresa}`;
        if (res.parentId !== empresaResourceId) return;
      }

      // 2. Filtro alcohol
      if (filtroAlcohol !== "global") {
        if (filtroAlcohol === "con-alcohol" && (!res.extendedProps?.permite_alcohol || res.extendedProps?.es_mix_grupo)) return;
        if (filtroAlcohol === "sin-alcohol" && (res.extendedProps?.permite_alcohol || res.extendedProps?.es_mix_grupo)) return;
        if (filtroAlcohol === "mix-alcohol" && !res.extendedProps?.es_mix_grupo) return;
      }

      // 3. Filtro por servicio/evento (muestra grupos con y sin campamento, con horario, etc.)
      if (resourcesConServicio !== null) {
        if (!resourcesConServicio.has(String(res.id))) return;
      }

      validGroupIds.add(String(res.id));
    });

    return resources.filter(res => {
      // Siempre mantener la fila de eventos globales
      if (res.id === "servicios-parent" || String(res.id).startsWith("servicio-")) return true;

      // Si es grupo: verificar si quedó como válido
      if (res.parentId) {
        return validGroupIds.has(String(res.id));
      }

      // Si es empresa: verificar si tiene al menos un grupo válido que coincida con todos los filtros
      if (res.extendedProps?.esEmpresa) {
        if (filtroEmpresa !== "todas" && res.id !== `empresa-${filtroEmpresa}`) return false;
        const empresaResourceId = res.id;
        return resources.some(child =>
          child.parentId === empresaResourceId && validGroupIds.has(String(child.id))
        );
      }

      return true;
    });
  }, [resources, events, filtroAlcohol, filtroEmpresa, filtroServicio]);

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
            {/* Navegación rápida por mes */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#475569" }}>Ir a:</label>
              <select
                value={mesSeleccionado}
                onChange={(e) => navegarAlMes(Number(e.target.value), anioSeleccionado)}
                title="Seleccionar mes"
                style={{
                  fontSize: "0.82rem",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  outline: "none",
                  background: "white",
                  color: "#334155",
                }}
              >
                {MESES.map((mes, indice) => (
                  <option key={mes} value={indice}>{mes}</option>
                ))}
              </select>
              <select
                value={anioSeleccionado}
                onChange={(e) => navegarAlMes(mesSeleccionado, Number(e.target.value))}
                title="Seleccionar año"
                style={{
                  fontSize: "0.82rem",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  outline: "none",
                  background: "white",
                  color: "#334155",
                }}
              >
                {aniosDisponibles.map((anio) => (
                  <option key={anio} value={anio}>{anio}</option>
                ))}
              </select>
              <button
                onClick={volverAHoy}
                title="Volver al mes actual"
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "#1d4ed8",
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: "6px",
                  padding: "4px 8px",
                  cursor: "pointer",
                }}
              >
                Hoy
              </button>
            </div>

            {/* Separador */}
            <div style={{ width: 1, height: 20, background: "#cbd5e1" }} />

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

            {/* Filtro por servicio/lugar */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#475569" }}>Evento:</label>
              <select
                value={filtroServicio}
                onChange={(e) => setFiltroServicio(e.target.value)}
                style={{
                  fontSize: "0.82rem",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  outline: "none",
                  maxWidth: "180px",
                  background: filtroServicio !== "todos" ? "#fef3c7" : "white",
                  color: filtroServicio !== "todos" ? "#92400e" : "#334155",
                  fontWeight: filtroServicio !== "todos" ? 700 : 400,
                }}
              >
                <option value="todos">Todos los eventos</option>
                {serviciosDisponibles.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {filtroServicio !== "todos" && (
                <button
                  onClick={() => setFiltroServicio("todos")}
                  title="Quitar filtro de evento"
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
        <MobileDayView 
          resources={filteredResources} 
          events={events} 
          loading={loading} 
          initialDate={targetDate}
          filtroServicio={filtroServicio}
        />
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
            onRecargar={cargar}
            targetDate={targetDate}
            filtroServicio={filtroServicio}
          />
        </div>
      )}
    </div>
  );
}
