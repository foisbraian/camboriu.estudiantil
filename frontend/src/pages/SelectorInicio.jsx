import { useNavigate } from "react-router-dom";

export default function SelectorInicio() {
    const navigate = useNavigate();

    const cards = [
        {
            title: "📅 Gestión de Calendario",
            desc: "Administrar eventos, empresas y disponibilidad en el calendario global.",
            path: "/",
            color: "#2563eb",
        },
        {
            title: "💰 Módulo de Finanzas",
            desc: "Ver resúmenes financieros, registrar pagos y controlar el estado de cuentas.",
            path: "/finanzas",
            color: "#059669",
        },
        {
            title: "🤝 Gestión de Proveedores",
            desc: "Administrar proveedores y planillas de gastos personalizadas tipo Excel.",
            path: "/proveedores",
            color: "#8b5cf6",
        },
    ];

    return (
        <div
            style={{
                height: "100vh",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "#f1f5f9",
                padding: 20,
            }}
        >
            <h1 style={{ marginBottom: 40, color: "#1e293b", fontWeight: 800 }}>Panel de Administración</h1>

            <div style={{ display: "flex", gap: 30, flexWrap: "wrap", justifyContent: "center" }}>
                {cards.map((c) => (
                    <div
                        key={c.path}
                        onClick={() => navigate(c.path)}
                        style={{
                            background: "white",
                            padding: 40,
                            borderRadius: 16,
                            width: 300,
                            textAlign: "center",
                            cursor: "pointer",
                            boxShadow: "0 10px 25px rgba(0,0,0,0.05)",
                            transition: "transform 0.2s, box-shadow 0.2s",
                            border: `2px solid transparent`,
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-5px)";
                            e.currentTarget.style.boxShadow = "0 15px 35px rgba(0,0,0,0.1)";
                            e.currentTarget.style.borderColor = c.color;
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "0 10px 25px rgba(0,0,0,0.05)";
                            e.currentTarget.style.borderColor = "transparent";
                        }}
                    >
                        <div style={{ fontSize: "3rem", marginBottom: 20 }}>{c.title.split(" ")[0]}</div>
                        <h3 style={{ margin: "0 0 10px 0", color: "#334155" }}>{c.title.split(" ").slice(1).join(" ")}</h3>
                        <p style={{ color: "#64748b", fontSize: "0.9rem", lineHeight: "1.5" }}>{c.desc}</p>
                    </div>
                ))}
            </div>

            <button
                onClick={() => {
                    localStorage.removeItem("admin_auth");
                    navigate("/login");
                }}
                style={{
                    marginTop: 60,
                    background: "transparent",
                    border: "none",
                    color: "#ef4444",
                    fontWeight: 600,
                    cursor: "pointer",
                    textDecoration: "underline",
                }}
            >
                Cerrar sesión
            </button>
        </div>
    );
}
