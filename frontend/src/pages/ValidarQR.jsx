import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import api from "../api";

const EVENT_GRADIENTS = {
    DISCO: "linear-gradient(120deg, #7c3aed, #ec4899)",
    PARQUE: "linear-gradient(120deg, #0ea5e9, #22c55e)",
    POOL: "linear-gradient(120deg, #06b6d4, #2563eb)",
    CENA: "linear-gradient(120deg, #cbd5f5, #94a3b8)",
    DEFAULT: "linear-gradient(120deg, #1d4ed8, #9333ea)"
};

export default function ValidarQR() {
    const [resultado, setResultado] = useState(null);
    const [mensaje, setMensaje] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [agendaLoading, setAgendaLoading] = useState(true);
    const [agendaError, setAgendaError] = useState("");
    const [eventosDisponibles, setEventosDisponibles] = useState([]);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [referenceISO, setReferenceISO] = useState(() => buildRelativeISO(0));
    const [scannerSession, setScannerSession] = useState(0);
    const [scannerReady, setScannerReady] = useState(false);
    const [view, setView] = useState("select");
    const navigate = useNavigate();
    const role = localStorage.getItem("auth_role");
    const isAdmin = role === "admin";
    const isValidator = role === "validator";

    const isValidating = useRef(false);
    const html5QrCode = useRef(null);

    useEffect(() => {
        return () => {
            if (html5QrCode.current) {
                if (html5QrCode.current.isScanning) {
                    html5QrCode.current.stop().catch(() => {});
                }
                html5QrCode.current.clear().catch(() => {});
                html5QrCode.current = null;
            }
        };
    }, []);

    const clearValidationFeedback = useCallback(() => {
        setResultado(null);
        setMensaje("");
        setError("");
    }, []);

    useEffect(() => {
        const cargarAgenda = async () => {
            setAgendaLoading(true);
            setAgendaError("");
            try {
                const res = await api.get("/vouchers/agenda", { params: { fecha: referenceISO } });
                setEventosDisponibles(res.data || []);
                setSelectedEvent((prev) => {
                    const existe = prev && res.data?.some(ev => ev.fecha_evento_id === prev.fecha_evento_id);
                    if (existe) return prev;
                    if (!prev && res.data?.length === 1) {
                        return res.data[0];
                    }
                    return null;
                });
                setView("select");
                clearValidationFeedback();
            } catch (agendaErr) {
                setAgendaError(agendaErr.response?.data?.detail || "No se pudo obtener la agenda.");
            } finally {
                setAgendaLoading(false);
            }
        };
        cargarAgenda();
    }, [referenceISO, clearValidationFeedback]);

    const validarToken = useCallback(async (token) => {
        if (!selectedEvent) {
            setError("Seleccioná un evento antes de validar.");
            isValidating.current = false;
            return;
        }
        setLoading(true);
        setError("");
        setResultado(null);
        try {
            const res = await api.post("/vouchers/validate", {
                token,
                fecha_evento_id: selectedEvent.fecha_evento_id
            });
            setResultado(res.data.detalle);
            setMensaje(res.data.message);
        } catch (err) {
            setError(err.response?.data?.message || err.response?.data?.detail || "Este código no es válido o ya fue usado.");
        } finally {
            setLoading(false);
            isValidating.current = false;
        }
    }, [selectedEvent]);

    useEffect(() => {
        if (!selectedEvent || view !== "scan") {
            return;
        }
        const qrConfig = { fps: 10, qrbox: { width: 280, height: 280 } };
        setScannerReady(false);

        const onScanSuccess = async (decodedText) => {
            if (isValidating.current) return;
            isValidating.current = true;
            if (navigator.vibrate) navigator.vibrate(100);
            try {
                if (html5QrCode.current && html5QrCode.current.isScanning) {
                    await html5QrCode.current.stop();
                }
            } catch (stopErr) {
                console.warn("No se pudo frenar el scanner antes de validar", stopErr);
            }
            validarToken(decodedText);
        };

        const startScanner = async () => {
            try {
                if (!html5QrCode.current) {
                    const container = document.getElementById("reader");
                    if (!container) {
                        console.warn("Contenedor del lector no disponible todavía");
                        return;
                    }
                    html5QrCode.current = new Html5Qrcode("reader");
                }
                await html5QrCode.current.start({ facingMode: "environment" }, qrConfig, onScanSuccess);
                setScannerReady(true);
            } catch (err) {
                console.error("No se pudo iniciar la cámara:", err);
                setError("Error al iniciar la cámara. Asegúrate de dar permisos.");
                isValidating.current = false;
            }
        };

        startScanner();

        return () => {
            setScannerReady(false);
            if (html5QrCode.current && html5QrCode.current.isScanning) {
                html5QrCode.current.stop().catch(() => {});
            }
        };
    }, [selectedEvent, scannerSession, validarToken, view]);

    useEffect(() => {
        setResultado(null);
        setMensaje("");
        setError("");
        if (!selectedEvent && view === "scan") {
            setView("select");
        }
    }, [selectedEvent, view]);

    const handleConfirmSelection = () => {
        if (!selectedEvent) return;
        clearValidationFeedback();
        setView("scan");
        setScannerSession((prev) => prev + 1);
        isValidating.current = false;
    };

    const handleChangeEvent = () => {
        clearValidationFeedback();
        setView("select");
        isValidating.current = false;
    };

    const resetScanner = () => {
        clearValidationFeedback();
        setScannerSession((prev) => prev + 1);
        isValidating.current = false;
    };

    const handleLogout = () => {
        localStorage.removeItem("admin_auth");
        localStorage.removeItem("validator_auth");
        localStorage.removeItem("auth_role");
        navigate("/login");
    };

    const handleGoBack = () => {
        navigate("/inicio", { replace: true });
    };

    const toggleReferenceDay = (offsetDays) => {
        setReferenceISO(buildRelativeISO(offsetDays));
        setView("select");
        clearValidationFeedback();
        isValidating.current = false;
    };

    const headerTitle = view === "scan" ? "Validar vouchers" : "Seleccionar evento";

    return (
        <div style={PAGE_BG}>
            <div style={CONTENT_WRAPPER}>
                <header style={HEADER}>
                    <div>
                        <h1 style={TITLE}>{headerTitle}</h1>
                    </div>
                    <div style={HEADER_ACTIONS}>
                        {isAdmin && (
                            <button onClick={handleGoBack} style={GHOST_BUTTON}>
                                ← Panel principal
                            </button>
                        )}
                        {(isAdmin || isValidator) && (
                            <button onClick={handleLogout} style={GHOST_BUTTON}>
                                Cerrar sesión
                            </button>
                        )}
                    </div>
                </header>

                {view === "select" ? (
                    <section style={SELECT_PANEL}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                            <div>
                                <h2 style={{ margin: 0, color: "#e5e7eb", fontSize: "1.2rem" }}>Elegí el evento activo</h2>
                                <p style={{ margin: "6px 0 0 0", color: "#94a3b8", fontSize: "0.95rem" }}>
                                    Filtrá por día si necesitás revisar el turno anterior o el que viene.
                                </p>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                                <DateChip label="Ayer" active={referenceISO === buildRelativeISO(-1)} onClick={() => toggleReferenceDay(-1)} />
                                <DateChip label="Hoy" active={referenceISO === buildRelativeISO(0)} onClick={() => toggleReferenceDay(0)} />
                                <DateChip label="Mañana" active={referenceISO === buildRelativeISO(1)} onClick={() => toggleReferenceDay(1)} />
                            </div>
                        </div>

                        <div style={EVENT_LIST}>
                            {agendaLoading && <p style={STATE_TEXT}>Cargando agenda...</p>}
                            {agendaError && !agendaLoading && <p style={{ ...STATE_TEXT, color: "#f87171" }}>{agendaError}</p>}
                            {!agendaLoading && !agendaError && eventosDisponibles.length === 0 && (
                                <p style={STATE_TEXT}>No hay eventos programados para este turno.</p>
                            )}
                            {!agendaLoading && eventosDisponibles.map((evento) => (
                                <EventCard
                                    key={evento.fecha_evento_id}
                                    data={evento}
                                    isSelected={selectedEvent?.fecha_evento_id === evento.fecha_evento_id}
                                    onSelect={() => setSelectedEvent(evento)}
                                />
                            ))}
                        </div>

                        <button
                            onClick={handleConfirmSelection}
                            style={{
                                ...CONFIRM_BUTTON,
                                opacity: selectedEvent ? 1 : 0.4,
                                cursor: selectedEvent ? "pointer" : "not-allowed"
                            }}
                            disabled={!selectedEvent}
                        >
                            Continuar a la cámara
                        </button>
                    </section>
                ) : (
                    <section style={SCAN_PANEL}>
                        <div style={EVENT_SUMMARY}>
                            <div>
                                <span style={EYEBROW}>Validando</span>
                                <h3 style={{ margin: "6px 0", fontSize: "1.3rem", color: "#f8fafc" }}>{selectedEvent?.evento.nombre}</h3>
                                <p style={{ margin: 0, color: "#94a3b8" }}>{selectedEvent?.ventana?.label || ""}</p>
                            </div>
                            <button onClick={handleChangeEvent} style={SWAP_BUTTON}>Elegir otro evento</button>
                        </div>

                        <div style={SCANNER_CARD}>
                            {!resultado && !error && (
                                <>
                                    <div id="reader" style={{ width: "100%", minHeight: 320, borderRadius: 18, overflow: "hidden" }}></div>
                                    {!scannerReady && (
                                        <p style={{ ...STATE_TEXT, marginTop: 12 }}>Iniciando cámara...</p>
                                    )}
                                </>
                            )}

                            {loading && (
                                <div style={LOADER_OVERLAY}>
                                    <div className="spinner" />
                                    <p style={{ marginTop: 15 }}>Validando...</p>
                                </div>
                            )}

                            {resultado && (
                                <div style={{ animation: "fadeIn 0.5s ease" }}>
                                    <div style={{ fontSize: "3rem", marginBottom: 16 }}>✅</div>
                                    <h3 style={{ color: "#4ade80", margin: "0 0 12px 0" }}>{mensaje}</h3>
                                    <div style={RESULT_CARD}>
                                        <DetailRow label="Grupo" value={resultado.grupo} />
                                        <DetailRow label="Servicio" value={resultado.servicio} />
                                        <DetailRow label="Fecha" value={resultado.fecha} />
                                        {resultado.ventana?.label && (
                                            <DetailRow label="Horario" value={resultado.ventana.label} />
                                        )}
                                        <StructureRow estructura={resultado.estructura_grupo} />
                                    </div>
                                    <button onClick={resetScanner} style={PRIMARY_BUTTON}>Escanear siguiente</button>
                                </div>
                            )}

                            {error && (
                                <div style={{ animation: "shake 0.5s ease" }}>
                                    <div style={{ fontSize: "3rem", marginBottom: 16 }}>❌</div>
                                    <h3 style={{ color: "#f87171", margin: "0 0 12px 0" }}>Error de validación</h3>
                                    <p style={{ color: "#cbd5f5", marginBottom: 20 }}>{error}</p>
                                    <button onClick={resetScanner} style={{ ...PRIMARY_BUTTON, background: "linear-gradient(120deg, #ef4444, #f97316)" }}>Reintentar</button>
                                </div>
                            )}
                        </div>
                    </section>
                )}
            </div>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&display=swap');
                .spinner {
                    width: 44px;
                    height: 44px;
                    border: 4px solid rgba(248, 113, 113, 0.2);
                    border-top-color: #f472b6;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-8px); }
                    75% { transform: translateX(8px); }
                }
                #reader__scan_region { background: transparent !important; }
                video { object-fit: cover !important; }
            `}</style>
        </div>
    );
}

function DetailRow({ label, value }) {
    if (!value) return null;
    return (
        <div style={{ marginBottom: 12 }}>
            <span style={{ color: "#94a3b8", fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, display: "block" }}>{label}</span>
            <span style={{ fontSize: "1rem", fontWeight: 600, color: "#e2e8f0" }}>{value}</span>
        </div>
    );
}

function StructureRow({ estructura }) {
    if (!estructura) return null;
    const chips = [
        { label: "PAX", value: estructura.pax },
        { label: "Padres", value: estructura.padres },
        { label: "Guías", value: estructura.guias }
    ];
    return (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            {chips.map((chip) => (
                <div key={chip.label} style={STRUCT_CHIP}>
                    <span style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{chip.label}</span>
                    <strong style={{ fontSize: "1.2rem", color: "#f8fafc" }}>{chip.value ?? 0}</strong>
                </div>
            ))}
        </div>
    );
}

function EventCard({ data, isSelected, onSelect }) {
    const tipo = (data.evento?.tipo || "").toUpperCase();
    const gradient = EVENT_GRADIENTS[tipo] || EVENT_GRADIENTS.DEFAULT;
    const fechaLegible = formatDate(data.fecha);
    return (
        <button
            onClick={onSelect}
            style={{
                border: "none",
                width: "100%",
                textAlign: "left",
                padding: 20,
                borderRadius: 20,
                marginBottom: 14,
                cursor: "pointer",
                background: gradient,
                color: "white",
                boxShadow: isSelected ? "0 0 0 3px rgba(250, 250, 250, 0.4)" : "0 15px 35px rgba(0,0,0,0.25)",
                transition: "transform 0.2s, box-shadow 0.2s",
                transform: isSelected ? "translateY(-3px)" : "none"
            }}
        >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontWeight: 700, letterSpacing: "0.08em" }}>{tipo || "EVENTO"}</span>
                {isSelected && <span style={{ fontSize: "0.8rem", background: "rgba(0,0,0,0.3)", padding: "4px 10px", borderRadius: 999 }}>Seleccionado</span>}
            </div>
            <h3 style={{ margin: 0, fontSize: "1.3rem" }}>{data.evento?.nombre}</h3>
            <p style={{ margin: "6px 0", opacity: 0.85 }}>{fechaLegible}</p>
            {data.tematica && <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.85 }}>Temática: {data.tematica}</p>}
            <p style={{ marginTop: 12, fontWeight: 600 }}>{data.ventana?.label}</p>
        </button>
    );
}

function DateChip({ label, active, onClick }) {
    return (
        <button
            onClick={onClick}
            style={{
                borderRadius: 999,
                padding: "6px 14px",
                border: active ? "1px solid #f472b6" : "1px solid rgba(255,255,255,0.2)",
                background: active ? "rgba(244, 114, 182, 0.15)" : "transparent",
                color: "#f1f5f9",
                cursor: "pointer",
                fontWeight: 600
            }}
        >
            {label}
        </button>
    );
}

const PAGE_BG = {
    minHeight: "100vh",
    background: "radial-gradient(circle at top, rgba(59,130,246,0.35), transparent 55%), #020617",
    fontFamily: "'Space Grotesk', 'Inter', sans-serif",
    padding: "32px 16px",
    boxSizing: "border-box"
};

const CONTENT_WRAPPER = {
    maxWidth: 1200,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 24
};

const HEADER = {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 16
};

const HEADER_ACTIONS = {
    display: "flex",
    gap: 12,
    alignItems: "center"
};

const SELECT_PANEL = {
    background: "rgba(15,23,42,0.6)",
    padding: 24,
    borderRadius: 28,
    border: "1px solid rgba(148, 163, 184, 0.2)",
    backdropFilter: "blur(12px)",
    maxWidth: 900,
    margin: "0 auto"
};

const SCAN_PANEL = {
    background: "rgba(15,23,42,0.6)",
    padding: 24,
    borderRadius: 28,
    border: "1px solid rgba(148, 163, 184, 0.2)",
    backdropFilter: "blur(12px)"
};

const EVENT_LIST = {
    maxHeight: "70vh",
    overflowY: "auto",
    paddingRight: 6
};

const CONFIRM_BUTTON = {
    marginTop: 24,
    width: "100%",
    padding: "14px 16px",
    borderRadius: 16,
    border: "none",
    color: "white",
    fontWeight: 700,
    fontSize: "1rem",
    background: "linear-gradient(120deg, #2563eb, #a855f7)",
    boxShadow: "0 15px 35px rgba(37, 99, 235, 0.25)",
    transition: "opacity 0.2s"
};

const EVENT_SUMMARY = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    gap: 12
};

const SCANNER_CARD = {
    borderRadius: 24,
    border: "1px solid rgba(148, 163, 184, 0.2)",
    padding: 20,
    position: "relative",
    minHeight: 360,
    background: "rgba(15,23,42,0.4)"
};

const RESULT_CARD = {
    textAlign: "left",
    background: "rgba(15,23,42,0.75)",
    borderRadius: 20,
    padding: 18,
    border: "1px solid rgba(148,163,184,0.2)",
    marginBottom: 20
};

const PRIMARY_BUTTON = {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 16,
    border: "none",
    color: "white",
    fontWeight: 700,
    fontSize: "1rem",
    cursor: "pointer",
    background: "linear-gradient(120deg, #2563eb, #a855f7)",
    boxShadow: "0 15px 35px rgba(37, 99, 235, 0.25)"
};

const GHOST_BUTTON = {
    borderRadius: 999,
    border: "1px solid rgba(148, 163, 184, 0.5)",
    background: "transparent",
    color: "#f8fafc",
    padding: "10px 18px",
    fontWeight: 600,
    cursor: "pointer"
};

const SWAP_BUTTON = {
    borderRadius: 999,
    border: "none",
    background: "rgba(148,163,184,0.15)",
    color: "#f8fafc",
    padding: "8px 16px",
    cursor: "pointer",
    fontWeight: 600
};

const EYEBROW = {
    textTransform: "uppercase",
    letterSpacing: "0.2em",
    fontSize: "0.75rem",
    color: "#94a3b8",
    margin: 0
};

const TITLE = {
    color: "#f8fafc",
    fontSize: "2rem",
    margin: "8px 0"
};

const STATE_TEXT = {
    color: "#94a3b8",
    margin: "12px 0",
    fontStyle: "italic"
};

const STRUCT_CHIP = {
    background: "rgba(30, 41, 59, 0.7)",
    borderRadius: 16,
    padding: "10px 14px",
    border: "1px solid rgba(148,163,184,0.2)",
    flex: "1 1 90px",
    minWidth: 90
};

const LOADER_OVERLAY = {
    position: "absolute",
    inset: 0,
    background: "rgba(2,6,23,0.8)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    zIndex: 10
};

function buildRelativeISO(offset) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().split("T")[0];
}

function formatDate(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });
}
