import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import api, { BASE_URL } from "../api";

const TIPO_META = {
  DISCO:      { emoji: "\uD83C\uDF89", color: "#a855f7", bg: "rgba(168,85,247,0.15)" },
  PARQUE:     { emoji: "\uD83C\uDF61", color: "#22c55e", bg: "rgba(34,197,94,0.13)" },
  CAMPAMENTO: { emoji: "\u26FA", color: "#f97316", bg: "rgba(249,115,22,0.13)" },
  ZACARIAS:   { emoji: "\uD83C\uDF32", color: "#16a34a", bg: "rgba(22,163,74,0.13)" },
  POOL:       { emoji: "\uD83C\uDF0A", color: "#38bdf8", bg: "rgba(56,189,248,0.13)" },
  CENA:       { emoji: "\uD83C\uDF7D\uFE0F", color: "#fb923c", bg: "rgba(251,146,60,0.13)" },
  BIENVENIDA: { emoji: "\uD83E\uDD1D", color: "#facc15", bg: "rgba(250,204,21,0.13)" },
  SURF:       { emoji: "\uD83C\uDFC4", color: "#06b6d4", bg: "rgba(6,182,212,0.13)" },
  DEFAULT:    { emoji: "\uD83C\uDFAB", color: "#94a3b8", bg: "rgba(148,163,184,0.1)" },
};

function getMeta(tipo) {
  return TIPO_META[(tipo || "").toUpperCase()] || TIPO_META.DEFAULT;
}

function formatFecha(isoDate) {
  if (!isoDate) return "";
  const d = new Date(isoDate + "T12:00:00");
  return d.toLocaleDateString("es-AR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function Tag({ children, color }) {
  return (
    <span style={{
      background: color + "18",
      border: "1px solid " + color + "30",
      color,
      borderRadius: 999,
      padding: "2px 8px",
      fontSize: "0.72rem",
      fontWeight: 600,
    }}>
      {children}
    </span>
  );
}

function InfoPill({ label, value, fullWidth }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 12,
      padding: "10px 12px",
      gridColumn: fullWidth ? "1 / -1" : undefined,
    }}>
      <div style={{ color: "#64748b", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ color: "white", fontWeight: 600, fontSize: "0.88rem", lineHeight: 1.3 }}>
        {value}
      </div>
    </div>
  );
}

