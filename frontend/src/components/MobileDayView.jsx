import { useMemo, useState, useCallback } from "react";

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const SHORT_MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

function formatHuman(date) {
  return `${DAY_NAMES[date.getDay()]} ${date.getDate()} ${SHORT_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function iso(date) {
  return date.toISOString().slice(0, 10);
}

export default function MobileDayView({ resources, events, loading }) {
  const [currentDate, setCurrentDate] = useState(() => today());
  const currentISO = iso(currentDate);
  const currentMonthKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;

  const resourceInfo = useMemo(() => {
    const map = new Map();
    resources.forEach((res) => {
      map.set(res.id, {
        group: res.extendedProps?.grupoNombre || res.title,
        company: res.extendedProps?.empresaNombre,
      });
    });
    return map;
  }, [resources]);

  const matchesCurrentDate = useCallback(
    (value) => {
      if (!value) return false;
      const raw = value instanceof Date ? value.toISOString() : String(value);
      return raw.slice(0, 10) === currentISO;
    },
    [currentISO]
  );

  const globalEvents = useMemo(() => {
    return events
      .filter((evt) => String(evt.resourceId) === "eventos" && matchesCurrentDate(evt.start))
      .filter((evt) => evt.extendedProps?.tipo !== "resumen_servicios")
      .map((evt) => {
        const props = evt.extendedProps || {};
        return {
          id: evt.id || evt.start,
          title: props.evento_nombre || evt.title || "Servicio",
          tematica: props.tematica_nombre,
          ocupacion: props.ocupacion,
          capacidad: props.capacidad,
          tipo: props.evento_tipo,
          color: evt.backgroundColor || "#0f172a",
          conAlcohol: props.con_alcohol,
        };
      });
  }, [events, matchesCurrentDate]);

  const groupEntries = useMemo(() => {
    const seen = new Set();
    const entries = events
      .filter((evt) => evt.resourceId && evt.resourceId !== "eventos")
      .filter((evt) => matchesCurrentDate(evt.start))
      .filter((evt) => {
        const tipo = evt.extendedProps?.tipo;
        return (
          tipo === "asignacion"
          || tipo === "grupo"
          || tipo === "asignacion_readonly"
          || tipo === "grupo_readonly"
        );
      })
      .map((evt) => {
        const info = resourceInfo.get(evt.resourceId) || {};
        const rawKey = evt.extendedProps?.asignacion_id ?? evt.id ?? `${evt.resourceId}-${evt.start}-${evt.extendedProps?.tipo}`;
        const uniqueKey = String(rawKey);
        return {
          id: uniqueKey,
          company: info.company || "Empresa",
          group: info.group || "Grupo",
          label: evt.title,
          tipo: evt.extendedProps?.tipo,
          color: evt.backgroundColor,
        };
      })
      .filter((entry) => {
        if (seen.has(entry.id)) return false;
        seen.add(entry.id);
        return true;
      });

    return entries.sort((a, b) => {
      if (a.company === b.company) {
        return a.group.localeCompare(b.group);
      }
      return a.company.localeCompare(b.company);
    });
  }, [events, matchesCurrentDate, resourceInfo]);

  const monthOptions = useMemo(() => {
    const validDates = events
      .map((evt) => (evt?.start instanceof Date ? evt.start : new Date(evt?.start)))
      .filter((d) => d instanceof Date && !Number.isNaN(d.getTime()));

    if (validDates.length === 0) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      return [{
        key: `${year}-${month}`,
        year,
        month,
        label: `${SHORT_MONTHS[month]} ${year}`,
      }];
    }

    let min = new Date(validDates[0].getFullYear(), validDates[0].getMonth(), 1);
    let max = new Date(validDates[0].getFullYear(), validDates[0].getMonth(), 1);

    validDates.forEach((d) => {
      const normalized = new Date(d.getFullYear(), d.getMonth(), 1);
      if (normalized < min) min = normalized;
      if (normalized > max) max = normalized;
    });

    const options = [];
    const cursor = new Date(min.getFullYear(), min.getMonth(), 1);
    const end = new Date(max.getFullYear(), max.getMonth(), 1);

    while (cursor <= end) {
      const year = cursor.getFullYear();
      const month = cursor.getMonth();
      options.push({
        key: `${year}-${month}`,
        year,
        month,
        label: `${SHORT_MONTHS[month]} ${year}`,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const hasCurrent = options.some((opt) => opt.key === currentMonthKey);
    if (!hasCurrent) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      options.push({
        key: `${year}-${month}`,
        year,
        month,
        label: `${SHORT_MONTHS[month]} ${year}`,
      });
      options.sort((a, b) => (a.year - b.year) || (a.month - b.month));
    }

    return options;
  }, [events, currentDate, currentMonthKey]);

  const changeDay = (delta) => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + delta);
      return next;
    });
  };

  const goToday = () => setCurrentDate(today());

  const handleMonthChange = (e) => {
    const [yearStr, monthStr] = e.target.value.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (Number.isNaN(year) || Number.isNaN(month)) return;
    const day = currentDate.getDate();
    const maxDay = new Date(year, month + 1, 0).getDate();
    const nextDay = Math.min(day, maxDay);
    setCurrentDate(new Date(year, month, nextDay));
  };

  return (
    <div
      style={{
        padding: "16px 16px 32px",
        minHeight: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <header style={heroCardStyle}>
        <div style={{ opacity: 0.85, fontSize: "0.95rem" }}>Calendario Diario</div>
        <h2 style={{ margin: "4px 0 0 0", fontSize: "1.6rem" }}>{formatHuman(currentDate)}</h2>
        <div style={{ marginTop: 12 }}>
          <select
            value={currentMonthKey}
            onChange={handleMonthChange}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "none",
              fontWeight: 600,
              color: "#0f172a",
            }}
          >
            {monthOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button style={heroBtnStyle} onClick={() => changeDay(-1)}>← Día anterior</button>
          <button style={{ ...heroBtnStyle, background: "rgba(255,255,255,0.15)" }} onClick={goToday}>Hoy</button>
          <button style={heroBtnStyle} onClick={() => changeDay(1)}>Día siguiente →</button>
        </div>
      </header>

      {loading ? (
        <p style={{ textAlign: "center", color: "#475569" }}>Cargando eventos…</p>
      ) : (
        <>
          <section style={sectionCardStyle}>
            <h3 style={sectionTitleStyle}>Servicios del día</h3>
            {globalEvents.length === 0 ? (
              <p style={emptyMsgStyle}>No hay servicios creados para este día.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {globalEvents.map((evt) => (
                  <div
                    key={evt.id}
                    style={{
                      borderRadius: 14,
                      padding: "12px 14px",
                      color: evt.color === "yellow" ? "#0f172a" : "white",
                      background: evt.color || "#0f172a",
                      boxShadow: "0 8px 20px rgba(15,23,42,0.18)",
                    }}
                  >
                    <div style={{ fontSize: "1rem", fontWeight: 700 }}>{evt.title}</div>
                    {evt.tematica && <div style={{ marginTop: 2, fontSize: "0.85rem", opacity: 0.95 }}>{evt.tematica}</div>}
                    <div style={{ marginTop: 6, fontSize: "0.85rem", opacity: 0.9 }}>
                      {evt.ocupacion != null && evt.capacidad != null && (
                        <span>Capacidad {evt.ocupacion}/{evt.capacidad}</span>
                      )}
                      {evt.conAlcohol && <span style={{ marginLeft: 12 }}>🥂 Con alcohol</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section style={sectionCardStyle}>
            <h3 style={sectionTitleStyle}>Grupos</h3>
            {groupEntries.length === 0 ? (
              <p style={emptyMsgStyle}>No hay grupos alojados en esta fecha.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {groupEntries.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      borderRadius: 12,
                      padding: "12px 14px",
                      background: "white",
                      borderLeft: `5px solid ${entry.tipo === "asignacion" ? entry.color || "#0ea5e9" : "#e2e8f0"}`,
                      boxShadow: "0 6px 16px rgba(15,23,42,0.08)",
                    }}
                  >
                    <div style={{ color: "#475569", fontSize: "0.85rem", marginBottom: 2 }}>{entry.company}</div>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "#0f172a", lineHeight: 1.25 }}>{entry.group}</div>
                    <div style={{ marginTop: 4, fontSize: "0.85rem", color: entry.tipo === "asignacion" ? "#0f172a" : "#94a3b8" }}>
                      {entry.tipo === "asignacion" ? `Evento: ${entry.label}` : "Sin actividad programada"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

const heroCardStyle = {
  background: "linear-gradient(135deg, #0ea5e9, #4338ca)",
  borderRadius: 22,
  padding: 16,
  color: "white",
  boxShadow: "0 20px 45px rgba(15,23,42,0.35)",
};

const heroBtnStyle = {
  flex: 1,
  border: "none",
  borderRadius: 999,
  padding: "8px 12px",
  background: "rgba(255,255,255,0.25)",
  color: "white",
  fontSize: "0.85rem",
  fontWeight: 600,
  cursor: "pointer",
};

const sectionCardStyle = {
  background: "#f8fafc",
  borderRadius: 20,
  padding: 14,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)",
};

const sectionTitleStyle = {
  margin: "0 0 12px 0",
  color: "#0f172a",
};

const emptyMsgStyle = {
  margin: 0,
  padding: 18,
  borderRadius: 16,
  background: "white",
  color: "#94a3b8",
  textAlign: "center",
};
