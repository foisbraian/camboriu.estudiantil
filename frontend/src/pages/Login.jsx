import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function Login() {
    const [pass, setPass] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    async function login(e) {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await api.post("/login", { password: pass });
            if (res.data.auth) {
                localStorage.setItem("admin_auth", "true");
                navigate("/inicio");
            }
        } catch (error) {
            alert(error.response?.data?.detail || "Error al iniciar sesión");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div
            style={{
                height: "100vh",
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                fontFamily: "'Inter', sans-serif",
                position: "relative",
                overflow: "hidden"
            }}
        >
            {/* Elemento Decorativo (Ola Magenta en CSS) */}
            <div style={{
                position: "absolute",
                top: "-10%",
                right: "-10%",
                width: "400px",
                height: "400px",
                background: "radial-gradient(circle, rgba(236, 72, 153, 0.15) 0%, transparent 70%)",
                borderRadius: "50%",
                filter: "blur(60px)"
            }} />
            <div style={{
                position: "absolute",
                bottom: "-10%",
                left: "-10%",
                width: "400px",
                height: "400px",
                background: "radial-gradient(circle, rgba(37, 99, 235, 0.1) 0%, transparent 70%)",
                borderRadius: "50%",
                filter: "blur(60px)"
            }} />

            <form
                onSubmit={login}
                style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                    padding: "50px 40px",
                    borderRadius: 24,
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                    display: "flex",
                    flexDirection: "column",
                    width: "100%",
                    maxWidth: 400,
                    zIndex: 10,
                    textAlign: "center"
                }}
            >
                <div style={{ marginBottom: 30 }}>
                    <h1 style={{
                        margin: 0,
                        color: "white",
                        fontSize: "1.8rem",
                        fontWeight: 800,
                        letterSpacing: "-0.02em"
                    }}>
                        CAMBORIÚ <span style={{ color: "#ec4899" }}>ESTUDIANTIL</span>
                    </h1>
                    <p style={{
                        color: "#94a3b8",
                        marginTop: 8,
                        fontSize: "0.9rem",
                        fontWeight: 500,
                        textTransform: "uppercase",
                        letterSpacing: "0.1em"
                    }}>
                        Plataforma de Gestión
                    </p>
                </div>

                <div style={{ position: "relative", marginBottom: 20 }}>
                    <input
                        type="password"
                        placeholder="Introduce tu contraseña"
                        value={pass}
                        onChange={(e) => setPass(e.target.value)}
                        required
                        style={{
                            width: "100%",
                            padding: "16px 20px",
                            background: "rgba(255, 255, 255, 0.05)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: 12,
                            color: "white",
                            fontSize: "1rem",
                            outline: "none",
                            transition: "all 0.3s ease",
                            boxSizing: "border-box"
                        }}
                    />
                </div>

                <button
                    disabled={loading}
                    style={{
                        padding: "16px",
                        background: loading ? "#475569" : "linear-gradient(90deg, #2563eb 0%, #ec4899 100%)",
                        color: "white",
                        border: "none",
                        borderRadius: 12,
                        cursor: loading ? "not-allowed" : "pointer",
                        fontSize: "1rem",
                        fontWeight: 700,
                        transition: "transform 0.2s, opacity 0.2s",
                        boxShadow: "0 10px 15px -3px rgba(37, 99, 235, 0.3)"
                    }}
                    onMouseEnter={(e) => !loading && (e.currentTarget.style.transform = "scale(1.02)")}
                    onMouseLeave={(e) => !loading && (e.currentTarget.style.transform = "scale(1)")}
                >
                    {loading ? "Iniciando sesión..." : "Acceder al Panel"}
                </button>

                <p style={{ marginTop: 25, color: "#64748b", fontSize: "0.8rem" }}>
                    &copy; 2026 Camboriú Estudiantil. Todos los derechos reservados.
                </p>
            </form >

            <style>{`
                input::placeholder { color: #64748b; }
                input:focus { 
                    border-color: #ec4899 !important; 
                    background: rgba(255, 255, 255, 0.08) !important;
                    box-shadow: 0 0 0 4px rgba(236, 72, 153, 0.1);
                }
            `}</style>
        </div >
    );
}
