import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import api, { BASE_URL } from "../api";

const TIPO_ICONS = {
  DISCO: "🎉",
  PARQUE: "🎡",
  CAMPAMENTO: "⛺",
  ZACARIAS: "🌲",
  POOL: "🌊",
  CENA: "🍽️",
  COMIDA: "🍴",
  BIENVENIDA: "🤝",
  SURF: "🏄",
  DEFAULT: "🎟️"
};

function getTipoIcon(tipo) {
  return TIPO_ICONS[(tipo || "").toUpperCase()] || TIPO_ICONS.DEFAULT;
}

export default function ControlConsumosEmpresa() {
  const { codigo } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("TODOS");
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    async function loadConsumos() {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get(`/vouchers/empresa/${codigo}/consumos`);
        setData(res.data);
      } catch (err) {
        console.error("Error al cargar consumos:", err);
        setError(err.response?.data?.detail || "No se pudo acceder al control de consumos de esta empresa.");
      } finally {
        setLoading(false);
      }
    }
    loadConsumos();
  }, [codigo]);

  const consumos = useMemo(() => data?.consumos || [], [data]);

  // Tipos únicos presentes
  const tiposDisponibles = useMemo(() => {
    const setTipos = new Set(consumos.map((c) => (c.tipo_servicio || "OTRO").toUpperCase()));
    return ["TODOS", ...Array.from(setTipos)];
  }, [consumos]);

  // Filtrado
  const consumosFiltrados = useMemo(() => {
    return consumos.filter((item) => {
      const matchTipo = filtroTipo === "TODOS" || (item.tipo_servicio || "").toUpperCase() === filtroTipo;
      const term = searchTerm.toLowerCase().trim();
      const matchSearch =
        !term ||
        (item.servicio || "").toLowerCase().includes(term) ||
        (item.grupo || "").toLowerCase().includes(term) ||
        (item.token || "").toLowerCase().includes(term) ||
        (item.scan_fecha || "").toLowerCase().includes(term);
      return matchTipo && matchSearch;
    });
  }, [consumos, filtroTipo, searchTerm]);

  const totalPaxFiltrado = useMemo(() => {
    return consumosFiltrados.reduce((sum, item) => sum + (item.pax || 0), 0);
  }, [consumosFiltrados]);

  const copiarEnlace = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    });
  };

  const enviarWhatsApp = () => {
    const texto = `Hola, adjuntamos el Acta Formal de Control de Vouchers y Consumos utilizados de *${data?.empresa}* para su auditoría y conformidad: ${window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
  };

  const excelUrl = `${BASE_URL}/vouchers/empresa/${codigo}/consumos/excel`;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0f172a", color: "#f8fafc", fontFamily: "'Inter', sans-serif" }}>
        <div style={{ width: 44, height: 44, border: "4px solid rgba(255,255,255,0.1)", borderTopColor: "#38bdf8", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <p style={{ marginTop: 16, color: "#94a3b8" }}>Cargando auditoría formal de consumos...</p>
        <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0f172a", color: "#f8fafc", padding: 24, fontFamily: "'Inter', sans-serif" }}>
        <div style={{ fontSize: "3rem", marginBottom: 12 }}>🔒</div>
        <h2 style={{ margin: "0 0 8px", color: "#f87171" }}>Acceso no disponible</h2>
        <p style={{ color: "#94a3b8", textAlign: "center", maxWidth: 460 }}>{error}</p>
        <Link to={`/vouchers/${codigo}`} style={{ marginTop: 16, color: "#38bdf8", textDecoration: "underline" }}>
          Ir a mis Vouchers
        </Link>
      </div>
    );
  }

  return (
    <div className="control-consumos-container" style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      
      {/* BARRA SUPERIOR DE ACCIONES (NO SE IMPRIME) */}
      <header className="no-print" style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        color: "white", padding: "14px 24px", position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)", display: "flex", flexWrap: "wrap",
        alignItems: "center", justifyContent: "space-between", gap: 14
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: "1.4rem" }}>📋</span>
          <div>
            <div style={{ fontSize: "0.75rem", letterSpacing: "0.08em", color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>
              Control Formal de Consumos
            </div>
            <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "white" }}>
              {data?.empresa}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Link
            to={`/vouchers/${codigo}`}
            style={{
              padding: "7px 14px", borderRadius: 8, background: "rgba(255,255,255,0.08)",
              color: "#cbd5e1", textDecoration: "none", fontSize: "0.85rem", fontWeight: 600,
              border: "1px solid rgba(255,255,255,0.15)", display: "inline-flex", alignItems: "center", gap: 6
            }}
          >
            🎟️ Ver Vouchers
          </Link>

          <button
            onClick={copiarEnlace}
            style={{
              padding: "7px 14px", borderRadius: 8, background: copiado ? "#15803d" : "rgba(255,255,255,0.08)",
              color: "white", border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer",
              fontSize: "0.85rem", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6,
              transition: "background 0.2s ease"
            }}
          >
            {copiado ? "✓ Link Copiado" : "🔗 Copiar Link"}
          </button>

          <button
            onClick={enviarWhatsApp}
            style={{
              padding: "7px 14px", borderRadius: 8, background: "#16a34a",
              color: "white", border: "none", cursor: "pointer",
              fontSize: "0.85rem", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6
            }}
          >
            📲 WhatsApp
          </button>

          <a
            href={excelUrl}
            download
            style={{
              padding: "7px 14px", borderRadius: 8, background: "#0284c7",
              color: "white", textDecoration: "none", border: "none", cursor: "pointer",
              fontSize: "0.85rem", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6
            }}
          >
            📥 Excel
          </a>

          <button
            onClick={() => window.print()}
            style={{
              padding: "7px 18px", borderRadius: 8, background: "linear-gradient(135deg, #7c3aed, #9333ea)",
              color: "white", border: "none", cursor: "pointer",
              fontSize: "0.85rem", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6,
              boxShadow: "0 2px 10px rgba(124,58,237,0.3)"
            }}
          >
            🖨️ Imprimir / Guardar PDF
          </button>
        </div>
      </header>

      {/* DOCUMENTO PRINCIPAL */}
      <main style={{ maxWidth: 1040, margin: "0 auto", padding: "32px 24px" }}>
        
        {/* ENCABEZADO FORMAL IMPRESO */}
        <section style={{
          background: "white", borderRadius: 16, border: "1px solid #e2e8f0",
          padding: "28px 32px", marginBottom: 24, boxShadow: "0 2px 12px rgba(15,23,42,0.04)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, borderBottom: "2px solid #0f172a", paddingBottom: 18, marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", color: "#64748b" }}>
                CAMBORIÚ ESTUDIANTIL
              </div>
              <h1 style={{ margin: "4px 0 6px", fontSize: "1.65rem", fontWeight: 900, color: "#0f172a", letterSpacing: "-0.02em" }}>
                ACTA FORMAL DE VOUCHERS Y CONSUMOS REALIZADOS
              </h1>
              <p style={{ margin: 0, color: "#475569", fontSize: "0.88rem" }}>
                Certificado oficial de canjes y validaciones ópticas de QR en puntos de acceso autorizados
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ display: "inline-block", background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", padding: "4px 12px", borderRadius: 999, fontSize: "0.78rem", fontWeight: 700, marginBottom: 6 }}>
                ✔ REGISTRO ELECTRÓNICO OFICIAL
              </div>
              <div style={{ fontSize: "0.82rem", color: "#64748b" }}>
                <strong>Fecha de Emisión:</strong> {data?.fecha_emision}
              </div>
              <div style={{ fontSize: "0.78rem", color: "#94a3b8", fontFamily: "monospace" }}>
                Cód: {codigo}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, background: "#f8fafc", padding: "16px 20px", borderRadius: 12, border: "1px solid #f1f5f9" }}>
            <div>
              <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Empresa / Agencia</span>
              <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a" }}>{data?.empresa}</div>
            </div>
            <div>
              <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Total Vouchers Quemados</span>
              <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#2563eb" }}>{data?.total_vouchers} vouchers</div>
            </div>
            <div>
              <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Total Pasajeros (PAX) Validados</span>
              <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#16a34a" }}>{data?.total_pax} personas</div>
            </div>
          </div>
        </section>

        {/* TARJETAS RESUMEN POR SERVICIO */}
        {data?.resumen_tipos && Object.keys(data.resumen_tipos).length > 0 && (
          <section className="no-print" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
            {Object.entries(data.resumen_tipos).map(([tipo, cant]) => (
              <div key={tipo} style={{
                flex: "1 1 160px", background: "white", padding: "14px 18px", borderRadius: 12,
                border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.03)", display: "flex", alignItems: "center", gap: 12
              }}>
                <span style={{ fontSize: "1.6rem" }}>{getTipoIcon(tipo)}</span>
                <div>
                  <div style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>{tipo}</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>{cant} PAX</div>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* FILTROS EN PANTALLA (NO SE IMPRIMEN) */}
        <section className="no-print" style={{
          background: "white", padding: "14px 20px", borderRadius: 12, border: "1px solid #e2e8f0",
          marginBottom: 16, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#475569" }}>Filtrar:</span>
            {tiposDisponibles.map((t) => (
              <button
                key={t}
                onClick={() => setFiltroTipo(t)}
                style={{
                  padding: "5px 12px", borderRadius: 20, fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
                  border: filtroTipo === t ? "1px solid #0284c7" : "1px solid #cbd5e1",
                  background: filtroTipo === t ? "#0284c7" : "white",
                  color: filtroTipo === t ? "white" : "#475569",
                  transition: "all 0.15s ease"
                }}
              >
                {t}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="text"
              placeholder="Buscar por grupo o servicio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: "6px 14px", borderRadius: 8, border: "1px solid #cbd5e1",
                fontSize: "0.85rem", width: 220, outline: "none"
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "0.9rem" }}
              >
                ✕
              </button>
            )}
          </div>
        </section>

        {/* TABLA PRINCIPAL DE VOUCHERS QUEMADOS */}
        <section style={{
          background: "white", borderRadius: 16, border: "1px solid #e2e8f0",
          overflow: "hidden", boxShadow: "0 2px 12px rgba(15,23,42,0.04)", marginBottom: 30
        }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "#0f172a" }}>
              Detalle de Vouchers Quemados ({consumosFiltrados.length})
            </h3>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#16a34a" }}>
              Total: {totalPaxFiltrado} PAX
            </span>
          </div>

          {consumosFiltrados.length === 0 ? (
            <div style={{ padding: "50px 20px", textAlign: "center", color: "#64748b" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>🎟️</div>
              <h4 style={{ margin: "0 0 6px", color: "#0f172a" }}>No hay consumos registrados</h4>
              <p style={{ margin: 0, fontSize: "0.88rem" }}>
                {consumos.length === 0
                  ? "Aún no se ha validado ni quemado ningún voucher para esta empresa."
                  : "No hay registros que coincidan con los filtros aplicados."}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#0f172a", color: "white", fontSize: "0.78rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    <th style={{ padding: "12px 16px" }}>Horario de Escaneo (Quema)</th>
                    <th style={{ padding: "12px 16px" }}>Servicio / Evento</th>
                    <th style={{ padding: "12px 16px" }}>Fecha Prog.</th>
                    <th style={{ padding: "12px 16px" }}>Grupo / Colegio</th>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>PAX</th>
                    <th style={{ padding: "12px 16px" }}>Token QR / Auditoría</th>
                    <th style={{ padding: "12px 16px", textAlign: "center" }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {consumosFiltrados.map((item, idx) => (
                    <tr
                      key={item.id + "-" + idx}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        background: idx % 2 === 0 ? "white" : "#fafafa",
                      }}
                    >
                      {/* HORARIO DE QUEMA */}
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ color: "#2563eb", fontWeight: 800 }}>⏰ {item.scan_hora}</span>
                          <span style={{ color: "#64748b", fontSize: "0.78rem" }}>({item.scan_fecha})</span>
                        </div>
                      </td>

                      {/* SERVICIO */}
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: 6 }}>
                          <span>{getTipoIcon(item.tipo_servicio)}</span>
                          <span>{item.servicio}</span>
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase" }}>
                          {item.tipo_servicio} {item.es_opcional ? "· Opcional Vendido" : ""}
                        </div>
                      </td>

                      {/* FECHA PROGRAMADA */}
                      <td style={{ padding: "12px 16px", color: "#475569", whiteSpace: "nowrap" }}>
                        {item.fecha_evento}
                      </td>

                      {/* GRUPO */}
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontWeight: 700, color: "#1e293b" }}>{item.grupo}</span>
                      </td>

                      {/* PAX */}
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "#0f172a" }}>
                          {item.pax}
                        </span>
                        {!item.es_opcional && item.tipo !== "COMIDA" && (
                          <div style={{ fontSize: "0.7rem", color: "#64748b" }}>
                            {item.estudiantes}E · {item.padres}P · {item.guias}G
                          </div>
                        )}
                      </td>

                      {/* TOKEN DE AUDITORÍA */}
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          fontFamily: "monospace", fontSize: "0.78rem", background: "#f1f5f9",
                          padding: "3px 8px", borderRadius: 4, color: "#334155", border: "1px solid #e2e8f0"
                        }}>
                          {item.token_corto || item.token.slice(0, 8)}
                        </span>
                      </td>

                      {/* ESTADO */}
                      <td style={{ padding: "12px 16px", textAlign: "center", whiteSpace: "nowrap" }}>
                        <span style={{
                          background: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0",
                          borderRadius: 999, padding: "3px 10px", fontSize: "0.72rem", fontWeight: 800,
                          letterSpacing: "0.03em"
                        }}>
                          ✔ VALIDADO
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#f8fafc", borderTop: "2px solid #0f172a", fontWeight: 800 }}>
                    <td colSpan={4} style={{ padding: "14px 16px", fontSize: "0.9rem" }}>
                      TOTAL GENERAL DE CONSUMOS
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right", fontSize: "1.05rem", color: "#16a34a" }}>
                      {totalPaxFiltrado} PAX
                    </td>
                    <td colSpan={2} style={{ padding: "14px 16px", color: "#64748b", fontSize: "0.8rem", textAlign: "right" }}>
                      {consumosFiltrados.length} Vouchers Certificados
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        {/* PIE DE PÁGINA FORMAL Y FIRMAS */}
        <footer style={{
          background: "white", borderRadius: 16, border: "1px solid #e2e8f0",
          padding: "24px 32px", boxShadow: "0 2px 12px rgba(15,23,42,0.04)"
        }}>
          <div style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.6, marginBottom: 28, borderBottom: "1px solid #e2e8f0", paddingBottom: 16 }}>
            <strong>Constancia Técnica de Validez:</strong> Los consumos y accesos consignados en el presente informe
            han sido registrados en tiempo real mediante lectores ópticos de código QR único por el personal de control
            en puerta de cada complejo y establecimiento. Cada registro cuenta con sello de tiempo (timestamp)
            irreversible, certificando fehacientemente el efectivo ingreso y consumo de los contingentes correspondientes.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginTop: 20 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ borderBottom: "1px solid #94a3b8", height: 50, marginBottom: 8 }} />
              <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#0f172a" }}>
                Coordinador General / Responsable
              </div>
              <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                {data?.empresa} (Agencia de Viajes)
              </div>
            </div>

            <div style={{ textAlign: "center" }}>
              <div style={{ borderBottom: "1px solid #94a3b8", height: 50, marginBottom: 8 }} />
              <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#0f172a" }}>
                Coordinación Operativa en Destino
              </div>
              <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                Camboriú Estudiantil
              </div>
            </div>
          </div>
        </footer>

      </main>

      {/* ESTILOS DE IMPRESIÓN */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body, .control-consumos-container {
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          main {
            max-width: 100% !important;
            padding: 10px !important;
          }
          section, footer {
            box-shadow: none !important;
            border: 1px solid #ccc !important;
            page-break-inside: avoid;
          }
          table {
            font-size: 0.78rem !important;
          }
          th, td {
            padding: 6px 10px !important;
          }
        }
      `}</style>
    </div>
  );
}
