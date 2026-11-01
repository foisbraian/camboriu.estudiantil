import React, { useEffect, useState } from "react";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

const BRAND = {
  dark: "#0a1a10",
  green: "#005740",
  greenLight: "#4BB61E",
  yellow: "#FFDE5B",
  cream: "#FAF3CF",
  white: "#ffffff",
};

const SECTION_ORDER = ["COMBOS", "TRAGOS Y MEDIDAS", "DIVERSOS", "ESPECIAL"];

export default function CardapioPublico() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API}/cardapio/alcohol`)
      .then((r) => {
        if (!r.ok) throw new Error("Error al cargar");
        return r.json();
      })
      .then(setItems)
      .catch(() => setError("No se pudo cargar el menú"))
      .finally(() => setLoading(false));
  }, []);

  const grouped = SECTION_ORDER.reduce((acc, sec) => {
    const sectionItems = items.filter((i) => i.seccion === sec);
    if (sectionItems.length > 0) acc[sec] = sectionItems;
    return acc;
  }, {});

  return (
    <div style={{ minHeight: "100vh", background: BRAND.dark, fontFamily: "'Segoe UI', sans-serif" }}>
      {/* Header */}
      <div style={{
        background: "#000",
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: `3px solid ${BRAND.greenLight}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Logo SVG inline - mariposa CE */}
          <svg width="44" height="44" viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="48" fill={BRAND.green}/>
            <text x="50" y="66" textAnchor="middle" fontSize="42" fontWeight="bold" fill={BRAND.yellow} fontFamily="serif">CE</text>
          </svg>
          <div>
            <div style={{ color: BRAND.yellow, fontWeight: 900, fontSize: 18, letterSpacing: 2, lineHeight: 1 }}>CAMBORIÚ</div>
            <div style={{ color: BRAND.white, fontWeight: 700, fontSize: 14, letterSpacing: 2 }}>ESTUDIANTIL</div>
            <div style={{ color: "#888", fontSize: 10, letterSpacing: 1 }}>SINCE 1993.</div>
          </div>
        </div>
        <div style={{
          background: BRAND.green,
          color: BRAND.yellow,
          padding: "6px 14px",
          borderRadius: 20,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 1,
        }}>
          🍹 MENÚ CON ALCOHOL
        </div>
      </div>

      {/* Descuento banner */}
      <div style={{
        background: BRAND.yellow,
        color: "#000",
        textAlign: "center",
        padding: "8px",
        fontWeight: 800,
        fontSize: 14,
        letterSpacing: 1,
      }}>
        🏷️ 10% de descuento en efectivo
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "16px 12px 40px" }}>
        {loading && (
          <div style={{ textAlign: "center", color: BRAND.yellow, padding: 60, fontSize: 18 }}>
            Cargando menú...
          </div>
        )}
        {error && (
          <div style={{ textAlign: "center", color: "#ff6b6b", padding: 40 }}>{error}</div>
        )}

        {Object.entries(grouped).map(([seccion, sectionItems]) => (
          <div key={seccion} style={{ marginBottom: 28 }}>
            {/* Section header */}
            <div style={{
              background: `linear-gradient(135deg, ${BRAND.green}, ${BRAND.greenLight})`,
              color: BRAND.yellow,
              textAlign: "center",
              padding: "10px 16px",
              borderRadius: 12,
              fontWeight: 900,
              fontSize: 16,
              letterSpacing: 3,
              marginBottom: 12,
              textTransform: "uppercase",
              boxShadow: `0 4px 15px rgba(0,87,64,0.4)`,
            }}>
              {seccion}
            </div>

            {/* Items */}
            {sectionItems.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10,
                  padding: "12px 16px",
                  marginBottom: 8,
                  backdropFilter: "blur(4px)",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ color: BRAND.white, fontWeight: 600, fontSize: 14, lineHeight: 1.3 }}>
                    {item.nombre}
                  </div>
                  {item.descripcion && (
                    <div style={{ color: BRAND.yellow, fontSize: 12, marginTop: 3, opacity: 0.85 }}>
                      {item.descripcion}
                    </div>
                  )}
                </div>
                <div style={{
                  color: BRAND.yellow,
                  fontWeight: 900,
                  fontSize: 20,
                  whiteSpace: "nowrap",
                  marginLeft: 12,
                }}>
                  R$ {item.precio % 1 === 0 ? item.precio.toFixed(0) : item.precio.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Footer */}
        {!loading && !error && (
          <div style={{ textAlign: "center", marginTop: 24, color: "#555", fontSize: 11, letterSpacing: 1 }}>
            CAMBORIÚ ESTUDIANTIL · SINCE 1993
          </div>
        )}
      </div>
    </div>
  );
}
