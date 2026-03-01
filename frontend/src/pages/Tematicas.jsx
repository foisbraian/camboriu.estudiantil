import { useState, useEffect } from "react";
import api from "../api";

export default function Tematicas() {
    const [nombre, setNombre] = useState("");
    const [descripcion, setDescripcion] = useState("");
    const [lista, setLista] = useState([]);

    useEffect(() => {
        cargar();
    }, []);

    async function cargar() {
        const res = await api.get("/tematicas/");
        setLista(res.data);
    }

    async function crear() {
        if (!nombre.trim()) {
            alert("El nombre es obligatorio");
            return;
        }
        try {
            await api.post("/tematicas/", { nombre, descripcion });
            alert("Temática creada");
            setNombre("");
            setDescripcion("");
            cargar();
        } catch (e) {
            alert(e.response?.data?.detail || "Error al crear temática");
        }
    }

    async function eliminar(id) {
        if (!window.confirm("¿Seguro de eliminar esta temática?")) return;
        try {
            await api.delete(`/tematicas/${id}`);
            cargar();
        } catch (e) {
            alert(e.response?.data?.detail || "Error al eliminar");
        }
    }

    return (
        <div style={{ padding: "40px 20px", maxWidth: "800px" }}>
            <h2>Gestión de Temáticas</h2>
            <p style={{ color: "#666", marginBottom: 20 }}>
                Las temáticas se pueden asignar a eventos de tipo Disco (ej: Fluor, Espuma, Blanco)
            </p>

            <div style={{ marginBottom: 30 }}>
                <input
                    placeholder="Nombre (ej: Fluor)"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    style={{ marginRight: 10 }}
                />

                <input
                    placeholder="Descripción (opcional)"
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    style={{ marginRight: 10, width: 300 }}
                />

                <button onClick={crear}>Crear Temática</button>
            </div>

            <div>
                <h3>Listado de Temáticas</h3>
                {lista.length === 0 ? (
                    <p style={{ color: "#999" }}>No hay temáticas creadas aún</p>
                ) : (
                    <table border="1" cellPadding="10" style={{ borderCollapse: "collapse", width: "100%" }}>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Nombre</th>
                                <th>Descripción</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {lista.map((tem) => (
                                <tr key={tem.id}>
                                    <td>{tem.id}</td>
                                    <td><strong>{tem.nombre}</strong></td>
                                    <td>{tem.descripcion || <em style={{ color: "#999" }}>Sin descripción</em>}</td>
                                    <td>
                                        <button
                                            style={{ background: "red", color: "white" }}
                                            onClick={() => eliminar(tem.id)}
                                        >
                                            Eliminar
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