function SectionLabel({ text, count, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <span style={{ color, fontWeight: 700, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {text}
      </span>
      <span style={{ background: color + "20", color, borderRadius: 999, padding: "1px 8px", fontSize: "0.72rem", fontWeight: 700 }}>
        {count}
      </span>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
    </div>
  );
}

function QRModal({ voucher, onClose }) {
  const meta = getMeta(voucher.tipo);
  const qrUrl = BASE_URL + "/vouchers/qr/" + voucher.asignacion_id;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.92)",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
      zIndex: 1000,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 20px",
      overflowY: "auto",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "linear-gradient(160deg, #0f172a 0%, #1e293b 100%)",
        border: "1px solid " + meta.color + "40",
        borderRadius: 28,
        padding: "28px 24px",
        width: "100%",
        maxWidth: 400,
        boxShadow: "0 0 60px " + meta.color + "30, 0 32px 64px rgba(0,0,0,0.6)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
      }}>
        {/* Badge + title */}
        <div style={{ textAlign: "center", width: "100%" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: meta.bg, border: "1px solid " + meta.color + "50",
            borderRadius: 999, padding: "6px 16px", marginBottom: 10,
          }}>
            <span style={{ fontSize: "1.1rem" }}>{meta.emoji}</span>
            <span style={{ color: meta.color, fontWeight: 700, fontSize: "0.85rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              {voucher.tipo}
            </span>
          </div>
          <h2 style={{ margin: 0, color: "white", fontSize: "1.4rem", fontWeight: 800, lineHeight: 1.2 }}>
            {voucher.evento}
          </h2>
          {voucher.tematica && (
            <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: "0.85rem" }}>
              {voucher.tematica}
            </p>
          )}
        </div>

        {/* QR */}
        <div style={{
          background: "white", borderRadius: 20, padding: 12,
          width: "100%", maxWidth: 320,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}>
          {voucher.usado ? (
            <div style={{
              aspectRatio: "1", display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 12,
              color: "#ef4444", background: "#fef2f2", borderRadius: 12,
            }}>
              <span style={{ fontSize: "3rem" }}>&#x2717;</span>
              <span style={{ fontWeight: 700, fontSize: "1rem" }}>Voucher ya utilizado</span>
              {voucher.fecha_uso && (
                <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                  {voucher.fecha_uso.slice(0, 16).replace("T", " ")}
                </span>
              )}
            </div>
          ) : (
            <img src={qrUrl} alt="QR Voucher" style={{ width: "100%", height: "auto", display: "block", borderRadius: 8 }} />
          )}
        </div>

        {/* Info grid */}
        <div style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <InfoPill label="Fecha" value={formatFecha(voucher.fecha)} fullWidth />
          <InfoPill label="Grupo" value={voucher.grupo} />
          <InfoPill label="PAX" value={voucher.pax + " personas"} />
          {voucher.comida && <InfoPill label="Acceso" value={voucher.comida} />}
          {voucher.tipo === "DISCO" && (
            <InfoPill label="Alcohol" value={voucher.con_alcohol ? "Con alcohol" : "Sin alcohol"} />
          )}
        </div>

        {/* Tip */}
        {!voucher.usado && (
          <div style={{
            background: "rgba(250,204,21,0.08)",
            border: "1px solid rgba(250,204,21,0.25)",
            borderRadius: 12, padding: "10px 14px",
            display: "flex", alignItems: "center", gap: 10, width: "100%",
          }}>
            <span style={{ fontSize: "1.1rem" }}>&#128248;</span>
            <span style={{ color: "#fde68a", fontSize: "0.8rem", lineHeight: 1.4 }}>
              Guard&#225; una captura de pantalla como respaldo para el d&#237;a del evento.
            </span>
          </div>
        )}

        {/* Close */}
        <button onClick={onClose} style={{
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 999, color: "#94a3b8",
          padding: "12px 32px", fontSize: "0.9rem", fontWeight: 600,
          cursor: "pointer", width: "100%", letterSpacing: "0.02em",
        }}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

function VoucherCard({ voucher, onClick }) {
  const meta = getMeta(voucher.tipo);
  const usado = voucher.usado;

  return (
    <button onClick={onClick} style={{
      width: "100%",
      background: usado
        ? "rgba(15,23,42,0.4)"
        : "linear-gradient(135deg, rgba(15,23,42,0.85) 0%, rgba(30,41,59,0.85) 100%)",
      border: usado ? "1px solid rgba(148,163,184,0.12)" : "1px solid " + meta.color + "30",
      borderRadius: 20, padding: "20px",
      cursor: usado ? "default" : "pointer",
      textAlign: "left",
      display: "flex", alignItems: "center", gap: 16,
      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
      boxShadow: usado ? "none" : "0 4px 24px " + meta.color + "15",
      transition: "transform 0.15s ease, box-shadow 0.15s ease",
      opacity: usado ? 0.55 : 1,
      WebkitTapHighlightColor: "transparent",
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 16,
        background: meta.bg, border: "1px solid " + meta.color + "40",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "1.6rem", flexShrink: 0,
      }}>
        {meta.emoji}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: usado ? "#64748b" : "white",
          fontWeight: 700, fontSize: "1rem",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          marginBottom: 3,
        }}>
          {voucher.evento}
          {voucher.tematica && (
            <span style={{ color: meta.color, fontWeight: 500, fontSize: "0.82rem", marginLeft: 6 }}>
              &middot; {voucher.tematica}
            </span>
          )}
        </div>
        <div style={{ color: "#64748b", fontSize: "0.82rem", marginBottom: 4, textTransform: "capitalize" }}>
          {formatFecha(voucher.fecha)}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Tag color={meta.color}>{voucher.grupo}</Tag>
          <Tag color="#94a3b8">{voucher.pax} PAX</Tag>
          {voucher.comida && <Tag color="#94a3b8">{voucher.comida}</Tag>}
        </div>
      </div>

      <div style={{ flexShrink: 0 }}>
        {usado ? (
          <span style={{
            background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)",
            color: "#ef4444", borderRadius: 999, padding: "4px 10px",
            fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.05em",
          }}>
            USADO
          </span>
        ) : (
          <div style={{
            width: 36, height: 36, borderRadius: 999,
            background: meta.color + "20", border: "1px solid " + meta.color + "40",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: meta.color, fontSize: "1.2rem",
          }}>
            &#8250;
          </div>
        )}
      </div>
    </button>
  );
}

