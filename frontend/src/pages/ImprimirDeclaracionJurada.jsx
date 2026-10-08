import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import api from "../api";

// Íconos de servicios para el documento
const SERVICIO_ICONS = {
  "Discotecas": "🎉",
  "Parque": "🎡",
  "Campamento Americano": "⛺",
  "Zacarias": "🌲",
  "Pool / Water": "🌊",
  "Cena de Velas": "🍽️",
  "Bar de Hielo": "🧊",
  "Surf": "🏄",
  "Parque Unipraias": "🎢",
  "Beto Carrero": "🎠",
  "Barco Pirata": "⚓",
  "Cristo Luz": "✝️",
  "Sunset": "🌅",
  "Quinta Comida": "🍴",
  "Multiparque": "🎪",
  "Combo": "🎟️",
};

function formatFechaCorta(isoDate) {
  if (!isoDate) return "-";
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

function hoyFormateado() {
  const now = new Date();
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  return `${now.getDate()} de ${meses[now.getMonth()]} de ${now.getFullYear()}`;
}

export default function ImprimirDeclaracionJurada() {
  const { empresaId } = useParams();
  const [resumen, setResumen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasPrinted, setHasPrinted] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get(`/finanzas/resumen/${empresaId}`);
        setResumen(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || err.message || "Error al cargar datos");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [empresaId]);

  useEffect(() => {
    if (!loading && resumen && !hasPrinted) {
      const timer = setTimeout(() => {
        setHasPrinted(true);
        window.print();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [loading, resumen, hasPrinted]);

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center", fontFamily: "Arial, sans-serif" }}>
      Cargando declaración jurada...
    </div>
  );

  if (error) return (
    <div style={{ padding: 40, color: "red", fontFamily: "Arial, sans-serif" }}>
      Error: {error}
    </div>
  );

  const empresaNombre = resumen?.empresa || "";
  const grupos = resumen?.grupos || [];
  const totalVouchers = grupos.reduce((sum, g) =>
    sum + (g.servicios || []).reduce((ss, s) => ss + (s.cantidad || 1), 0)
  , 0);
  const fechaHoy = hoyFormateado();

  return (
    <div style={{ fontFamily: "Arial, sans-serif", background: "white" }}>
      {/* Barra de control - solo visible en pantalla */}
      <div className="no-print" style={{
        background: "#1e293b", color: "white",
        padding: "12px 20px", display: "flex",
        gap: 12, alignItems: "center", justifyContent: "space-between"
      }}>
        <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>
          📄 Declaración Jurada — {empresaNombre}
        </span>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => window.print()}
            style={{ padding: "8px 18px", background: "#3b82f6", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}
          >
            🖨️ Imprimir
          </button>
          <button
            onClick={() => window.close()}
            style={{ padding: "8px 18px", background: "#475569", color: "white", border: "none", borderRadius: 6, cursor: "pointer" }}
          >
            ✕ Cerrar
          </button>
        </div>
      </div>

      {/* DOCUMENTO PRINCIPAL */}
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "30px 40px" }}>

        {/* Encabezado */}
        <div style={{ textAlign: "center", borderBottom: "3px solid #1e293b", paddingBottom: 16, marginBottom: 20 }}>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#64748b", marginBottom: 4 }}>
            Camboriu Estudiantil 2026
          </div>
          <h1 style={{ margin: "0 0 4px", fontSize: "1.5rem", fontWeight: 900, color: "#0f172a" }}>
            DECLARACIÓN JURADA DE RECEPCIÓN DE VOUCHERS
          </h1>
          <div style={{ fontSize: "0.85rem", color: "#475569" }}>
            Fecha de emisión: {fechaHoy}
          </div>
        </div>

        {/* Cuerpo de la declaración */}
        <div style={{ marginBottom: 20, lineHeight: 1.8, fontSize: "0.95rem", color: "#1e293b" }}>
          <p style={{ margin: "0 0 12px" }}>
            Yo, <span style={{ borderBottom: "1px solid #94a3b8", display: "inline-block", minWidth: 220 }}>&nbsp;</span>,
            titular del documento de identidad N.° <span style={{ borderBottom: "1px solid #94a3b8", display: "inline-block", minWidth: 120 }}>&nbsp;</span>,
            en representación de la empresa / institución
            <strong> {empresaNombre || "_____________________"}</strong>, declaro bajo juramento que:
          </p>

          <ol style={{ margin: "0 0 14px", paddingLeft: 20, lineHeight: 2 }}>
            <li>
              He recibido en la oficina de <strong>Camboriu Estudiantil</strong>, en perfectas condiciones y listos para su uso,
              la totalidad de los vouchers detallados a continuación, correspondientes al viaje de estudios <strong>Estudiantil 2026</strong>.
            </li>
            <li>
              Los vouchers recibidos son válidos únicamente para los grupos, fechas y servicios especificados en el presente documento.
            </li>
            <li>
              Me comprometo a presentar dichos vouchers al momento de hacer uso de cada servicio, en la puerta del establecimiento correspondiente.
            </li>
            <li>
              El uso o no uso de los vouchers no exime a la empresa de abonar los servicios contratados, dado que los mismos fueron emitidos y entregados en tiempo y forma.
            </li>
          </ol>
        </div>

        {/* Detalle de grupos y vouchers */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 800, borderBottom: "2px solid #e2e8f0", paddingBottom: 6, marginBottom: 12, color: "#0f172a" }}>
            DETALLE DE VOUCHERS ENTREGADOS
          </h2>

          {grupos.map((g, idx) => (
            <div key={g.id || idx} style={{
              marginBottom: 14,
              border: "1px solid #e2e8f0",
              borderRadius: 6,
              overflow: "hidden",
              breakInside: "avoid",
            }}>
              {/* Cabecera del grupo */}
              <div style={{
                background: "#f8fafc",
                padding: "8px 12px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex", justifyContent: "space-between", alignItems: "center"
              }}>
                <div>
                  <strong style={{ fontSize: "0.95rem", color: "#0f172a" }}>
                    Grupo: {g.nombre}
                  </strong>
                  <span style={{ marginLeft: 12, fontSize: "0.8rem", color: "#64748b" }}>
                    {g.pax} personas en total
                    {g.fecha_entrada && g.fecha_salida && (
                      <> &nbsp;·&nbsp; {formatFechaCorta(g.fecha_entrada)} → {formatFechaCorta(g.fecha_salida)}</>
                    )}
                  </span>
                </div>
                <div style={{
                  background: "#0f172a", color: "white",
                  borderRadius: 999, padding: "2px 10px",
                  fontSize: "0.75rem", fontWeight: 700
                }}>
                  {g.pax} PAX
                </div>
              </div>

              {/* Servicios del grupo */}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9" }}>
                    <th style={{ padding: "5px 12px", textAlign: "left", fontWeight: 700, color: "#475569" }}>Servicio</th>
                    <th style={{ padding: "5px 12px", textAlign: "left", fontWeight: 700, color: "#475569" }}>Descripción</th>
                    <th style={{ padding: "5px 12px", textAlign: "center", fontWeight: 700, color: "#475569" }}>Cant.</th>
                    <th style={{ padding: "5px 12px", textAlign: "center", fontWeight: 700, color: "#475569" }}>PAX</th>
                    <th style={{ padding: "5px 12px", textAlign: "center", fontWeight: 700, color: "#475569" }}>Vouchers</th>
                  </tr>
                </thead>
                <tbody>
                  {(g.servicios || []).map((s, sIdx) => (
                    <tr key={sIdx} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "6px 12px", fontWeight: 600 }}>
                        {SERVICIO_ICONS[s.servicio] || "🎟️"} {s.servicio}
                      </td>
                      <td style={{ padding: "6px 12px", color: "#475569" }}>{s.descripcion}</td>
                      <td style={{ padding: "6px 12px", textAlign: "center" }}>{s.cantidad}</td>
                      <td style={{ padding: "6px 12px", textAlign: "center" }}>{s.pax_original}</td>
                      <td style={{ padding: "6px 12px", textAlign: "center", fontWeight: 700 }}>
                        {s.cantidad || 1}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {/* Total general */}
          <div style={{
            display: "flex", justifyContent: "flex-end", marginTop: 8
          }}>
            <div style={{
              background: "#0f172a", color: "white",
              padding: "8px 20px", borderRadius: 6,
              fontWeight: 700, fontSize: "0.95rem"
            }}>
              TOTAL VOUCHERS ENTREGADOS: {totalVouchers}
            </div>
          </div>
        </div>

        {/* Cláusula final */}
        <div style={{
          background: "#fffbeb",
          border: "1px solid #fde68a",
          borderRadius: 6,
          padding: "10px 14px",
          marginBottom: 24,
          fontSize: "0.82rem",
          color: "#78350f",
          lineHeight: 1.6,
        }}>
          <strong>⚠️ Importante:</strong> La firma de esta declaración implica la conformidad con la cantidad y estado de los vouchers
          recibidos, y el reconocimiento de la obligación de pago de los servicios contratados con Camboriu Estudiantil 2026,
          independientemente del uso efectivo de los mismos.
        </div>

        {/* Sección de firma */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 30,
          marginTop: 20,
        }}>
          {/* Firma del representante de la empresa */}
          <div style={{ textAlign: "center" }}>
            <div style={{ borderTop: "1px solid #1e293b", paddingTop: 8, marginTop: 60 }}>
              <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>Firma del Representante</div>
              <div style={{ color: "#64748b", fontSize: "0.78rem", marginTop: 4 }}>
                {empresaNombre}
              </div>
              <div style={{ marginTop: 10, fontSize: "0.78rem", color: "#64748b" }}>
                Nombre y Apellido: <span style={{ borderBottom: "1px solid #94a3b8", display: "inline-block", minWidth: 160 }}>&nbsp;</span>
              </div>
              <div style={{ marginTop: 6, fontSize: "0.78rem", color: "#64748b" }}>
                N.° Documento: <span style={{ borderBottom: "1px solid #94a3b8", display: "inline-block", minWidth: 100 }}>&nbsp;</span>
              </div>
              <div style={{ marginTop: 6, fontSize: "0.78rem", color: "#64748b" }}>
                Fecha: <span style={{ borderBottom: "1px solid #94a3b8", display: "inline-block", minWidth: 120 }}>&nbsp;</span>
              </div>
            </div>
          </div>

          {/* Firma de Camboriu Estudiantil */}
          <div style={{ textAlign: "center" }}>
            <div style={{ borderTop: "1px solid #1e293b", paddingTop: 8, marginTop: 60 }}>
              <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>Firma — Camboriu Estudiantil</div>
              <div style={{ color: "#64748b", fontSize: "0.78rem", marginTop: 4 }}>
                Responsable de entrega
              </div>
              <div style={{ marginTop: 10, fontSize: "0.78rem", color: "#64748b" }}>
                Nombre y Apellido: <span style={{ borderBottom: "1px solid #94a3b8", display: "inline-block", minWidth: 160 }}>&nbsp;</span>
              </div>
              <div style={{ marginTop: 6, fontSize: "0.78rem", color: "#64748b" }}>
                N.° Documento: <span style={{ borderBottom: "1px solid #94a3b8", display: "inline-block", minWidth: 100 }}>&nbsp;</span>
              </div>
              <div style={{ marginTop: 6, fontSize: "0.78rem", color: "#64748b" }}>
                Fecha: <span style={{ borderBottom: "1px solid #94a3b8", display: "inline-block", minWidth: 120 }}>&nbsp;</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pie de página */}
        <div style={{
          marginTop: 30, borderTop: "1px solid #e2e8f0", paddingTop: 10,
          textAlign: "center", fontSize: "0.72rem", color: "#94a3b8"
        }}>
          Documento generado por el sistema Camboriu Estudiantil 2026 · {fechaHoy}
          {empresaNombre && ` · Empresa: ${empresaNombre}`}
        </div>
      </div>

      {/* Estilos de impresión */}
      <style>{`
        @media print {
          @page { 
            size: A4; 
            margin: 15mm 12mm;
          }
          body * { visibility: hidden !important; }
          div[style*="max-width: 780px"], div[style*="max-width: 780px"] * {
            visibility: visible !important;
          }
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; background: white; }
          div[style*="max-width: 780px"] {
            position: fixed !important;
            top: 0; left: 0;
            width: 100% !important;
            padding: 0 !important;
            max-width: 100% !important;
          }
          table { break-inside: avoid; }
          div[style*="breakInside"] { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
