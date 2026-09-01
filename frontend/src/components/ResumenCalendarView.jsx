import { useMemo } from "react";
import React from "react";

const TIPO_META = {
  con: { bg: "#ef4444", text: "white",   label: "C/A", sepColor: "#f87171", inTownBg: "#fee2e2" },
  mix: { bg: "#f97316", text: "white",   label: "MIX", sepColor: "#fb923c", inTownBg: "#ffedd5" },
  sin: { bg: "#fef08a", text: "#1e293b", label: "S/A", sepColor: "#fde047", inTownBg: "#fef9c3" },
};

const DIAS = ["D","L","M","X","J","V","S"];

export default function ResumenCalendarView({ resources, events, mes, anio }) {
  
  // 1. Agrupar recursos por (Empresa + Tipo Alcohol) y calcular días en destino
  const groupedResources = useMemo(() => {
    const map = new Map();
    for (const res of resources) {
      const ext = res.extendedProps || {};
      const emp = ext.empresaNombre || "Sin Empresa";
      const tipo = ext.tipoAlcohol || "sin";
      const key = `${emp}-${tipo}`;

      if (!map.has(key)) {
        map.set(key, {
          id: key,
          empresaNombre: emp,
          tipoAlcohol: tipo,
          totalGrupos: 0,
          originalIds: [],
          diasPresentes: new Set()
        });
      }
      
      const group = map.get(key);
      group.totalGrupos += (ext.totalGrupos || 1);
      group.originalIds.push(res.id);

      // Calcular todos los días entre fechaEntrada y fechaSalida
      const fe = ext.fechaEntrada;
      const fs = ext.fechaSalida;
      if (fe && fs) {
        let current = fe;
        // Límite de seguridad para evitar loops infinitos si hay error en fechas
        let safety = 0; 
        while (current < fs && safety < 100) {
          group.diasPresentes.add(current);
          const d = new Date(current + 'T12:00:00Z');
          d.setUTCDate(d.getUTCDate() + 1);
          current = d.toISOString().slice(0, 10);
          safety++;
        }
      }
    }
    return Array.from(map.values());
  }, [resources]);

  // 2. Mapear eventos a las nuevas filas agrupadas
  const eventMap = useMemo(() => {
    const map = new Map(); // key -> dateStr -> { serviciosPax: {} }
    
    // Reverse lookup: originalId -> synthetic key
    const idToKey = {};
    for (const grp of groupedResources) {
      for (const origId of grp.originalIds) {
        idToKey[origId] = grp.id;
      }
    }

    for (const ev of events) {
      const key = idToKey[ev.resourceId];
      if (!key) continue;

      if (!map.has(key)) map.set(key, new Map());
      const dateMap = map.get(key);

      const d = typeof ev.start === "string" ? ev.start.slice(0, 10) : String(ev.start);
      
      if (!dateMap.has(d)) {
        dateMap.set(d, { serviciosPax: {} });
      }
      
      const destPax = dateMap.get(d).serviciosPax;
      const srcPax = ev.extendedProps?.serviciosPax || {};
      
      for (const [srv, pax] of Object.entries(srcPax)) {
        destPax[srv] = (destPax[srv] || 0) + pax;
      }
    }
    return map;
  }, [events, groupedResources]);

  // 3. Días del mes
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

  // 4. Filtrar y Ordenar
  const sortedResources = useMemo(() => {
    const firstDay = new Date(anio, mes, 1).toISOString().slice(0, 10);
    const lastDay = new Date(anio, mes + 1, 0).toISOString().slice(0, 10);

    const filtrados = groupedResources.filter(grp => {
      // Mostrar si tienen presencia en la ciudad durante el mes seleccionado
      for (const ds of grp.diasPresentes) {
        if (ds >= firstDay && ds <= lastDay) return true;
      }
      return false;
    });

    const ord = { con: 0, mix: 1, sin: 2 };
    return filtrados.sort((a, b) => {
      const ta = ord[a.tipoAlcohol] ?? 9;
      const tb = ord[b.tipoAlcohol] ?? 9;
      if (ta !== tb) return ta - tb;
      return a.empresaNombre.localeCompare(b.empresaNombre, "es");
    });
  }, [groupedResources, mes, anio]);

  // Totales por día
  const totalesDia = useMemo(() => {
    const map = new Map();
    for (const res of sortedResources) {
      const rm = eventMap.get(res.id);
      if (!rm) continue;
      for (const [ds, ev] of rm) {
        if (!map.has(ds)) map.set(ds, {});
        const dest = map.get(ds);
        const sp = ev.serviciosPax || {};
        for (const [k, v] of Object.entries(sp)) {
          dest[k] = (dest[k] || 0) + v;
        }
      }
    }
    return map;
  }, [eventMap, sortedResources]);

  if (!sortedResources.length) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#94a3b8", fontSize: "1rem" }}>
        No hay actividad en el mes seleccionado.
      </div>
    );
  }

  const LABEL_W = 200;
  const DAY_W = 55;

  return (
    <div style={{ width: "100%", height: "100%", overflowX: "auto", overflowY: "auto" }}>
      <table
        style={{
          borderCollapse: "collapse",
          tableLayout: "fixed",
          width: LABEL_W + (days.length * DAY_W),
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <colgroup>
          <col style={{ width: LABEL_W }} />
          {days.map((d) => (
            <col key={d.dateStr} style={{ width: DAY_W }} />
          ))}
        </colgroup>

        <thead>
          <tr>
            <th
              style={{
                position: "sticky", left: 0, top: 0, zIndex: 30,
                background: "#1e293b", color: "#64748b",
                fontSize: "0.75rem", fontWeight: 600,
                padding: "4px 8px", textAlign: "left",
                borderBottom: "2px solid #334155",
              }}
            >
              Empresa
            </th>
            {days.map(({ num, dateStr, dow, isWeekend, isToday }) => (
              <th
                key={dateStr}
                style={{
                  position: "sticky", top: 0, zIndex: 20,
                  background: isToday ? "#2563eb" : isWeekend ? "#334155" : "#1e293b",
                  color: "white",
                  fontSize: "0.75rem", fontWeight: isToday ? 800 : 500,
                  padding: "4px 2px", textAlign: "center",
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

        <tbody>
          {sortedResources.map((res, idx) => {
            const prev   = sortedResources[idx - 1];
            const isNewTipo = !prev || prev.tipoAlcohol !== res.tipoAlcohol;
            const tipo   = res.tipoAlcohol || "sin";
            const meta   = TIPO_META[tipo] || TIPO_META.sin;
            const rm     = eventMap.get(res.id) || new Map();
            const tg     = res.totalGrupos;

            return (
              <React.Fragment key={res.id}>
                {isNewTipo && (
                  <tr>
                    <td
                      colSpan={days.length + 1}
                      style={{ padding: "6px 8px", background: meta.bg, color: meta.text, fontWeight: "bold", fontSize: "0.8rem", textAlign: "center" }}
                    >
                      {meta.label === "S/A" ? "SIN ALCOHOL" : meta.label === "C/A" ? "CON ALCOHOL" : "MIX (PULSERA)"}
                    </td>
                  </tr>
                )}

                <tr style={{ height: 48 }}>
                  <td
                    style={{
                      position: "sticky", left: 0, zIndex: 5,
                      background: "white",
                      borderBottom: "1px solid #e2e8f0",
                      borderRight: `3px solid ${meta.sepColor}`,
                      padding: "4px 8px", verticalAlign: "middle",
                      overflow: "hidden"
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span
                        title={res.empresaNombre}
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          color: "#1e293b",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                      >
                        {res.empresaNombre}
                      </span>
                      <div style={{ fontSize: "0.65rem", color: "#64748b", marginTop: 2 }}>
                        {tg} grupo{tg !== 1 ? "s" : ""} en total
                      </div>
                    </div>
                  </td>

                  {days.map(({ dateStr, isWeekend, isToday }) => {
                    const ev = rm.get(dateStr);
                    const sp = ev?.serviciosPax || null;
                    const inRange = res.diasPresentes.has(dateStr);

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
                            title={Object.entries(sp).map(([k, v]) => `${k}: ${v} pax`).join("\n")}
                            style={{
                              background: meta.bg, color: meta.text,
                              borderRadius: 4, padding: "2px",
                              fontSize: "0.65rem", fontWeight: 700,
                              lineHeight: 1.2,
                              border: tipo === "sin" ? "1px solid #fde047" : "none",
                              overflow: "hidden", textOverflow: "ellipsis",
                            }}
                          >
                            {Object.entries(sp).map(([servicio, pax]) => (
                              <div key={servicio}>
                                <span style={{fontWeight: 800}}>{servicio.substring(0,3)}</span><br/><span style={{opacity:0.9}}>{pax}</span>
                              </div>
                            ))}
                          </div>
                        ) : inRange ? (
                          <div
                            style={{
                              width: "100%", height: "100%", minHeight: 36,
                              background: meta.inTownBg,
                              opacity: 0.6
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

          <tr>
            <td
              style={{
                position: "sticky", left: 0, zIndex: 5,
                background: "#f8fafc",
                borderTop: "2px solid #334155",
                padding: "4px 8px",
                fontSize: "0.75rem", fontWeight: 700, color: "#1e293b",
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
                    padding: 2, textAlign: "center", verticalAlign: "middle",
                    fontSize: "0.6rem", fontWeight: 700, color: "#0f172a",
                  }}
                >
                  {tot && (
                    <div style={{ lineHeight: 1.2 }}>
                      {Object.entries(tot).map(([k, v]) => (
                        <div key={k} title={`${k}: ${v}`}>
                          <span style={{ opacity: 0.65 }}>{k.substring(0, 3)}</span> {v}
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
