import { useMemo } from "react";
import React from "react";

const TIPO_META = {
  con: { bg: "#ef4444", text: "white",   label: "C/A", sepColor: "#f87171" },
  mix: { bg: "#f97316", text: "white",   label: "MIX", sepColor: "#fb923c" },
  sin: { bg: "#fef08a", text: "#1e293b", label: "S/A", sepColor: "#fde047" },
};

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

  // Filtrar y Ordenar:
  // 1. Solo mantener los que tienen actividad en el mes seleccionado
  // 2. Ordenar por tipo (con < mix < sin) -> empresa ASC -> fechaEntrada
  const sortedResources = useMemo(() => {
    const firstDay = new Date(anio, mes, 1).toISOString().slice(0, 10);
    const lastDay = new Date(anio, mes + 1, 0).toISOString().slice(0, 10);

    const ord = { con: 0, mix: 1, sin: 2 };

    const filtrados = resources.filter(res => {
      const ext = res.extendedProps || {};
      const fe = ext.fechaEntrada || "";
      const fs = ext.fechaSalida || "";
      if (!fe || !fs) return false;
      return fe <= lastDay && fs >= firstDay;
    });

    return filtrados.sort((a, b) => {
      const ta = ord[a.extendedProps?.tipoAlcohol] ?? 9;
      const tb = ord[b.extendedProps?.tipoAlcohol] ?? 9;
      if (ta !== tb) return ta - tb;

      const ea = (a.extendedProps?.empresaNombre || "").toLowerCase();
      const eb = (b.extendedProps?.empresaNombre || "").toLowerCase();
      if (ea !== eb) return ea.localeCompare(eb, "es");

      return (a.extendedProps?.fechaEntrada || "").localeCompare(
        b.extendedProps?.fechaEntrada || ""
      );
    });
  }, [resources, mes, anio]);

  // Daily totals across all rows
  const totalesDia = useMemo(() => {
    const map = new Map();
    for (const res of sortedResources) {
      const rm = eventMap.get(res.id);
      if (!rm) continue;
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
  }, [eventMap, sortedResources]);

  if (!sortedResources.length) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#94a3b8" }}>
        No hay actividad en el mes seleccionado.
      </div>
    );
  }

  const LABEL_W = 150;

  return (
    <div style={{ width: "100%", height: "100%", overflowX: "hidden", overflowY: "auto" }}>
      <table
        style={{
          borderCollapse: "collapse",
          tableLayout: "fixed",
          width: "100%",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <colgroup>
          <col style={{ width: LABEL_W }} />
          {days.map((d) => (
            <col key={d.dateStr} />
          ))}
        </colgroup>

        {/* ── Header ── */}
        <thead>
          <tr>
            <th
              style={{
                position: "sticky", left: 0, top: 0, zIndex: 30,
                background: "#1e293b", color: "#64748b",
                fontSize: "0.65rem", fontWeight: 600,
                padding: "2px 6px", textAlign: "left",
                borderBottom: "2px solid #334155",
              }}
            >
              Empresa / Rango
            </th>
            {days.map(({ num, dateStr, dow, isWeekend, isToday }) => (
              <th
                key={dateStr}
                style={{
                  position: "sticky", top: 0, zIndex: 20,
                  background: isToday ? "#2563eb" : isWeekend ? "#334155" : "#1e293b",
                  color: "white",
                  fontSize: "0.6rem", fontWeight: isToday ? 800 : 500,
                  padding: "2px 0", textAlign: "center",
                  borderLeft: "1px solid rgba(255,255,255,0.06)",
                  borderBottom: "2px solid #334155",
                  lineHeight: 1.1,
                  wordBreak: "break-all"
                }}
              >
                <div>{num}</div>
                <div style={{ opacity: 0.6, fontSize: "0.5rem" }}>{DIAS[dow]}</div>
              </th>
            ))}
          </tr>
        </thead>

        {/* ── Body ── */}
        <tbody>
          {sortedResources.map((res, idx) => {
            const prev   = sortedResources[idx - 1];
            // Cambiamos de tipo de alcohol?
            const isNewTipo = !prev || prev.extendedProps?.tipoAlcohol !== res.extendedProps?.tipoAlcohol;
            const ext    = res.extendedProps || {};
            const tipo   = ext.tipoAlcohol || "sin";
            const meta   = TIPO_META[tipo] || TIPO_META.sin;
            const rm     = eventMap.get(res.id) || new Map();
            const fe     = ext.fechaEntrada || "";
            const fsal   = ext.fechaSalida  || "";
            const tg     = ext.totalGrupos  || 1;

            return (
              <React.Fragment key={res.id}>
                {isNewTipo && (
                  <tr>
                    <td
                      colSpan={days.length + 1}
                      style={{ padding: "4px 8px", background: meta.bg, color: meta.text, fontWeight: "bold", fontSize: "0.7rem", textAlign: "center" }}
                    >
                      {meta.label === "S/A" ? "SIN ALCOHOL" : meta.label === "C/A" ? "CON ALCOHOL" : "MIX (PULSERA)"}
                    </td>
                  </tr>
                )}

                <tr style={{ height: 32 }}>
                  {/* Left label */}
                  <td
                    style={{
                      position: "sticky", left: 0, zIndex: 5,
                      background: "white",
                      borderBottom: "1px solid #e2e8f0",
                      borderRight: `3px solid ${meta.sepColor}`,
                      padding: "2px 4px", verticalAlign: "middle",
                      overflow: "hidden"
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span
                        title={ext.empresaNombre}
                        style={{
                          fontSize: "0.65rem",
                          fontWeight: 700,
                          color: "#1e293b",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                      >
                        {ext.empresaNombre}
                      </span>
                      <div style={{ fontSize: "0.5rem", color: "#64748b", marginTop: 1 }}>
                        {fe.slice(5).replace("-", "/")} &rarr; {fsal.slice(5).replace("-", "/")} ({tg}G)
                      </div>
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
                          padding: sp ? 1 : 0,
                          verticalAlign: "middle", textAlign: "center",
                        }}
                      >
                        {sp ? (
                          <div
                            title={Object.entries(sp).map(([k, v]) => `${k}: ${v} pax`).join("\n")}
                            style={{
                              background: meta.bg, color: meta.text,
                              borderRadius: 2, padding: "1px 0",
                              fontSize: "0.45rem", fontWeight: 700,
                              lineHeight: 1.1,
                              border: tipo === "sin" ? "1px solid #fde047" : "none",
                              overflow: "hidden", textOverflow: "ellipsis",
                              whiteSpace: "nowrap"
                            }}
                          >
                            {Object.entries(sp).map(([servicio, pax]) => (
                              <div key={servicio}>
                                {servicio.substring(0,2)}:{pax}
                              </div>
                            ))}
                          </div>
                        ) : inRange ? (
                          <div
                            style={{
                              width: "100%", height: "100%", minHeight: 28,
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
                padding: "2px 4px",
                fontSize: "0.6rem", fontWeight: 700, color: "#1e293b",
              }}
            >
              TOTAL PAX
            </td>
            {days.map(({ dateStr, isWeekend, isToday }) => {
              const tot = totalesDia.get(dateStr);
              return (
                <td
                  key={dateStr}
                  style={{
                    borderTop: "2px solid #334155",
                    background: isToday ? "#dbeafe" : isWeekend ? "#f1f5f9" : "#f8fafc",
                    padding: 0, textAlign: "center", verticalAlign: "middle",
                    fontSize: "0.45rem", fontWeight: 700, color: "#0f172a",
                  }}
                >
                  {tot && (
                    <div style={{ lineHeight: 1.1 }}>
                      {Object.entries(tot).map(([k, v]) => (
                        <div key={k} title={`${k}: ${v}`}>
                          <span style={{ opacity: 0.65 }}>{k.substring(0, 1)}</span> {v}
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
