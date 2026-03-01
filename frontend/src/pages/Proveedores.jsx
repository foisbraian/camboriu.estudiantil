import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function Proveedores() {
    const [proveedores, setProveedores] = useState([]);
    const [nombre, setNombre] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        cargar();
    }, []);

    const cargar = async () => {
        try {
            const res = await api.get("/proveedores/");
            setProveedores(res.data);
        } catch (e) {
            console.error("Error al cargar proveedores", e);
        }
    };

    const crear = async (e) => {
        e.preventDefault();
        if (!nombre) return;
        try {
            await api.post("/proveedores/", { nombre });
            setNombre("");
            cargar();
        } catch (e) {
            alert("Error al crear proveedor");
        }
    };

    const eliminar = async (id) => {
        if (!window.confirm("¿Estás seguro de eliminar este proveedor?")) return;
        try {
            await api.delete(`/proveedores/${id}`);
            cargar();
        } catch (e) {
            alert("Error al eliminar");
        }
    };

    return (
        <div style={{ padding: 30, maxWidth: 800, margin: "0 auto" }}>
            <h1 style={{ color: "#1e293b", fontWeight: 800, marginBottom: 30 }}>🤝 Gestión de Proveedores</h1>

            {/* Formulario de creación */}
            <div style={{ background: "white", padding: 25, borderRadius: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.05)", marginBottom: 30 }}>
                <h3 style={{ margin: "0 0 15px 0", fontSize: "1.1rem" }}>Nuevo Proveedor</h3>
                <form onSubmit={crear} style={{ display: "flex", gap: 10 }}>
                    <input
                        type="text"
                        placeholder="Nombre del proveedor (ej: Transporte VIP)"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        style={{
                            flex: 1,
                            padding: "10px 14px",
                            borderRadius: 8,
                            border: "1px solid #e2e8f0",
                            fontSize: "1rem"
                        }}
                    />
                    <button type="submit" className="btn-primary" style={{ padding: "10px 20px" }}>
                        Crear
                    </button>
                </form>
            </div>

            {/* Lista de proveedores */}
            <div style={{ display: "grid", gap: 15 }}>
                {proveedores.map((p) => (
                    <div
                        key={p.id}
                        style={{
                            background: "white",
                            padding: "20px 25px",
                            borderRadius: 12,
                            boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            border: "1px solid #f1f5f9"
                        }}
                    >
                        <div>
                            <h3 style={{ margin: 0, color: "#334155" }}>{p.nombre}</h3>
                            <small style={{ color: "#94a3b8" }}>Planilla personalizada disponible</small>
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                            <button
                                onClick={() => navigate(`/proveedores/${p.id}`)}
                                style={{
                                    background: "#f1f5f9",
                                    color: "#475569",
                                    border: "none",
                                    padding: "8px 16px",
                                    borderRadius: 8,
                                    fontWeight: 600,
                                    cursor: "pointer"
                                }}
                            >
                                📊 Ver Planilla
                            </button>
                            <button
                                onClick={() => eliminar(p.id)}
                                style={{
                                    background: "rgba(239, 68, 68, 0.1)",
                                    color: "#ef4444",
                                    border: "none",
                                    padding: "8px 16px",
                                    borderRadius: 8,
                                    fontWeight: 600,
                                    cursor: "pointer"
                                }}
                            >
                                🗑️
                            </button>
                        </div>
                    </div>
                ))}

                {proveedores.length === 0 && (
                    <p style={{ textAlign: "center", color: "#94a3b8", marginTop: 40 }}>No hay proveedores creados todavía.</p>
                )}
            </div>
        </div>
    );
}
