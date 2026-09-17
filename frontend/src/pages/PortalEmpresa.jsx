import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import TimelineCalendar from "../components/TimelineCalendar";
import MobileDayView from "../components/MobileDayView";
import api from "../api";

export default function PortalEmpresa() {
    const { codigo } = useParams();
    const [data, setData] = useState({ resources: [], events: [] });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(false);
    const [calendarApi, setCalendarApi] = useState(null);

    // Navegacion rapida por mes (solo desktop)
    const MESES_NAV = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    const nowNav = new Date();
    const [mesSeleccionado, setMesSeleccionado] = useState(nowNav.getMonth());
    const [anioSeleccionado, setAnioSeleccionado] = useState(nowNav.getFullYear());
    const aniosDisponibles = Array.from({ length: 5 }, (_, i) => nowNav.getFullYear() - 2 + i);

    const navegarAlMes = useCallback((mes, anio) => {
        setMesSeleccionado(mes);
        setAnioSeleccionado(anio);
        calendarApi?.navegarAMes(new Date(anio, mes, 1));
    }, [calendarApi]);

    const volverAHoy = useCallback(() => {
        const hoy = new Date();
        navegarAlMes(hoy.getMonth(), hoy.getFullYear());
    }, [navegarAlMes]);

    const portalEvents = useMemo(() => {
        const sourceEvents = Array.isArray(data.events) ? data.events : [];
        const globalEvents = sourceEvents.filter((event) => {
            const resourceId = String(event?.resourceId || "");
            return resourceId === "eventos" || resourceId.startsWith("servicio-");
        });

        if (globalEvents.length > 0) {
            return sourceEvents.map((event) => {
                const resourceId = String(event?.resourceId || "");
                if (!resourceId.startsWith("servicio-")) return event;
                return { ...event, resourceId: "eventos" };
            });
        }
        
        return sourceEvents;
    }, [data.events]);

    const cargar = useCallback(async () => {
        try {
            const res = await api.get(`/calendario/portal/${codigo}`);
            setData(res.data);
        } catch (err) {
            setError(err.response?.data?.detail || "Error al cargar el portal");
        } finally {
            setLoading(false);
        }
    }, [codigo]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    useEffect(() => {
        if (!calendarApi || !portalEvents.length) return;
        const sorted = [...portalEvents]
            .filter((ev) => ev?.start)
            .sort((a, b) => String(a.start).localeCompare(String(b.start)));
        if (!sorted.length) return;
        const firstDate = new Date(sorted[0].start);
        if (Number.isNaN(firstDate.getTime())) return;
        calendarApi.irAFecha(firstDate);
    }, [calendarApi, portalEvents]);

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

    if (loading) return <div style={{ padding: 20 }}>Cargando portal...</div>;
    if (error) return <div style={{ padding: 20, color: "red" }}>{error}</div>;


    return (
        <div style={{
            minHeight: "100vh",
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            background: "#f8fafc"
        }}>
            <h2 style={{
                textAlign: "center",
                margin: "10px 0",
                color: "#1e293b",
                fontSize: "1.1rem",
                fontWeight: 700
            }}>
                Portal de Empresa
            </h2>
            {/* The global services box has been removed as per user request to only show them in the corresponding calendar days in the header row */}
            {/* Barra de navegacion rapida -- solo visible en desktop */}
            {!isMobile && (
                <div style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    padding: "6px 16px",
                    background: "#f1f5f9",
                    borderBottom: "1px solid #e2e8f0",
                    flexShrink: 0,
                }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#475569" }}>
                        Ir al mes:
                    </span>
                    <select
                        value={mesSeleccionado}
                        onChange={(e) => navegarAlMes(Number(e.target.value), anioSeleccionado)}
                        style={{
                            fontSize: "0.82rem", padding: "4px 8px", borderRadius: "6px",
                            border: "1px solid #cbd5e1", outline: "none",
                            background: "white", color: "#334155", cursor: "pointer",
                        }}
                    >
                        {MESES_NAV.map((mes, i) => (
                            <option key={mes} value={i}>{mes}</option>
                        ))}
                    </select>
                    <select
                        value={anioSeleccionado}
                        onChange={(e) => navegarAlMes(mesSeleccionado, Number(e.target.value))}
                        style={{
                            fontSize: "0.82rem", padding: "4px 8px", borderRadius: "6px",
                            border: "1px solid #cbd5e1", outline: "none",
                            background: "white", color: "#334155", cursor: "pointer",
                        }}
                    >
                        {aniosDisponibles.map((anio) => (
                            <option key={anio} value={anio}>{anio}</option>
                        ))}
                    </select>
                    <button
                        onClick={volverAHoy}
                        style={{
                            fontSize: "0.8rem", fontWeight: 600, color: "#1d4ed8",
                            background: "#eff6ff", border: "1px solid #bfdbfe",
                            borderRadius: "6px", padding: "4px 10px", cursor: "pointer",
                        }}
                    >
                        Hoy
                    </button>
                </div>
            )}
            {isMobile ? (
                <div style={{ flex: 1, minHeight: 0 }}>
                    <MobileDayView resources={data.resources} events={portalEvents} loading={loading} />
                </div>
            ) : (
                <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
                    <TimelineCalendar
                        resources={data.resources}
                        events={portalEvents}
                        readOnly={true}
                        onRegisterRef={setCalendarApi}
                    />
                </div>
            )}
        </div>
    );
}
