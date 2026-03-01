import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import TimelineCalendar from "../components/TimelineCalendar";
import api from "../api";

export default function PortalEmpresa() {
    const { codigo } = useParams();
    const [data, setData] = useState({ resources: [], events: [] });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        cargar();
    }, [codigo]);

    async function cargar() {
        try {
            const res = await api.get(`/calendario/portal/${codigo}`);
            setData(res.data);
        } catch (e) {
            console.error(e);
            setError("No se pudo cargar el calendario. Verifique el código de acceso.");
        } finally {
            setLoading(false);
        }
    }

    if (loading) return <div style={{ padding: 20 }}>Cargando portal...</div>;
    if (error) return <div style={{ padding: 20, color: "red" }}>{error}</div>;

    return (
        <div style={{
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
            <div style={{ flex: 1, position: "relative" }}>
                <TimelineCalendar
                    resources={data.resources}
                    events={data.events}
                    readOnly={true}
                />
            </div>
        </div>
    );
}
