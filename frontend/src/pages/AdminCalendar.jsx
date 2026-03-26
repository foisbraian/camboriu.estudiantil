import { useEffect, useState, useCallback } from "react";
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

  useEffect(() => {
    if (!calendarApi) return;
    calendarApi.navegarAMes(new Date());
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
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      {isMobile ? (
        <MobileDayView resources={resources} events={events} loading={loading} />
      ) : (
        <>
          <div id="print-title" style={{ display: "none" }}>
            <h2 style={{ margin: "0 0 8px 0", fontSize: "1.4rem" }}>
              Calendario — {MESES[mesSeleccionado]} {anioSeleccionado}
            </h2>
          </div>

          <TimelineCalendar
            onRegisterRef={handleRegisterRef}
            resources={resources}
            events={events}
            readOnly={readOnly}
          />
        </>
      )}
    </div>
  );
}
