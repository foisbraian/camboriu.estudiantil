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

        const resourcesById = new Map(
            (data.resources || []).map((resource) => [String(resource.id), resource])
        );
        const summaryByDay = new Map();

        sourceEvents.forEach((event) => {
            if (event?.extendedProps?.tipo !== "asignacion" || !event.start) return;
            const resource = resourcesById.get(String(event.resourceId));
            const pax = Number(resource?.extendedProps?.pax || 0);
            const key = `${String(event.start).slice(0, 10)}|${event.title || "Servicio"}`;
            const current = summaryByDay.get(key);
            if (current) {
                current.pax += pax;
                return;
            }
            summaryByDay.set(key, {
                id: `portal-resumen-${key}`,
                resourceId: "eventos",
                start: event.start,
                end: event.end,
                title: event.title || "Servicio",
                backgroundColor: event.backgroundColor,
                borderColor: event.borderColor || "transparent",
                textColor: event.textColor,
                pax,
            });
        });

        const summaryEvents = Array.from(summaryByDay.values()).map((event) => ({
            ...event,
            title: `${event.title} (${event.pax} PAX)`,
            extendedProps: { tipo: "global_readonly" },
        }));

        return [...sourceEvents, ...summaryEvents];
    }, [data.events, data.resources]);

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
