import { useEffect, useState } from "react";
import PlanillaProveedor from "../components/PlanillaProveedor";
import api from "../api";

const HOTEL_CATALOG = [
    { key: "bhally", nombre: "BHALLY", descripcion: "Frente al mar, ideal para grupos grandes", color: "#0ea5e9" },
    { key: "hbiin", nombre: "HBIIN", descripcion: "Estilo boutique, habitaciones premium", color: "#f97316" },
    { key: "suiza", nombre: "SUIZA FABER", descripcion: "Experiencia clásica con servicio cálido", color: "#a855f7" }
];

export default function Hoteleria() {
    const [hoteles, setHoteles] = useState({});
    const [selectedKey, setSelectedKey] = useState(HOTEL_CATALOG[0].key);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [syncing, setSyncing] = useState(false);

    const fetchHoteles = async () => {
        try {
            let list = (await api.get("/proveedores/")).data;
            const missing = HOTEL_CATALOG.filter((hotel) =>
                !list.some((prov) => prov.nombre?.toLowerCase() === hotel.nombre.toLowerCase())
            );
            if (missing.length) {
                setSyncing(true);
                await Promise.all(missing.map((hotel) => api.post("/proveedores/", { nombre: hotel.nombre })));
                list = (await api.get("/proveedores/")).data;
            }
            const mapping = {};
            HOTEL_CATALOG.forEach((hotel) => {
                const prov = list.find((p) => p.nombre?.toLowerCase() === hotel.nombre.toLowerCase());
                if (prov) {
                    mapping[hotel.key] = { ...hotel, proveedor: prov };
                }
            });
            setHoteles(mapping);
            if (!mapping[selectedKey]) {
                setSelectedKey(HOTEL_CATALOG[0].key);
            }
            setError("");
        } catch (err) {
            setError(err.response?.data?.detail || "No pudimos cargar hotelería");
        } finally {
            setLoading(false);
            setSyncing(false);
        }
    };

    useEffect(() => {
        fetchHoteles();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const selectedHotel = hoteles[selectedKey];

    return (
        <div style={{ minHeight: "100%", padding: "30px 40px", background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 35%, #312e81 100%)", color: "white" }}>
            <section style={{ marginBottom: 30 }}>
                <p style={{ letterSpacing: "0.3em", fontSize: "0.75rem", textTransform: "uppercase", color: "rgba(248,250,252,0.7)" }}>Operaciones</p>
                <h1 style={{ margin: 0, fontSize: "2.8rem", fontWeight: 800 }}>🏨 Hotelería</h1>
                <p style={{ maxWidth: 600, lineHeight: 1.5, color: "rgba(248,250,252,0.85)" }}>
                    Centralizamos las planillas de cada hotel para coordinar rooming, amenities y extras con la misma lógica flexible de proveedores.
                </p>
            </section>

            <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 24, alignItems: "flex-start" }}>
                <div style={{ background: "rgba(15,23,42,0.65)", borderRadius: 18, padding: 18, boxShadow: "0 20px 45px rgba(15,15,42,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <p style={{ margin: "0 0 12px 0", fontSize: "0.85rem", letterSpacing: "0.08em", color: "rgba(248,250,252,0.7)", textTransform: "uppercase" }}>Hoteles</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {HOTEL_CATALOG.map((hotel) => {
                            const isActive = selectedKey === hotel.key;
                            return (
                                <button
                                    key={hotel.key}
                                    onClick={() => setSelectedKey(hotel.key)}
                                    style={{
                                        textAlign: "left",
                                        padding: "14px 16px",
                                        borderRadius: 14,
                                        border: isActive ? `1px solid ${hotel.color}` : "1px solid rgba(255,255,255,0.1)",
                                        background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                                        color: "white",
                                        cursor: "pointer",
                                        transition: "all 0.2s"
                                    }}
                                >
                                    <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{hotel.nombre}</div>
                                    <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "rgba(248,250,252,0.7)" }}>{hotel.descripcion}</p>
                                </button>
                            );
                        })}
                    </div>
                    <div style={{ marginTop: 18, fontSize: "0.8rem", color: "rgba(248,250,252,0.6)" }}>
                        {syncing ? "Sincronizando registros..." : "Los hoteles se auto crean si no existen como proveedores."}
                    </div>
                </div>

                <div style={{ background: "white", borderRadius: 28, boxShadow: "0 30px 80px rgba(15,23,42,0.25)", overflow: "hidden" }}>
                    {error && (
                        <div style={{ padding: 20, background: "#fee2e2", color: "#b91c1c", fontWeight: 600 }}>
                            {error}
                        </div>
                    )}
                    {loading ? (
                        <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>Cargando hotelería...</div>
                    ) : selectedHotel && selectedHotel.proveedor ? (
                        <PlanillaProveedor
                            proveedorId={selectedHotel.proveedor.id}
                            hideBackButton
                            customTitle={`Hotel ${selectedHotel.proveedor.nombre}`}
                            subheading="Gestioná habitaciones, amenities y extras desde una sola planilla"
                            containerStyle={{ padding: 0, background: "transparent" }}
                        />
                    ) : (
                        <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>
                            Selecciona un hotel o crea el registro desde proveedores.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
