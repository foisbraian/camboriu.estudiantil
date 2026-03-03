import { useEffect, useState, useCallback } from "react";
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
                <div style={{ flex: 1 }}>
                    <MobileDayView resources={data.resources} events={data.events} loading={loading} />
                </div>
            ) : (
                <div style={{ flex: 1, position: "relative" }}>
                    <TimelineCalendar
                        resources={data.resources}
                        events={data.events}
                        readOnly={true}
                    />
                </div>
            )}
        </div>
    );
}
