import { useMemo } from "react";
import React from "react";

const TIPO_META = {
  sin: { bg: "#fef08a", text: "#1e293b", label: "S/A", sepColor: "#fde047" },
  con: { bg: "#ef4444", text: "white",   label: "C/A", sepColor: "#f87171" },
  mix: { bg: "#f97316", text: "white",   label: "MIX", sepColor: "#fb923c" },
};

const MESES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];
const DIAS = ["D","L","M","X","J","V","S"];

export default function ResumenCalendarView({ resources, events, mes, anio }) {
  // Lookup: resourceId -> dateStr -> eventData
  const eventMap = useMemo(() => {
    const map = new Map();
    for (const ev of events) {
      if (!map.has(ev.resourceId)) map.set(ev.resourceId, new Map());
      const d = typeof ev.start === "string" ? ev.start.slice(0, 10) : String(ev.start);
      map.get(ev.resourceId).set(d, ev);
    }
    return map;
  }, [events]);

  // Days in selected month
  const days = useMemo(() => {
    const count = new Date(anio, mes + 1, 0).getDate();
    const todayStr = new Date().toISOString().slice(0, 10);
    return Array.from({ length: count }, (_, i) => {
      const d  = new Date(anio, mes, i + 1);
      const ds = `${anio}-${String(mes + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
      return {
        num: i + 1,
        dateStr: ds,
        dow: d.getDay(),
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        isToday: ds === todayStr,
      };
    });
  }, [mes, anio]);

  // Sort: empresa ASC -> tipo (sin<mix<con) -> fechaEntrada
  const sortedResources = useMemo(() => {
    const ord = { sin: 0, mix: 1, con: 2 };
    return [...resources].sort((a, b) => {
      const ea = (a.extendedProps?.empresaNombre || "").toLowerCase();
      const eb = (b.extendedProps?.empresaNombre || "").toLowerCase();
      if (ea !== eb) return ea.localeCompare(eb, "es");
      const ta = ord[a.extendedProps?.tipoAlcohol] ?? 9;
      const tb = ord[b.extendedProps?.tipoAlcohol] ?? 9;
      if (ta !== tb) return ta - tb;
      return (a.extendedProps?.fechaEntrada || "").localeCompare(
        b.extendedProps?.fechaEntrada || ""
      );
    });
  }, [resources]);

  // Daily totals across all rows
  const totalesDia = useMemo(() => {
    const map = new Map();
    for (const [, rm] of eventMap) {
      for (const [ds, ev] of rm) {
        if (!map.has(ds)) map.set(ds, {});
        const dest = map.get(ds);
        const sp = ev.extendedProps?.serviciosPax || {};
        for (const [k, v] of Object.entries(sp)) {
          dest[k] = (dest[k] || 0) + v;
        }
      }
    }
    return map;
  }, [eventMap]);

  if (!sortedResources.length) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#94a3b8" }}>
        No hay datos para mostrar.
      </div>
    );
  }

  const DAY_W   = 72;
  const LABEL_W = 300;

  return (
    <div style={{ width: "100%", height: "100%", overflowX: "auto", overflowY: "auto" }}>
      <table
        style={{
          borderCollapse: "collapse",
          tableLayout: "fixed",
          width: LABEL_W + days.length * DAY_W,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <colgroup>
          <col style={{ width: LABEL_W }} />
          {days.map((d) => (
            <col key={d.dateStr} style={{ width: DAY_W }} />
          ))}
        </colgroup>

        {/* ── Header ── */}
        <thead>
          <tr>
            <th
              style={{
                position: "sticky", left: 0, top: 0, zIndex: 30,
                background: "#0f172a", color: "#94a3b8",
                fontSize: "0.7rem", fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.08em",
                padding: "8px 12px", textAlign: "left",
                borderBottom: "1px solid #1e293b",
              }}
            >
              Resumen &mdash; {MESES[mes]} {anio}
            </th>
            <th
              colSpan={days.length}
              style={{
                position: "sticky", top: 0, zIndex: 20,
                background: "#0f172a", borderBottom: "1px solid #1e293b",
              }}
            />
          </tr>
          <tr>
            <th
              style={{
                position: "sticky", left: 0, top: 37, zIndex: 30,
                background: "#1e293b", color: "#64748b",
                fontSize: "0.68rem", fontWeight: 600,
                padding: "4px 12px", textAlign: "left",
                borderBottom: "2px solid #334155",
              }}
            >
              Empresa / Tipo / Rango
            </th>
            {days.map(({ num, dateStr, dow, isWeekend, isToday }) => (
              <th
                key={dateStr}
                style={{
                  position: "sticky", top: 37, zIndex: 20,
                  background: isToday ? "#2563eb" : isWeekend ? "#334155" : "#1e293b",
                  color: "white",
                  fontSize: "0.68rem", fontWeight: isToday ? 800 : 500,
                  padding: "3px 2px", textAlign: "center",
                  borderLeft: "1px solid rgba(255,255,255,0.06)",
                  borderBottom: "2px solid #334155",
                  lineHeight: 1.2,
                }}
              >
                <div>{num}</div>
                <div style={{ opacity: 0.6, fontSize: "0.6rem" }}>{DIAS[dow]}</div>
              </th>
            ))}
          </tr>
        </thead>

        {/* ── Body ── */}
        <tbody>
          {sortedResources.map((res, idx) => {
            const prev   = sortedResources[idx - 1];
            const isNew  = !prev || prev.extendedProps?.empresaNombre !== res.extendedProps?.empresaNombre;
            const ext    = res.extendedProps || {};
            const tipo   = ext.tipoAlcohol || "sin";
            const meta   = TIPO_META[tipo] || TIPO_META.sin;
            const rm     = eventMap.get(res.id) || new Map();
            const fe     = ext.fechaEntrada || "";
            const fsal   = ext.fechaSalida  || "";
            const tg     = ext.totalGrupos  || 1;

            return (
              <React.Fragment key={res.id}>
                {/* Company separator */}
                {isNew && (
                  <tr>
                    <td
                      colSpan={days.length + 1}
                      style={{ padding: 0, height: idx === 0 ? 0 : 6, background: "#e2e8f0" }}
                    />
                  </tr>
                )}

                <tr style={{ height: 48 }}>
                  {/* Left label */}
                  <td
                    style={{
                      position: "sticky", left: 0, zIndex: 5,
                      background: isNew ? "#f0f9ff" : "white",
                      borderBottom: "1px solid #e2e8f0",
                      borderRight: `3px solid ${meta.sepColor}`,
                      padding: "4px 8px", verticalAlign: "middle",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span
                        style={{
                          display: "inline-block",
                          background: meta.bg, color: meta.text,
                          borderRadius: 4, padding: "2px 7px",
                          fontSize: "0.65rem", fontWeight: 800, flexShrink: 0,
                          border: tipo === "sin" ? "1px solid #fde047" : "none",
                        }}
                      >
                        {meta.label}
                      </span>
                      <span
                        style={{
                          fontSize: "0.78rem",
                          fontWeight: isNew ? 700 : 500,
                          color: "#1e293b",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          flex: 1,
                        }}
                      >
                        {ext.empresaNombre}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.63rem", color: "#64748b", marginTop: 2, paddingLeft: 2 }}>
                      {fe.slice(5).replace("-", "/")} &rarr; {fsal.slice(5).replace("-", "/")}
                      &nbsp;&middot;&nbsp;{tg} grupo{tg !== 1 ? "s" : ""}
                    </div>
                  </td>

                  {/* Day cells */}
                  {days.map(({ dateStr, isWeekend, isToday }) => {
                    const ev      = rm.get(dateStr);
                    const inRange = dateStr >= fe && dateStr < fsal;
                    const sp      = ev?.extendedProps?.serviciosPax || null;

                    return (
                      <td
                        key={dateStr}
                        style={{
                          borderBottom: "1px solid #e2e8f0",
                          borderLeft: `1px solid ${isToday ? "#bfdbfe" : isWeekend ? "#e2e8f0" : "#f1f5f9"}`,
                          background: isToday ? "#eff6ff" : isWeekend ? "#f8fafc" : "white",
                          padding: sp ? 2 : 0,
                          verticalAlign: "middle", textAlign: "center",
                        }}
                      >
                        {sp ? (
                          <div
                            title={Object.entries(sp)
                              .map(([k, v]) => `${k}: ${v} pax`)
                              .join("\n")}
                            style={{
                              background: meta.bg, color: meta.text,
                              borderRadius: 4, padding: "2px 4px",
                              fontSize: "0.62rem", fontWeight: 700,
                              lineHeight: 1.35,
                              border: tipo === "sin" ? "1px solid #fde047" : "none",
                            }}
                          >
                            {Object.entries(sp).map(([servicio, pax]) => (
                              <div key={servicio}>
                                <b>{servicio}</b>
                                <br />
                                <span>{pax}</span>
                              </div>
                            ))}
                          </div>
                        ) : inRange ? (
                          <div
                            style={{
                              width: "100%", height: "100%", minHeight: 44,
                              background: "rgba(241,245,249,0.5)",
                            }}
                          />
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              </React.Fragment>
            );
          })}

          {/* ── Totals row ── */}
          <tr>
            <td
              style={{
                position: "sticky", left: 0, zIndex: 5,
                background: "#f8fafc",
                borderTop: "2px solid #334155",
                padding: "4px 8px",
                fontSize: "0.7rem", fontWeight: 700, color: "#1e293b",
              }}
            >
              TOTAL PAX con servicio
            </td>
            {days.map(({ dateStr, isWeekend, isToday }) => {
              const tot = totalesDia.get(dateStr);
              return (
                <td
                  key={dateStr}
                  style={{
                    borderTop: "2px solid #334155",
                    background: isToday ? "#dbeafe" : isWeekend ? "#f1f5f9" : "#f8fafc",
                    padding: 2, textAlign: "center", verticalAlign: "middle",
                    fontSize: "0.6rem", fontWeight: 700, color: "#0f172a",
                  }}
                >
                  {tot && (
                    <div style={{ lineHeight: 1.3 }}>
                      {Object.entries(tot).map(([k, v]) => (
                        <div key={k}>
                          <span style={{ opacity: 0.65 }}>{k.slice(0, 5)}</span> {v}
                        </div>
                      ))}
                    </div>
                  )}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
