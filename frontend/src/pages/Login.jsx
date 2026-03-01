import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function Login() {
    const [pass, setPass] = useState("");
    const navigate = useNavigate();

    async function login(e) {
        e.preventDefault();
        try {
            const res = await api.post("/login", { password: pass });
            if (res.data.auth) {
                localStorage.setItem("admin_auth", "true");
                navigate("/inicio");
            }
        } catch (error) {
            alert(error.response?.data?.detail || "Error al iniciar sesión");
        }
    }

    return (
        <div
            style={{
                height: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#f1f5f9",
            }}
        >
            <form
                onSubmit={login}
                style={{
                    background: "white",
                    padding: 30,
                    borderRadius: 10,
                    boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 15,
                    width: 300,
                }}
            >
                <h2 style={{ margin: 0, textAlign: "center" }}>Admin Login</h2>
                <input
                    type="password"
                    placeholder="Contraseña"
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    style={{
                        padding: 10,
                        border: "1px solid #ccc",
                        borderRadius: 5,
                    }}
                />
                <button
                    style={{
                        padding: 10,
                        background: "blue",
                        color: "white",
                        border: "none",
                        borderRadius: 5,
                        cursor: "pointer",
                        fontWeight: "bold",
                    }}
                >
                    Ingresar
                </button>
            </form>
        </div>
    );
}
