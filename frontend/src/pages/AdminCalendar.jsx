import { useEffect, useState, useCallback } from "react";
import TimelineCalendar from "../components/TimelineCalendar";
import api from "../api";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export default function AdminCalendar() {
  const [resources, setResources] = useState([]);
  const [events, setEvents] = useState([]);
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
    const res = await api.get("/calendario/");
    setResources(res.data.resources);
    setEvents(res.data.events);
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>

      {/* Título solo para imprimir */}
      <div id="print-title" style={{ display: "none" }}>
        <h2 style={{ margin: "0 0 8px 0", fontSize: "1.4rem" }}>
          Calendario — {MESES[mesSeleccionado]} {anioSeleccionado}
        </h2>
      </div>

      {/* El calendario ocupa toda la pantalla */}
      <TimelineCalendar
        onRegisterRef={handleRegisterRef}
        resources={resources}
        events={events}
        readOnly={readOnly}
      />
    </div>
  );
}
