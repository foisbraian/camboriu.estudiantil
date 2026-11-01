import React, { useEffect, useState } from "react";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

const SECTION_ORDER = ["ESPECIAL", "DIVERSOS"];

const SECTION_CONFIG = {
  ESPECIAL: {
    emoji: "⭐",
    label: "ESPECIAL DE LA NOCHE",
    gradient: "linear-gradient(135deg, #FFDE5B 0%, #f5a623 50%, #e8870a 100%)",
    color: "#1a0a00",
    glow: "rgba(255,180,0,0.35)",
    special: true,
  },
  DIVERSOS: {
    emoji: "🥤",
    label: "BEBIDAS",
    gradient: "linear-gradient(135deg, #c45c00 0%, #e87c00 50%, #ff9f1c 100%)",
    color: "#ffffff",
    glow: "rgba(196,92,0,0.35)",
  },
};

const STARS = Array.from({ length: 35 }, (_, i) => ({
  id: i,
  top: `${Math.random() * 100}%`,
  left: `${Math.random() * 100}%`,
  size: Math.random() * 2.5 + 0.5,
  opacity: Math.random() * 0.6 + 0.2,
  delay: Math.random() * 3,
}));

export default function CardapioSinAlcohol() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API}/cardapio/sin_alcohol`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setItems)
      .catch(() => setError("No se pudo cargar el menú"))
      .finally(() => setLoading(false));
  }, []);

  const grouped = SECTION_ORDER.reduce((acc, sec) => {
    const secItems = items.filter((i) => i.seccion === sec);
    if (secItems.length) acc[sec] = secItems;
    return acc;
  }, {});

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #0d0800 0%, #1a0e00 35%, #0d1500 70%, #080a00 100%)",
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
      position: "relative",
      overflowX: "hidden",
    }}>
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.4); }
        }
        @keyframes floatWave {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes shimmerOrange {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseGlowOrange {
          0%, 100% { box-shadow: 0 6px 24px rgba(255,180,0,0.35); }
          50% { box-shadow: 0 6px 40px rgba(255,180,0,0.65); }
        }
        .card-item { transition: transform 0.15s ease; }
        .card-item:active { transform: scale(0.98); }
        .section-block { animation: fadeUp 0.5s ease both; }
      `}</style>

      {/* Estrellas de fondo */}
      {STARS.map((s) => (
        <div key={s.id} style={{
          position: "fixed",
          top: s.top, left: s.left,
          width: s.size, height: s.size,
          borderRadius: "50%",
          background: "#fff",
          opacity: s.opacity,
          animation: `twinkle ${2 + s.delay}s ease-in-out infinite`,
          animationDelay: `${s.delay}s`,
          pointerEvents: "none",
          zIndex: 0,
        }} />
      ))}

      {/* ─── HEADER ─── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(13,8,0,0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(232,124,0,0.4)",
        padding: "14px 16px 10px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 480, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 42, height: 42, borderRadius: "50%",
              background: "linear-gradient(135deg, #005740, #4BB61E)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 900, fontSize: 16, color: "#FFDE5B",
              boxShadow: "0 0 18px rgba(232,124,0,0.45)",
              flexShrink: 0, letterSpacing: 0.5,
            }}>CE</div>
            <div>
              <div style={{
                background: "linear-gradient(90deg, #FFDE5B, #e87c00, #FFDE5B)",
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                animation: "shimmerOrange 3s linear infinite",
                fontWeight: 900, fontSize: 15, letterSpacing: 2, lineHeight: 1,
              }}>CAMBORIÚ</div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, letterSpacing: 3, fontWeight: 600 }}>ESTUDIANTIL · 1993</div>
            </div>
          </div>
          <div style={{
            background: "linear-gradient(135deg, #c45c00, #ff9f1c)",
            color: "#fff",
            padding: "5px 12px", borderRadius: 20,
            fontSize: 11, fontWeight: 800, letterSpacing: 0.5,
            boxShadow: "0 4px 14px rgba(196,92,0,0.5)",
          }}>🥤 SIN ALCOHOL</div>
        </div>
      </div>

      {/* Banner descuento */}
      <div style={{
        background: "linear-gradient(90deg, #FFDE5B, #f5a623, #FFDE5B)",
        backgroundSize: "200% auto",
        animation: "shimmerOrange 2.5s linear infinite",
        color: "#1a0a00",
        textAlign: "center",
        padding: "9px 16px",
        fontWeight: 900,
        fontSize: 13,
        letterSpacing: 1,
        position: "relative", zIndex: 10,
      }}>
        🏷️&nbsp;&nbsp;10% DE DESCUENTO PAGANDO EN EFECTIVO&nbsp;&nbsp;💵
      </div>

      {/* ─── CONTENIDO ─── */}
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 14px 60px", position: "relative", zIndex: 1 }}>

        {loading && (
          <div style={{ textAlign: "center", padding: 80 }}>
            <div style={{ fontSize: 40, animation: "floatWave 1.5s ease-in-out infinite" }}>🥤</div>
            <div style={{ color: "#FFDE5B", marginTop: 16, fontWeight: 600, letterSpacing: 2 }}>CARGANDO MENÚ...</div>
          </div>
        )}
        {error && (
          <div style={{ textAlign: "center", color: "#ff6b6b", padding: 40, fontSize: 14 }}>{error}</div>
        )}

        {Object.entries(grouped).map(([seccion, secItems], idx) => {
          const cfg = SECTION_CONFIG[seccion] || SECTION_CONFIG["DIVERSOS"];
          return (
            <div key={seccion} className="section-block" style={{ marginBottom: 28, animationDelay: `${idx * 0.1}s` }}>

              {/* Header de sección */}
              <div style={{
                background: cfg.gradient,
                borderRadius: 16,
                padding: cfg.special ? "16px 18px" : "11px 18px",
                marginBottom: 10,
                display: "flex", alignItems: "center", gap: 10,
                animation: cfg.special ? "pulseGlowOrange 2.5s ease-in-out infinite" : "none",
                boxShadow: cfg.special ? undefined : `0 6px 24px ${cfg.glow}`,
              }}>
                <span style={{ fontSize: cfg.special ? 28 : 20 }}>{cfg.emoji}</span>
                <div>
                  <div style={{
                    color: cfg.color,
                    fontWeight: 900,
                    fontSize: cfg.special ? 17 : 14,
                    letterSpacing: 2.5,
                    textTransform: "uppercase",
                    lineHeight: 1,
                  }}>{cfg.label}</div>
                  {cfg.special && (
                    <div style={{ color: "rgba(0,0,0,0.5)", fontSize: 10, marginTop: 3, fontWeight: 700, letterSpacing: 1 }}>
                      OFERTA EXCLUSIVA DE LA NOCHE
                    </div>
                  )}
                </div>
              </div>

              {/* Items */}
              {secItems.map((item) => (
                <div
                  key={item.id}
                  className="card-item"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: cfg.special
                      ? "linear-gradient(135deg, rgba(255,222,91,0.1), rgba(245,166,35,0.07))"
                      : "rgba(255,255,255,0.04)",
                    border: cfg.special
                      ? "1px solid rgba(255,222,91,0.25)"
                      : "1px solid rgba(255,159,28,0.15)",
                    borderRadius: 12,
                    padding: cfg.special ? "16px 16px" : "12px 14px",
                    marginBottom: 8,
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                  }}
                >
                  <div style={{ flex: 1, paddingRight: 10 }}>
                    <div style={{
                      color: cfg.special ? "#FFDE5B" : "#f0f0f0",
                      fontWeight: cfg.special ? 800 : 600,
                      fontSize: cfg.special ? 15 : 14,
                      lineHeight: 1.35,
                    }}>
                      {item.nombre}
                    </div>
                    {item.descripcion && (
                      <div style={{
                        color: cfg.special ? "rgba(255,222,91,0.85)" : "#ffffff",
                        fontSize: 11,
                        marginTop: 4,
                        fontWeight: 600,
                        letterSpacing: 0.5,
                        textTransform: "uppercase",
                      }}>
                        {item.descripcion}
                      </div>
                    )}
                  </div>
                  {/* Precio */}
                  <div style={{ flexShrink: 0 }}>
                    <div style={{
                      color: cfg.special ? "#1a0a00" : "#FFDE5B",
                      background: cfg.special
                        ? "linear-gradient(135deg, #FFDE5B, #f5a623)"
                        : "rgba(232,124,0,0.18)",
                      padding: cfg.special ? "7px 14px" : "5px 11px",
                      borderRadius: 10,
                      fontWeight: 900,
                      fontSize: cfg.special ? 22 : 19,
                      letterSpacing: -0.5,
                      border: cfg.special ? "none" : "1px solid rgba(232,124,0,0.3)",
                      whiteSpace: "nowrap",
                    }}>
                      R${item.precio % 1 === 0 ? item.precio.toFixed(0) : item.precio.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })}

        {/* Footer */}
        {!loading && !error && (
          <div style={{ textAlign: "center", marginTop: 32, paddingBottom: 8 }}>
            <div style={{ fontSize: 28, marginBottom: 8, animation: "floatWave 3s ease-in-out infinite" }}>🌊</div>
            <div style={{ color: "rgba(255,255,255,0.18)", fontSize: 10, letterSpacing: 3, fontWeight: 700 }}>
              CAMBORIÚ ESTUDIANTIL · SINCE 1993
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
