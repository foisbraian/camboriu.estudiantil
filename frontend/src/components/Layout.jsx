import { useState } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";

const MESES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export default function Layout() {
    const [menuOpen, setMenuOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    const now = new Date();
    const [mesSeleccionado, setMesSeleccionado] = useState(now.getMonth());
    const [anioSeleccionado, setAnioSeleccionado] = useState(now.getFullYear());

    const NAV_ITEMS = [
        { label: "📅 Calendario", path: "/calendario" },
        { label: "🏢 Empresas", path: "/empresas" },
        { label: "🎉 Eventos", path: "/eventos" },
        { label: "🎨 Temáticas", path: "/tematicas" },
        { label: "💰 Finanzas", path: "/finanzas" },
        { label: "🤝 Proveedores", path: "/proveedores" },
        { label: "📲 Validar QR", path: "/panel/validar" },
    ];
    const role = localStorage.getItem("auth_role");
    const navItems = role === "calendar"
        ? NAV_ITEMS.filter((item) => ["/calendario", "/eventos"].includes(item.path))
        : NAV_ITEMS;

    function salir() {
        localStorage.removeItem("admin_auth");
        localStorage.removeItem("validator_auth");
        localStorage.removeItem("calendar_auth");
        localStorage.removeItem("auth_role");
        window.location.href = "/login";
    }

    const anios = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

    // El botón de descargar solo es relevante en el calendario
    const isCalendar = location.pathname === "/calendario";

    const handleDescargar = () => {
        setMenuOpen(false);
        // Disparamos un evento personalizado que el AdminCalendar escuchará
        const event = new CustomEvent("descargarPDF", {
            detail: { mes: mesSeleccionado, anio: anioSeleccionado }
        });
        window.dispatchEvent(event);
    };

    return (
        <div style={{ position: "relative", width: "100%", height: "100vh", overflow: "hidden" }}>

            {/* ── Botón hamburguesa flotante ── */}
            <button
                id="print-controls"
                onClick={() => setMenuOpen((prev) => !prev)}
                style={{
                    position: "fixed",
                    bottom: 24,
                    left: 14,
                    zIndex: 1001,
                    width: 42,
                    height: 42,
                    borderRadius: "50%",
                    background: menuOpen ? "#1e293b" : "#2563eb",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                    boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
                    transition: "background 0.2s",
                }}
                title="Menú"
            >
                {[0, 1, 2].map((i) => (
                    <span
                        key={i}
                        style={{
                            display: "block",
                            width: 20,
                            height: 2,
                            background: "white",
                            borderRadius: 2,
                            transition: "all 0.25s",
                            transform:
                                menuOpen && i === 0 ? "translateY(7px) rotate(45deg)"
                                    : menuOpen && i === 1 ? "scaleX(0)"
                                        : menuOpen && i === 2 ? "translateY(-7px) rotate(-45deg)"
                                            : "none",
                        }}
                    />
                ))}
            </button>

            {/* ── Panel lateral colapsable ── */}
            <div
                style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    zIndex: 1000,
                    height: "100vh",
                    width: 280,
                    background: "rgba(15, 23, 42, 0.96)",
                    backdropFilter: "blur(12px)",
                    boxShadow: "8px 0 32px rgba(0,0,0,0.35)",
                    transform: menuOpen ? "translateX(0)" : "translateX(-100%)",
                    transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                    display: "flex",
                    flexDirection: "column",
                    padding: "64px 20px 24px",
                    gap: 8,
                    overflowY: "auto",
                }}
            >
                <p style={{ color: "#64748b", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 6px 4px" }}>
                    Sesión
                </p>
                <button
                    onClick={salir}
                    style={{
                        background: "rgba(239,68,68,0.2)",
                        color: "#f87171",
                        border: "1px solid rgba(239,68,68,0.3)",
                        borderRadius: 8,
                        padding: "10px 14px",
                        fontWeight: 700,
                        cursor: "pointer",
                        fontSize: "0.95rem",
                        width: "100%",
                        textAlign: "left",
                        marginBottom: 10
                    }}
                >
                    🚪 Cerrar sesión
                </button>

                <p style={{ color: "#64748b", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 6px 4px" }}>
                    Navegación
                </p>
                {navItems.map(({ label, path }) => (
                    <button
                        key={path}
                        onClick={() => { setMenuOpen(false); navigate(path); }}
                        style={{
                            background: location.pathname === path ? "rgba(255,255,255,0.08)" : "transparent",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 8,
                            color: "#e2e8f0",
                            textAlign: "left",
                            padding: "10px 14px",
                            cursor: "pointer",
                            fontSize: "0.95rem",
                            fontWeight: 500,
                            transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = location.pathname === path ? "rgba(255,255,255,0.08)" : "transparent"}
                    >
                        {label}
                    </button>
                ))}

                <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", margin: "12px 0" }} />

                {isCalendar && (
                    <>
                        <p style={{ color: "#64748b", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 6px 4px" }}>
                            Descargar mes
                        </p>
                        <select
                            value={mesSeleccionado}
                            onChange={(e) => setMesSeleccionado(Number(e.target.value))}
                            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.07)", color: "#e2e8f0", fontSize: "0.9rem" }}
                        >
                            {MESES.map((m, i) => (
                                <option key={i} value={i} style={{ background: "#1e293b" }}>{m}</option>
                            ))}
                        </select>
                        <select
                            value={anioSeleccionado}
                            onChange={(e) => setAnioSeleccionado(Number(e.target.value))}
                            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.07)", color: "#e2e8f0", fontSize: "0.9rem" }}
                        >
                            {anios.map((a) => (
                                <option key={a} value={a} style={{ background: "#1e293b" }}>{a}</option>
                            ))}
                        </select>
                        <button
                            onClick={handleDescargar}
                            style={{
                                background: "#2563eb",
                                color: "white",
                                border: "none",
                                borderRadius: 8,
                                padding: "10px 14px",
                                fontWeight: 700,
                                cursor: "pointer",
                                fontSize: "0.95rem",
                                marginTop: 4,
                                boxShadow: "0 2px 8px rgba(37,99,235,0.4)",
                            }}
                        >
                            🖨️ Descargar PDF
                        </button>
                    </>
                )}
            </div>

            {menuOpen && (
                <div
                    onClick={() => setMenuOpen(false)}
                    style={{ position: "fixed", inset: 0, zIndex: 999 }}
                />
            )}

            {/* Contenido de la página */}
            <div style={{ width: "100%", height: "100%", overflow: "auto", paddingLeft: 0 }}>
                <Outlet />
            </div>
        </div>
    );
}