export default function VouchersEmpresa() {
  const { codigo } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const res = await api.get("/vouchers/empresa/" + codigo);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "No se pudo cargar tus vouchers.");
    } finally {
      setLoading(false);
    }
  }, [codigo]);

  useEffect(() => { cargar(); }, [cargar]);

  if (loading) return (
    <div style={fullScreen}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%",
          border: "3px solid rgba(236,72,153,0.3)",
          borderTopColor: "#ec4899",
          animation: "spin 0.8s linear infinite",
          margin: "0 auto 16px",
        }} />
        <p style={{ color: "#64748b", fontSize: "0.95rem" }}>Cargando tus vouchers...</p>
        <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
      </div>
    </div>
  );

  if (error) return (
    <div style={fullScreen}>
      <div style={{ textAlign: "center", padding: "0 24px" }}>
        <div style={{ fontSize: "3rem", marginBottom: 16 }}>&#128274;</div>
        <h2 style={{ color: "white", fontWeight: 800, margin: "0 0 8px" }}>Acceso no disponible</h2>
        <p style={{ color: "#64748b", fontSize: "0.95rem" }}>{error}</p>
      </div>
    </div>
  );

  const vouchers = data?.vouchers || [];
  const disponibles = vouchers.filter((v) => !v.usado);
  const usados = vouchers.filter((v) => v.usado);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #0a0f1e 0%, #0f172a 50%, #1a0a2e 100%)",
      fontFamily: "'Inter', -apple-system, sans-serif",
      paddingBottom: 40,
    }}>
      <div style={{
        position: "fixed", top: "-15%", right: "-15%",
        width: 400, height: 400, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(168,85,247,0.12) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "fixed", bottom: "-10%", left: "-10%",
        width: 350, height: 350, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(56,189,248,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Header */}
      <div style={{ padding: "32px 20px 20px", textAlign: "center", position: "relative" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.25)",
          borderRadius: 999, padding: "6px 16px", marginBottom: 14,
        }}>
          <span style={{ fontSize: "0.75rem", color: "#ec4899", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Cambori&#250; Estudiantil
          </span>
        </div>
        <h1 style={{
          margin: "0 0 6px", color: "white",
          fontSize: "1.8rem", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.1,
        }}>
          {data?.empresa || "Mis Vouchers"}
        </h1>
        <p style={{ color: "#64748b", margin: 0, fontSize: "0.9rem" }}>
          {disponibles.length} voucher{disponibles.length !== 1 ? "s" : ""} disponible{disponibles.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Cards */}
      <div style={{ padding: "0 16px", maxWidth: 480, margin: "0 auto" }}>
        {vouchers.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#475569" }}>
            <div style={{ fontSize: "3rem", marginBottom: 16 }}>&#127915;</div>
            <p style={{ fontSize: "1rem", fontWeight: 600, color: "#64748b" }}>
              No ten&#233;s vouchers disponibles a&#250;n.
            </p>
            <p style={{ fontSize: "0.85rem", marginTop: 8 }}>
              Contact&#225; a tu coordinador para m&#225;s informaci&#243;n.
            </p>
          </div>
        ) : (
          <>
            {disponibles.length > 0 && (
              <section style={{ marginBottom: 28 }}>
                <SectionLabel text="Disponibles" count={disponibles.length} color="#22c55e" />
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {disponibles.map((v) => (
                    <VoucherCard key={v.voucher_id} voucher={v} onClick={() => setSelected(v)} />
                  ))}
                </div>
              </section>
            )}
            {usados.length > 0 && (
              <section>
                <SectionLabel text="Ya utilizados" count={usados.length} color="#64748b" />
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {usados.map((v) => (
                    <VoucherCard key={v.voucher_id} voucher={v} onClick={() => setSelected(v)} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
        <p style={{ textAlign: "center", color: "#334155", fontSize: "0.75rem", marginTop: 36 }}>
          &#169; 2026 Cambori&#250; Estudiantil
        </p>
      </div>

      {selected && <QRModal voucher={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

const fullScreen = {
  minHeight: "100vh",
  background: "linear-gradient(160deg, #0a0f1e 0%, #0f172a 100%)",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontFamily: "'Inter', -apple-system, sans-serif",
};
