/**
 * Utilidades para normalizar, identificar y filtrar eventos / servicios del calendario.
 */

/**
 * Extrae el nombre canónico y limpio del evento a partir de un objeto Event de FullCalendar o un evento del backend.
 * Elimina cualquier indicativo accesorio (horarios personalizados como "⏰ 9am", notas "(...)",
 * avisos de campamento "\n🏕️ Camp.", opcionales vendidas, turnos, emojis, etc.).
 *
 * @param {Object|string} evt - Objeto de evento o título de evento
 * @returns {string} Nombre limpio del evento (ej: "ZACARIAS", "ECLIPSE", "Bienvenida", etc.)
 */
export function getEventoNombre(evt) {
  if (!evt) return "";

  // 1. Si evt es string directo
  if (typeof evt === "string") {
    return cleanRawTitle(evt);
  }

  // 2. Si tiene nombre_evento en extendedProps (garantizado desde backend)
  const props = evt.extendedProps;
  if (props?.nombre_evento && typeof props.nombre_evento === "string" && props.nombre_evento.trim()) {
    return props.nombre_evento.trim();
  }

  // 3. Fallback: limpiar title
  return cleanRawTitle(evt.title || "");
}

/**
 * Limpia una cadena de título que pueda contener emojis, horarios, notas entre paréntesis,
 * saltos de línea con "Camp." o "Opcional vendida".
 */
function cleanRawTitle(rawTitle) {
  if (!rawTitle || typeof rawTitle !== "string") return "";

  // Tomar solo la primera línea (elimina "\n🏕️ Camp.", "\nOpcional vendida", etc.)
  let line = rawTitle.split("\n")[0] || "";

  // Eliminar emojis y caracteres gráficos
  line = line.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "");

  // Eliminar horas con ícono de reloj o texto (ej: "⏰ 9am", "⏰ 09:00", "9am", "20:00 hs")
  line = line.replace(/⏰[^\s(]*/gi, "");
  line = line.replace(/\b\d{1,2}(:\d{2})?\s*(am|pm|hs|h)\b/gi, "");

  // Eliminar indicaciones de turnos ("2 TURNOS", "TURNOS")
  line = line.replace(/\b\d+\s+TURNOS\b/gi, "");

  // Eliminar contenido entre paréntesis como "(almuerzo)", "(20:00)", "(150 PAX)"
  line = line.replace(/\(.*?\)/g, "");

  // Eliminar palabras residuales de campamento si estuviesen en la misma línea
  line = line.replace(/\b(camp\.|campamento)\b/gi, "");

  // Quitar caracteres no alfanuméricos en los extremos (guiones, dos puntos, espacios)
  line = line.replace(/^[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+|[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+$/g, "");

  return line.trim();
}

/**
 * Determina si un evento coincide con el filtro de evento/servicio seleccionado.
 * Soporta eventos con o sin campamento, con cualquier horario o nota.
 *
 * @param {Object} evt - Objeto de evento de FullCalendar
 * @param {string} filtro - Nombre del servicio filtrado o "todos"
 * @returns {boolean}
 */
export function isEventoMatch(evt, filtro) {
  if (!filtro || filtro === "todos") return true;
  if (!evt) return false;

  const props = evt.extendedProps || {};
  const tipo = props.tipo;

  // Solo se consideran asignaciones a grupos
  const esAsignacion =
    tipo === "asignacion" ||
    tipo === "asignacion_readonly" ||
    tipo === "asignacion_hielo_resumen";

  if (!esAsignacion) return false;

  const filtroNorm = filtro.trim().toLowerCase();

  // 1. Comparar con nombre_evento
  if (props.nombre_evento && props.nombre_evento.trim().toLowerCase() === filtroNorm) {
    return true;
  }

  // 2. Comparar con evento_tipo (ej: "ZACARIAS", "DISCO", "POOL")
  if (props.evento_tipo && props.evento_tipo.trim().toLowerCase() === filtroNorm) {
    return true;
  }

  // 3. Comparar con el nombre limpio extraído del título
  const nombreLimpio = getEventoNombre(evt);
  if (nombreLimpio && nombreLimpio.toLowerCase() === filtroNorm) {
    return true;
  }

  return false;
}

/**
 * Obtiene la lista única de servicios / eventos disponibles para poblar el dropdown de filtros.
 * Evita duplicados como "zacarias", "zacarias + campamento", "zacarias 9am".
 *
 * @param {Array} events - Lista de eventos cargados
 * @returns {Array<string>} Lista ordenada de nombres canónicos únicos
 */
export function getServiciosDisponibles(events) {
  if (!Array.isArray(events)) return [];

  const map = new Map(); // lowercase -> display name

  events.forEach((evt) => {
    const props = evt.extendedProps || {};
    const tipo = props.tipo;

    // Tomar asignaciones de grupos y eventos de fila de servicios globales
    const relevante =
      tipo === "asignacion" ||
      tipo === "asignacion_readonly" ||
      tipo === "asignacion_hielo_resumen" ||
      tipo === "servicio_global" ||
      String(evt.resourceId || "").startsWith("servicio-");

    if (relevante) {
      const nombre = getEventoNombre(evt);
      if (nombre && !map.has(nombre.toLowerCase())) {
        map.set(nombre.toLowerCase(), nombre);
      }
    }
  });

  return Array.from(map.values()).sort((a, b) =>
    a.localeCompare(b, "es", { sensitivity: "base" })
  );
}
