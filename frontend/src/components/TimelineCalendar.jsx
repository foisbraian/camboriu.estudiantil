import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import FullCalendar from "@fullcalendar/react";
import resourceTimelinePlugin from "@fullcalendar/resource-timeline";
import interactionPlugin from "@fullcalendar/interaction";
import api from "../api";
import "./timeline.css";
import AnotacionGrupoPanel from "./AnotacionGrupoPanel";
import { isEventoMatch } from "../utils/eventUtils";

export default function TimelineCalendar({
  resources,
  events,
  readOnly = false,
  onRegisterRef,
  onRecargar,
  targetDate = null,
  filtroServicio = "todos",
  historialCargado = false,
}) {
  const calendarRef = useRef(null);
  const [initialDate] = useState(() => targetDate || new Date());

  // Rango visible del timeline:
  // - Por defecto (historialCargado = false): inicia visualmente en el 1° del mes actual
  // - Con historial (historialCargado = true): expande hacia el pasado (enero del año actual)
  const visibleRange = useMemo(() => {
    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const mesActual = String(hoy.getMonth() + 1).padStart(2, "0");

    if (historialCargado) {
      return {
        start: `${anioActual}-01-01`,
        end: `${anioActual + 1}-06-01`,
      };
    }

    return {
      start: `${anioActual}-${mesActual}-01`,
      end: `${anioActual + 1}-06-01`,
    };
  }, [historialCargado]);

  // Preservación y restauración de scroll al agregar/editar eventos o grupos
  const savedScrollPos = useRef({ left: null, top: null });
  const lastInteractedDate = useRef(null);
  const isRestoringScroll = useRef(false);

  const captureCurrentScroll = useCallback((explicitDate = null) => {
    const rootEl = calendarRef.current?.el;
    if (!rootEl) return;
    const scroller = rootEl.querySelector(".fc-timeline-body .fc-scroller");
    if (scroller && (scroller.scrollLeft > 0 || scroller.scrollTop > 0)) {
      savedScrollPos.current = {
        left: scroller.scrollLeft,
        top: scroller.scrollTop,
      };
    }
    if (explicitDate) {
      lastInteractedDate.current = explicitDate;
    }
  }, []);

  const centerDate = useCallback((dateToCenter) => {
    const rootEl = calendarRef.current?.el;
    if (!rootEl) return false;
    const d = dateToCenter || targetDate || initialDate || new Date();
    const dateISO = d instanceof Date
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      : String(d).slice(0, 10);
    const slot =
      rootEl.querySelector(`.fc-timeline-slot[data-date="${dateISO}"]`)
      || rootEl.querySelector(`.fc-col-header-cell[data-date="${dateISO}"]`);
    const scroller =
      rootEl.querySelector(".fc-timeline-body .fc-scroller")
      || rootEl.querySelector(".fc-scroller-harness .fc-scroller");
    if (slot && scroller) {
      const offset = Math.max(0, slot.offsetLeft - scroller.clientWidth / 2 + slot.clientWidth / 2);
      scroller.scrollLeft = offset;
      const headerScroller = rootEl.querySelector(".fc-timeline-header .fc-scroller");
      if (headerScroller) headerScroller.scrollLeft = offset;
      savedScrollPos.current = { left: offset, top: scroller.scrollTop };
      return true;
    }
    if (slot?.scrollIntoView) {
      slot.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
      return true;
    }
    return false;
  }, [initialDate, targetDate]);

  // Exponer método navegarAMes y irAFecha al padre via callback prop
  useEffect(() => {
    if (onRegisterRef) {
      onRegisterRef({
        navegarAMes(fecha) {
          const api = calendarRef.current?.getApi();
          if (!api) return;
          api.changeView("resourceTimelineMonth", fecha);
          const fechaISO = fecha instanceof Date ? fecha.toISOString().slice(0, 10) : String(fecha).slice(0, 10);
          captureCurrentScroll(fechaISO);
        },
        irAFecha(fecha) {
          const api = calendarRef.current?.getApi();
          if (!api) return;
          api.gotoDate(fecha);
          const fechaISO = fecha instanceof Date ? fecha.toISOString().slice(0, 10) : String(fecha).slice(0, 10);
          captureCurrentScroll(fechaISO);
          setTimeout(() => centerDate(fecha), 80);
          setTimeout(() => centerDate(fecha), 250);
        }
      });
    }
  }, [onRegisterRef, centerDate, captureCurrentScroll]);

  // =========================================================
  // STATE
  // =========================================================
  const [slotWidth, setSlotWidth] = useState(110);
  const [localEvents, setLocalEvents] = useState(events);
  const hasCenteredInitial = useRef(false);

  // Escuchar scroll del timeline para recordar la posición en todo momento
  useEffect(() => {
    const rootEl = calendarRef.current?.el;
    if (!rootEl) return;

    const handleScrollCapture = (e) => {
      if (isRestoringScroll.current) return;
      const target = e.target;
      if (!target || !target.classList) return;
      if (target.classList.contains("fc-scroller")) {
        const isTimelineBody = target.closest(".fc-timeline-body") !== null;
        if (isTimelineBody && target.scrollWidth > target.clientWidth) {
          savedScrollPos.current = {
            left: target.scrollLeft,
            top: target.scrollTop,
          };
        }
      }
    };

    rootEl.addEventListener("scroll", handleScrollCapture, { capture: true, passive: true });
    return () => {
      rootEl.removeEventListener("scroll", handleScrollCapture, { capture: true });
    };
  }, []);

  // Centrado inicial en la fecha de hoy o targetDate
  useEffect(() => {
    if (hasCenteredInitial.current) return;
    const api = calendarRef.current?.getApi();
    if (!api) return;
    const dateToCenter = targetDate || initialDate;
    api.gotoDate(dateToCenter);

    let attempts = 0;
    const maxAttempts = 6;

    const tryCenter = () => {
      if (centerDate(dateToCenter)) {
        hasCenteredInitial.current = true;
        const rootEl = calendarRef.current?.el;
        const scroller = rootEl?.querySelector(".fc-timeline-body .fc-scroller");
        if (scroller && scroller.scrollLeft > 0) {
          savedScrollPos.current = { left: scroller.scrollLeft, top: scroller.scrollTop };
        }
        return;
      }
      if (attempts >= maxAttempts) return;
      attempts += 1;
      setTimeout(tryCenter, 160);
    };

    const raf = requestAnimationFrame(tryCenter);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [centerDate, events, initialDate, targetDate]);

  // Restaurar posición de scroll tras recargar datos (agregar/actualizar grupo o evento)
  useEffect(() => {
    if (!hasCenteredInitial.current) return;

    const targetLeft = savedScrollPos.current.left;
    const targetTop = savedScrollPos.current.top;
    const anchorDate = lastInteractedDate.current;

    if (targetLeft === null && !anchorDate) return;

    isRestoringScroll.current = true;

    const restore = () => {
      const rootEl = calendarRef.current?.el;
      if (!rootEl) return false;

      const timelineScroller = rootEl.querySelector(".fc-timeline-body .fc-scroller");
      const headerScroller = rootEl.querySelector(".fc-timeline-header .fc-scroller");
      const datagridScroller = rootEl.querySelector(".fc-datagrid-body .fc-scroller");

      if (!timelineScroller) return false;

      if (timelineScroller.scrollWidth <= timelineScroller.clientWidth) {
        return false;
      }

      let ok = false;
      if (targetLeft !== null && targetLeft > 0) {
        timelineScroller.scrollLeft = targetLeft;
        if (headerScroller) headerScroller.scrollLeft = targetLeft;
        if (targetTop !== null) {
          timelineScroller.scrollTop = targetTop;
          if (datagridScroller) datagridScroller.scrollTop = targetTop;
        }
        ok = true;
      } else if (anchorDate) {
        ok = centerDate(anchorDate);
      }

      return ok;
    };

    const delays = [30, 80, 180, 350, 650, 1100];
    const timers = delays.map((d) => setTimeout(restore, d));

    const unlockTimer = setTimeout(() => {
      isRestoringScroll.current = false;
    }, 1300);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(unlockTimer);
    };
  }, [events, resources, centerDate]);

  // Si cambia targetDate dinámicamente
  useEffect(() => {
    if (!targetDate) return;
    const api = calendarRef.current?.getApi();
    if (api) {
      api.gotoDate(targetDate);
      setTimeout(() => centerDate(targetDate), 100);
      setTimeout(() => centerDate(targetDate), 300);
    }
  }, [targetDate, centerDate]);

  // Si cambia filtroServicio, re-renderizar estilos de eventos en FullCalendar
  useEffect(() => {
    calendarRef.current?.getApi()?.render();
  }, [filtroServicio]);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);

  const [eventosDisponibles, setEventosDisponibles] = useState([]);
  const [eventoSeleccionado, setEventoSeleccionado] = useState("");
  const [tipoAlcohol, setTipoAlcohol] = useState("sin"); // "sin" | "con" | "mix"

  const [tematicas, setTematicas] = useState([]);
  const [tematicaSeleccionada, setTematicaSeleccionada] = useState("");
  const [esPrivado, setEsPrivado] = useState(false);
  const [empresaPrivadaId, setEmpresaPrivadaId] = useState("");
  const [empresas, setEmpresas] = useState([]);
  const [empresaObjetivo, setEmpresaObjetivo] = useState(null);
  const [horario, setHorario] = useState("");
  const [show, setShow] = useState("");
  const [animador, setAnimador] = useState("");
  const [cantidadCajas, setCantidadCajas] = useState("");
  const [cantidadSeguridad, setCantidadSeguridad] = useState("");
  const [cantidadLimpieza, setCantidadLimpieza] = useState("");
  const [esOpcionalAsignar, setEsOpcionalAsignar] = useState(false);

  const [editando, setEditando] = useState(null);
  const [grupoAsignando, setGrupoAsignando] = useState(null);
  const [anotacionGrupo, setAnotacionGrupo] = useState(null);

  // ==========================================================
  // CLICK DERECHO EN GRUPO (COLUMNA O TIRA) -> ANOTACIONES
  // Handler global con capture:true para interceptar ANTES del browser
  // ==========================================================
  useEffect(() => {
    const handleContextMenu = (e) => {
      const calendarEl = calendarRef.current?.el;
      if (!calendarEl || !calendarEl.contains(e.target)) return;

      // Buscar si el click fue dentro de una fila de recurso (datagrid o timeline)
      const row = e.target.closest('tr[data-resource-id]');
      let resourceId = row ? row.getAttribute('data-resource-id') : null;

      if (!resourceId) {
        const eventEl = e.target.closest('.fc-timeline-event');
        if (eventEl) {
          const lane = eventEl.closest('tr[data-resource-id]');
          if (lane) resourceId = lane.getAttribute('data-resource-id');
        }
      }

      if (!resourceId) return;

      const res = resources.find(r => String(r.id) === String(resourceId));
      if (!res) return;

      const parentId = res.parentId;
      if (!parentId || !String(parentId).startsWith('empresa-')) return;

      e.preventDefault();
      e.stopPropagation();

      const props = res.extendedProps || {};
      captureCurrentScroll(props.fechaEntrada || props.fechaSalida || null);
      setAnotacionGrupo({
        grupoId: res.id,
        grupoNombre: props.grupoNombre || res.title,
        empresaNombre: props.empresaNombre || '',
        fechaEntrada: props.fechaEntrada || '',
        fechaSalida: props.fechaSalida || '',
      });
    };

    document.addEventListener('contextmenu', handleContextMenu, true);
    return () => document.removeEventListener('contextmenu', handleContextMenu, true);
  }, [resources, captureCurrentScroll]);

  // Horarios individuales por empresa (para eventos globales)
  const [horariosEmpresa, setHorariosEmpresa] = useState([]); // lista de { empresa_id, empresa_nombre, horario, nota, id? }
  const [cargandoHorarios, setCargandoHorarios] = useState(false);
  const [fechaEventoIdActual, setFechaEventoIdActual] = useState(null);

  // =========================================================
  // SYNC BACKEND
  // =========================================================
  useEffect(() => {
    setLocalEvents(events);
  }, [events]);

  useEffect(() => {
    cargarTematicas();
  }, []);

  useEffect(() => {
    const cargarEmpresas = async () => {
      try {
        const res = await api.get("/empresas/");
        setEmpresas(res.data);
      } catch (e) {
        console.error("Error cargando empresas", e);
      }
    };
    cargarEmpresas();
  }, []);

  const cargarTematicas = async () => {
    try {
      const res = await api.get("/tematicas/");
      setTematicas(res.data);
    } catch (e) {
      console.error("Error cargando temáticas:", e);
    }
  };

  // Carga los horarios personalizados por empresa para un fecha_evento dado
  const cargarHorariosEmpresa = async (fechaEventoId) => {
    if (!fechaEventoId) return;
    setCargandoHorarios(true);
    try {
      const res = await api.get(`/calendario/fecha/${fechaEventoId}/horarios-empresa`);
      setHorariosEmpresa(res.data || []);
    } catch (e) {
      console.error("Error cargando horarios empresa:", e);
      setHorariosEmpresa([]);
    } finally {
      setCargandoHorarios(false);
    }
  };

  const guardarHorarioEmpresa = async (fechaEventoId, empresaId, horarioVal, notaVal) => {
    if (!horarioVal.trim()) return;
    try {
      await api.post(`/calendario/fecha/${fechaEventoId}/horarios-empresa`, {
        empresa_id: empresaId,
        horario: horarioVal.trim(),
        nota: notaVal?.trim() || null,
      });
      await cargarHorariosEmpresa(fechaEventoId);
    } catch (e) {
      alert("Error al guardar horario");
    }
  };

  const eliminarHorarioEmpresa = async (horarioId, fechaEventoId) => {
    if (!window.confirm("¿Eliminar este horario?")) return;
    try {
      await api.delete(`/calendario/horario-empresa/${horarioId}`);
      await cargarHorariosEmpresa(fechaEventoId);
    } catch (e) {
      alert("Error al eliminar horario");
    }
  };


  // =========================================================
  // ZOOM CTRL + SCROLL
  // =========================================================
  useEffect(() => {
    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();

        setSlotWidth((prev) =>
          Math.max(40, Math.min(250, prev + (e.deltaY > 0 ? -10 : 10)))
        );
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  // =========================================================
  // STICKY SERVICIOS ROW (JS-based, bypasses dual-scroller limitation)
  // =========================================================
  const applyStickyEventosRow = useCallback(() => {
    const rootEl = calendarRef.current?.el;
    if (!rootEl) return;

    // Both sides: datagrid (left labels) and timeline (right events)
    const selectors = [
      '.fc-datagrid-body tr[data-resource-id="servicios-parent"]',
      '.fc-timeline-body tr[data-resource-id="servicios-parent"]',
    ];

    selectors.forEach((sel) => {
      const row = rootEl.querySelector(sel);
      if (!row) return;
      Array.from(row.cells || row.querySelectorAll('td, th')).forEach((cell) => {
        cell.style.position = 'sticky';
        cell.style.top = '0';
        cell.style.zIndex = '5';
        cell.style.boxShadow = '0 2px 6px rgba(0,0,0,0.12)';
        // Keep background so content below doesn't bleed through
        if (!cell.style.backgroundColor || cell.style.backgroundColor === '') {
          cell.style.backgroundColor = '#ffffff';
        }
      });
    });
  }, []);

  // Run after initial render + whenever events/resources change
  useEffect(() => {
    // FullCalendar renders asynchronously; try a few times
    const attempts = [100, 300, 700, 1500];
    const timers = attempts.map((delay) =>
      setTimeout(applyStickyEventosRow, delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [events, resources, applyStickyEventosRow]);

  // =========================================================
  // EVENTOS DEL DIA Y SERVICIOS DISPONIBLES
  // =========================================================
  const cargarEventosDelDia = async (fechaISO) => {
    try {
      // Para el modal de asignación, sólo necesitamos los servicios abiertos en esa fecha específica
      const [calRes, eventosBaseRes] = await Promise.all([
        api.get(`/calendario/?fecha_desde=${fechaISO}&fecha_hasta=${fechaISO}`),
        api.get("/eventos/")
      ]);

      // Filtrar los que son de servicios y coinciden con la fecha
      const existentes = (calRes.data.events || []).filter(
        (e) => String(e.resourceId).startsWith("servicio-") && e.start.startsWith(fechaISO)
      );

      const filtrados = existentes.map(ext => {
        const cleanFid = getCleanId(ext.id);
        const evId = ext.extendedProps?.evento_id;
        const evTipo = ext.extendedProps?.evento_tipo;
        const evNombre = ext.extendedProps?.evento_nombre || ext.title;
        const horarioVal = ext.extendedProps?.horario;
        const capMax = ext.extendedProps?.capacidad;
        const esPriv = ext.extendedProps?.es_privado;
        const empPrivId = ext.extendedProps?.empresa_privada_id;
        const empPrivNom = ext.extendedProps?.empresa_privada_nombre;

        return {
          id: evId,
          fecha_evento_id: cleanFid,
          tipo: evTipo,
          nombre: evNombre,
          horario: horarioVal,
          capacidad_maxima: capMax,
          es_privado: esPriv,
          empresa_privada_id: empPrivId,
          empresa_privada_nombre: empPrivNom,
          esta_abierto: true
        };
      });

      // Agregar también los eventos base que aún no están instanciados en esa fecha
      const idsAbiertos = new Set(filtrados.map(f => Number(f.id)));
      const baseDisponibles = (eventosBaseRes.data || [])
        .filter(base => !idsAbiertos.has(Number(base.id)))
        .map(base => ({
          id: base.id,
          fecha_evento_id: null,
          tipo: base.tipo,
          nombre: base.nombre,
          horario: null,
          capacidad_maxima: base.capacidad_maxima,
          es_privado: false,
          empresa_privada_id: null,
          empresa_privada_nombre: null,
          esta_abierto: false
        }));

      setEventosDisponibles([...filtrados, ...baseDisponibles]);
    } catch (e) {
      console.error("Error al cargar eventos del día", e);
    }
  };

  // Helper para sacar ID limpio
  const getCleanId = (idStr) => {
    if (typeof idStr === "string" && idStr.startsWith("id-")) {
      return Number(idStr.replace("id-", ""));
    }
    return Number(idStr);
  };

  const getEmpresaIdFromResource = useCallback((resourceId) => {
    const resourceIdStr = String(resourceId);
    const resource = resources.find((res) => String(res.id) === resourceIdStr);
    if (!resource) return null;
    if (resource.extendedProps?.empresaId) {
      return resource.extendedProps.empresaId;
    }
    const parentId = resource.parentId;
    if (typeof parentId === "string" && parentId.startsWith("empresa-")) {
      const [, empresaId] = parentId.split("-");
      return Number(empresaId);
    }
    return null;
  }, [resources]);

  useEffect(() => {
    if (grupoAsignando) {
      setEmpresaObjetivo(getEmpresaIdFromResource(grupoAsignando));
    } else {
      setEmpresaObjetivo(null);
    }
  }, [grupoAsignando, getEmpresaIdFromResource]);

  // =========================================================
  // HEADER CLICK → NUEVO EVENTO GLOBAL
  // =========================================================
  const abrirNuevoGlobal = async (dateObj, tipoSugerido = "") => {
    const fechaISO = dateObj.toISOString().slice(0, 10);

    setSelectedDate(fechaISO);
    setGrupoAsignando(null); // No es grupo
    setEditando(null);       // No es edición de existente
    setTipoAlcohol("sin");
    setTematicaSeleccionada("");
    setEsPrivado(false);
    setEmpresaPrivadaId("");
    setHorario("");
    setShow("");
    setAnimador("");
    setCantidadCajas("");
    setCantidadSeguridad("");
    setCantidadLimpieza("");
    setEsOpcionalAsignar(false);

    // Para crear global, mostramos TODOS los eventos posibles para elegir
    const res = await api.get("/eventos/");
    const evList = res.data || [];
    setEventosDisponibles(evList);

    if (tipoSugerido) {
      const match = evList.find(e => String(e.tipo).toUpperCase() === String(tipoSugerido).toUpperCase());
      setEventoSeleccionado(match ? match.id : "");
    } else {
      setEventoSeleccionado("");
    }

    setModalOpen(true);
  };

  // =========================================================
  // CLICK EN EVENTOS
  // =========================================================
  const handleEventClick = async (info) => {
    if (readOnly) return;

    const props = info.event.extendedProps || {};
    if (props.tipo === "resumen_servicios") return;
    if (props.tipo === "asignacion_hielo_resumen") return;
    const fechaISO = info.event.startStr.slice(0, 10);
    captureCurrentScroll(fechaISO);

    // ---------------------------------------------------------
    // B. CLICK EN ASIGNACION (Evento en fila de grupo) → ELIMINAR
    // ---------------------------------------------------------
    if (props.tipo === "asignacion") {
      // Queremos ver/eliminar esta asignación
      setSelectedDate(props.fecha);
      setGrupoAsignando(props.grupo_id);
      setEditando(null);
      setEsPrivado(false);
      setEmpresaPrivadaId("");

      setEditando({
        id: props.asignacion_id,
        tipo: "asignacion",
        evento_id_num: props.evento_id_num, // Capturamos el ID real para borrar
        nombre: props.nombre_evento,
        es_opcional: Boolean(props.es_opcional)
      });

      setEventoSeleccionado("");
      setEventosDisponibles([]);

      setModalOpen(true);
      return;
    }

    // ---------------------------------------------------------
    // C. CLICK EN EVENTO GLOBAL (Fila sup) → EDITAR
    // ---------------------------------------------------------
    // ---------------------------------------------------------
    // C. CLICK EN EVENTO GLOBAL (Fila sup) → EDITAR
    // ---------------------------------------------------------
    if (String(info.event.getResources()[0]?.id).startsWith("servicio-")) {
      const res = await api.get("/eventos/");
      setEventosDisponibles(res.data);

      setSelectedDate(fechaISO);
      setEventoSeleccionado(props.evento_id);
      const esMix = props.es_mix_evento;
      const esConAlcohol = props.con_alcohol;
      setTipoAlcohol(esMix ? "mix" : (esConAlcohol ? "con" : "sin"));
      setTematicaSeleccionada(props.tematica_id || "");
      setEsPrivado(Boolean(props.es_privado));
      setEmpresaPrivadaId(props.empresa_privada_id ? String(props.empresa_privada_id) : "");
      setHorario(props.horario || "");
      setShow(props.show || "");
      setAnimador(props.animador || "");
      setCantidadCajas(props.cantidad_cajas != null ? String(props.cantidad_cajas) : "");
      setCantidadSeguridad(props.cantidad_seguridad != null ? String(props.cantidad_seguridad) : "");
      setCantidadLimpieza(props.cantidad_limpieza != null ? String(props.cantidad_limpieza) : "");

      // CRITICAL FIX: Do NOT spread info.event directly. It's a complex object.
      // Extract what we need.
      const cleanFid = getCleanId(info.event.id);
      setFechaEventoIdActual(cleanFid);
      setEditando({
        id: info.event.id,
        title: info.event.title,
        ...props,
        tipo: "global"
      });
      setGrupoAsignando(null);

      // Cargar horarios personalizados por empresa para esta fecha de evento
      await cargarHorariosEmpresa(cleanFid);

      setModalOpen(true);
      return;
    }

    // ---------------------------------------------------------
    // D. CLICK EN FONDO DE GRUPO (Background Event) → ASIGNAR
    // ---------------------------------------------------------
    if (props.tipo === "grupo") {
      // Comportamiento idéntico a click en celda vacía (handleDateClick)
      const resourceId = info.event.getResources()[0]?.id;
      await cargarEventosDelDia(fechaISO);

      setSelectedDate(fechaISO);
      setGrupoAsignando(resourceId);
      setEditando(null);

      setModalOpen(true);
      return;
    }
  };

  // =========================================================
  // CLICK EN FECHA (GRID)
  // =========================================================
  const handleDateClick = async (info) => {
    if (readOnly) return;

    const resourceId = info.resource?.id;
    if (!resourceId) return;

    const resourceIdStr = String(resourceId);
    if (resourceIdStr.startsWith("empresa-")) {
      return;
    }

    const fechaISO = info.dateStr;
    captureCurrentScroll(fechaISO);

    // A. CLIC EN FILA DE EVENTOS GLOBAL (No debería pasar mucho si está lleno, pero por si acaso)
    if (
      resourceIdStr.startsWith("servicio-")
      || resourceIdStr === "servicios-parent"
      || resourceIdStr === "eventos"
    ) {
      const tipoSugerido = resourceIdStr.startsWith("servicio-") ? resourceIdStr.replace("servicio-", "") : "";
      abrirNuevoGlobal(info.date, tipoSugerido);
      return;
    }

    // B. CLIC EN FILA DE GRUPO -> ASIGNAR A GRUPO
    // Verificamos si realmente es un grupo (resourceId numérico o string)
    // El resourceId es el ID del grupo
    await cargarEventosDelDia(fechaISO);

    setSelectedDate(fechaISO);
    setGrupoAsignando(resourceId);
    setEditando(null); // Modo "crear asignación"
    setEsPrivado(false);
    setEmpresaPrivadaId("");
    setEsOpcionalAsignar(false);

    setModalOpen(true);
  };

  // =========================================================
  // GUARDAR
  // =========================================================
  const guardar = async () => {
    try {
      captureCurrentScroll(selectedDate);
      if (!eventoSeleccionado && !editando) return;
      if (!grupoAsignando && esPrivado && !empresaPrivadaId) {
        alert("Seleccioná la empresa para el evento privado");
        return;
      }

      // 1. Asignar a grupo (Nueva asignación)
      if (grupoAsignando && !editando) {
        if (!eventoSeleccionado) return;
        const seleccionadoObj = eventosDisponibles.find(ev => (ev.fecha_evento_id || ev.id) === Number(eventoSeleccionado));
        await api.post(`/calendario/grupo/${grupoAsignando}/asignar`, {
          evento_id: seleccionadoObj ? seleccionadoObj.id : Number(eventoSeleccionado),
          fecha: selectedDate,
          fecha_evento_id: seleccionadoObj ? seleccionadoObj.fecha_evento_id : null,
          es_opcional: Boolean(esOpcionalAsignar),
          horario: horario ? horario.trim() : null
        });
      }

      // 2. Editar global
      else if (editando && editando.tipo === "global") {
        await api.put(`/calendario/fecha/${getCleanId(editando.id)}`, {
          evento_id: Number(eventoSeleccionado),
          fecha_nueva: selectedDate,
          con_alcohol: tipoAlcohol === "con" || tipoAlcohol === "mix",
          es_mix_evento: tipoAlcohol === "mix",
          tematica_id: tematicaSeleccionada ? Number(tematicaSeleccionada) : null,
          es_privado: esPrivado,
          empresa_privada_id: esPrivado ? Number(empresaPrivadaId) : null,
          horario: horario || null,
          show: show.trim() || null,
          animador: animador.trim() || null,
          cantidad_cajas: cantidadCajas !== "" ? Number(cantidadCajas) : null,
          cantidad_seguridad: cantidadSeguridad !== "" ? Number(cantidadSeguridad) : null,
          cantidad_limpieza: cantidadLimpieza !== "" ? Number(cantidadLimpieza) : null,
        });
      }

      // 3. Crear global
      else if (!grupoAsignando && !editando) {
        await api.post("/eventos/fecha", {
          evento_id: Number(eventoSeleccionado),
          fecha: selectedDate,
          con_alcohol: tipoAlcohol === "con" || tipoAlcohol === "mix",
          es_mix_evento: tipoAlcohol === "mix",
          tematica_id: tematicaSeleccionada ? Number(tematicaSeleccionada) : null,
          es_privado: esPrivado,
          empresa_privada_id: esPrivado ? Number(empresaPrivadaId) : null,
          horario: horario || null,
          show: show.trim() || null,
          animador: animador.trim() || null,
          cantidad_cajas: cantidadCajas !== "" ? Number(cantidadCajas) : null,
          cantidad_seguridad: cantidadSeguridad !== "" ? Number(cantidadSeguridad) : null,
          cantidad_limpieza: cantidadLimpieza !== "" ? Number(cantidadLimpieza) : null,
        });
      }

      cerrar();

    } catch (error) {
      // Mostrar mensaje de error del backend (validación)
      if (error.response && error.response.data && error.response.data.detail) {
        const detail = error.response.data.detail;
        const msg = typeof detail === "string" ? detail : JSON.stringify(detail, null, 2);
        alert("Error: " + msg);
      } else {
        alert("Ocurrió un error desconocido");
      }
    }
  };

  // =========================================================
  // ELIMINAR (Global o Asignación)
  // =========================================================
  const eliminar = async () => {
    if (!editando) return;
    captureCurrentScroll(selectedDate);

    if (!window.confirm("¿Estás seguro de eliminar?")) return;

    try {
      // A. Eliminar Asignación
      if (editando.tipo === "asignacion") {
        // Para borrar asignación necesitamos grupo y fecha (y evento_id si usamos el endpoint nuevo correctamente)
        // El endpoint nuevo DELETE usa body { evento_id, fecha }.
        // Pero en "editando" (click en asignacion) no guardamos el evento_id exacto en el frontend props antes?
        // Revisemos calendario.py: extendedProps tiene "nombre_evento", "fecha", "grupo_id". ERROR: faltó "evento_id".
        // Como no tenemos el ID del evento numérico fácil, necesitamos que el backend lo mande en props.

        // Workaround rapido: Llamar a listar eventos, buscar por nombre... no, muy sucio.
        // Mejor: Asumimos que el backend recibirá una corrección para enviar "evento_id" en props.
        // O, cambiamos el endpoint para borrar por ID de asignación (mucho mejor, pero models.py lo tiene).
        // El endpoint actual pide Body. 
        // Vamos a asumir que en 'TimelineCalendar' necesitamos el ID del evento. 
        // Vamos a suponer que el replace anterior (del paso previo) inyectó evento_id? 
        // Revisando... NO. Solo nombre.
        debugger;
        // Necesito arreglar el backend para mandar evento_id en props si quiero usar este endpoint como está.
        // O, buscar el evento por nombre en la lista de disponibles... no tengo la lista aqui.

        // ALERT: Voy a hacer un fix 'in-place' pidiendo que el usuario refresque backend si hace falta,
        // pero mejor arreglo el backend DE NUEVO rapido o asumo que puedo borrar por otro metodo.
        // El endpoint Delete requiere 'evento_id'.
        // Voy a mandar el evento_id si lo tuviera. 
        // Como corrección, voy a mandar evento_id en el prop "extendedProps" desde el backend en el PROXIMO paso si falla?
        // No, debo hacerlo ahora.
        // Espera, handleEventClick lee props.
        // Voy a agregar evento_id al backend AHORA MISMO en una llamada paralela o posterior?
        // No puedo.

        // SOLUCION: El endpoint delete usa body fecha/evento_id.
        // PERO, si cambio el endpoint para borrar por ID Asignacion seria mas facil.
        // Como ya implementé el endpoint con body, tengo que enviar el evento_id.
        // Necesito que el backend mande evento_id en las props. 
        // -> Voy a incluir un cambio en el backend rapido ANTES de este commit de frontend? O en el mismo?
        // Ya hice el tool call del backend. Faltó "evento_id" en el diccionario.

        // PLAN B: En el frontend, cuando hago click en asignacion, 
        // tengo "info.event.extendedProps". 
        // Si el backend no manda el id, estoy frito.
        // VOY A EDITAR EL BACKEND OTRA VEZ PARA AGREGAR 'evento_id'.
        // Y luego terminar este archivo.

        // Por ahora escribo el codigo asumiendo que props.evento_id existirá.
        // Y lanzaré un patch al backend.

        await api.delete(`/calendario/grupo/${grupoAsignando}/asignar`, {
          data: {
            evento_id: editando.evento_id_num, // Necesitaremos esto
            fecha: selectedDate
          }
        });
      }
      // B. Eliminar Global (timeline)
      else if (editando.tipo === "global") {
        await api.delete(`/calendario/fecha/${getCleanId(editando.id)}`);
      }

      cerrar();
    } catch (e) {
      alert("Error al eliminar (o asignación bloqueada)");
    }
  };

  const cerrar = () => {
    captureCurrentScroll(selectedDate);
    setModalOpen(false);
    setEditando(null);
    setGrupoAsignando(null);
    setEsPrivado(false);
    setEmpresaPrivadaId("");
    setEsOpcionalAsignar(false);
    setShow("");
    setAnimador("");
    setCantidadCajas("");
    setCantidadSeguridad("");
    setCantidadLimpieza("");
    setHorariosEmpresa([]);
    setFechaEventoIdActual(null);
    onRecargar?.();
  };

  return (
    <>
      <div
        className="fc-print-wrapper timeline-zoom-wrapper"
        style={{
          width: "100%",
          height: "100%",
          "--zoom-ratio": Math.max(0.5, slotWidth / 110)
        }}
      >
        <FullCalendar
          ref={calendarRef}
          plugins={[resourceTimelinePlugin, interactionPlugin]}
          initialView="timelineGlobal"
          initialDate={initialDate}
          visibleRange={visibleRange}
          views={{
            timelineGlobal: {
              type: "resourceTimeline",
              visibleRange: visibleRange,
              slotLabelFormat: [
                { month: "long", year: "numeric" },
                { weekday: "short", day: "numeric" }
              ]
            },
            resourceTimelineMonth: {
              slotLabelFormat: [
                { month: "long", year: "numeric" },
                { weekday: "long", day: "numeric" }
              ]
            }
          }}
          headerToolbar={false}
          resources={resources}
          events={localEvents}
          locale="es"
          resourceOrder="order"
          slotMinWidth={slotWidth}
          eventOverlap={true}
          nowIndicator
          height="100%"
          stickyHeaderDates
          resourceAreaHeaderContent="Empresas"
          resourceAreaWidth={260}
          resourceLabelContent={(arg) => {
            const props = arg.resource.extendedProps || {};
            
            if (arg.resource.id === "servicios-parent") {
              return <span style={{ fontWeight: 800, fontSize: "0.95em", color: "#0f172a", textTransform: "uppercase" }}>{arg.resource.title}</span>;
            }
            if (props.esServicio) {
              return (
                <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
                  <span style={{ fontWeight: 600, color: "#475569", fontSize: "0.9em" }}>{arg.resource.title}</span>
                </div>
              );
            }

            if (props.esEmpresa) {
              const companyLabel = props.empresaNombre || arg.resource.title;
              return (
                <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
                  <span style={{ fontWeight: 800, color: "#0f172a", textTransform: "uppercase", fontSize: "0.95em" }}>{companyLabel}</span>
                </div>
              );
            }
            const groupName = props.grupoNombre || arg.resource.title;
            const secondary = props.pax ? `PAX ${props.pax}` : "";
            const hoteles = props.hoteles || [];
            const openAnotador = (e) => {
              e.stopPropagation();
              setAnotacionGrupo({
                grupoId: arg.resource.id,
                grupoNombre: groupName,
                empresaNombre: props.empresaNombre || "",
                fechaEntrada: props.fechaEntrada || "",
                fechaSalida: props.fechaSalida || "",
              });
            };
            return (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  cursor: "pointer",
                  gap: 5,
                  padding: "2px 0"
                }}
                title="Click para ver/editar Anotaciones, Hoteles y Rooming"
                onClick={openAnotador}
              >
                <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1, overflow: "hidden", flex: 1 }}>
                  <span style={{ fontWeight: 600, color: "#0f172a", fontSize: "0.92em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {groupName}
                  </span>
                  {secondary && (
                    <span style={{ fontSize: "0.76em", color: "#64748b", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {secondary}
                    </span>
                  )}
                  {hoteles.length > 0 && (
                    <div style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 3,
                      marginTop: 2
                    }}>
                      {hoteles.map((h, i) => (
                        <span
                          key={i}
                          title={`Hotel: ${h.nombre}${h.pax ? ` (${h.pax} PAX)` : ""}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 2,
                            background: "#ecfdf5",
                            color: "#065f46",
                            border: "1px solid #a7f3d0",
                            borderRadius: 4,
                            padding: "1px 5px",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            lineHeight: 1.25,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: "100%"
                          }}
                        >
                          🏨 {h.nombre} {h.pax ? `(${h.pax})` : ""}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Badges de servicios y actividades pendientes */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 3 }}>
                    {props.quinta_comida_acceso && (
                      <span
                        title="Este grupo tiene contratada 5ta comida"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 2,
                          background: "#ecfdf5",
                          color: "#047857",
                          border: "1px solid #6ee7b7",
                          borderRadius: 4,
                          padding: "1px 5px",
                          fontSize: "0.70rem",
                          fontWeight: 700,
                          lineHeight: 1.2
                        }}
                      >
                        🍔 5ta Comida
                      </span>
                    )}
                    {props.zacarias_ultimo_dia && (
                      <span
                        title="Zacarías configurado para el día de salida"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 2,
                          background: "#f0fdf4",
                          color: "#15803d",
                          border: "1px solid #86efac",
                          borderRadius: 4,
                          padding: "1px 5px",
                          fontSize: "0.70rem",
                          fontWeight: 700,
                          lineHeight: 1.2
                        }}
                      >
                        🌲 Zacarías Salida
                      </span>
                    )}
                    {props.actividades_pendientes && props.actividades_pendientes.length > 0 && (
                      props.actividades_pendientes.slice(0, 2).map((act, idx) => (
                        <span
                          key={idx}
                          title={`Falta asignar en el diagrama: ${act}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 2,
                            background: "#fffbeb",
                            color: "#b45309",
                            border: "1px solid #fde68a",
                            borderRadius: 4,
                            padding: "1px 4px",
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            lineHeight: 1.2
                          }}
                        >
                          ⚠️ Falta {act}
                        </span>
                      ))
                    )}
                    {props.actividades_pendientes && props.actividades_pendientes.length > 2 && (
                      <span
                        title={`Faltan: ${props.actividades_pendientes.slice(2).join(', ')}`}
                        style={{
                          fontSize: "0.68rem",
                          color: "#b45309",
                          fontWeight: 700,
                          background: "#fef3c7",
                          padding: "1px 4px",
                          borderRadius: 4,
                          lineHeight: 1.2
                        }}
                      >
                        +{props.actividades_pendientes.length - 2}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  title="Abrir Anotador del grupo"
                  onClick={openAnotador}
                  style={{
                    background: hoteles.length > 0 ? "#ecfdf5" : "#eff6ff",
                    border: `1px solid ${hoteles.length > 0 ? "#a7f3d0" : "#bfdbfe"}`,
                    borderRadius: 5,
                    padding: "2px 6px",
                    fontSize: "0.76rem",
                    cursor: "pointer",
                    color: hoteles.length > 0 ? "#065f46" : "#1d4ed8",
                    fontWeight: 700,
                    flexShrink: 0,
                    lineHeight: 1
                  }}
                >
                  📝
                </button>
              </div>
            );
          }}

          eventClick={handleEventClick}
          dateClick={handleDateClick}
          slotLabelContent={(arg) => {
            const d = arg.date;
            const viewType = arg.view?.type;

            if (viewType === "resourceTimelineMonth") {
              if (arg.level === 0) return arg.text;
              const weekday = d.toLocaleDateString("es-ES", { weekday: "long" }).toUpperCase();
              return `${weekday} ${d.getDate()}`;
            }

            if (arg.level === 0) return arg.text;

            const weekday = d.toLocaleDateString("es-ES", { weekday: "long" }).toUpperCase();
            return `${d.getDate()} ${weekday}`;
          }}
          slotLabelDidMount={(arg) => {
            if (readOnly) return;
            if (arg.level !== 1) return;
            arg.el.style.cursor = "pointer";
            arg.el.onclick = () => abrirNuevoGlobal(arg.date);
          }}
          eventContent={(arg) => {
            const title = arg.event.title;
            const props = arg.event.extendedProps || {};
            if (props.tipo === "resumen_servicios") {
              const lines = title.split("\n");
              return {
                html: `<div style="padding: 2px 4px; font-size: 0.75em; line-height: 1.2; color: #0f172a;">
                  <div style="font-weight: 700;">${lines[0] || ""}</div>
                  ${lines[1] ? `<div>${lines[1]}</div>` : ""}
                  ${lines[2] ? `<div>${lines[2]}</div>` : ""}
                </div>`
              };
            }

            if (props.tipo === "grupo") {
              const tieneQuinta = Boolean(props.tiene_quinta_comida);
              const esSalidaZac = Boolean(props.es_ultimo_dia_zacarias);
              const pendientes = props.actividades_pendientes || [];

              return {
                html: `<div style="padding: 2px 4px; display: flex; flex-direction: column; gap: 2px; height: 100%; justify-content: center; overflow: hidden; line-height: 1.15;">
                  <div style="font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${title}
                  </div>
                  <div style="display: flex; flex-wrap: wrap; gap: 3px; align-items: center; margin-top: 1px;">
                    ${tieneQuinta ? `
                      <span style="display: inline-flex; align-items: center; gap: 2px; background: #047857; color: #ffffff; padding: 1px 4px; border-radius: 3px; font-size: 0.68rem; font-weight: 800; letter-spacing: 0.02em; box-shadow: 0 1px 2px rgba(0,0,0,0.18); white-space: nowrap;">
                        🍔 5ta Comida
                      </span>
                    ` : ''}
                    ${esSalidaZac ? `
                      <span style="display: inline-flex; align-items: center; gap: 2px; background: #15803d; color: #ffffff; padding: 1px 4px; border-radius: 3px; font-size: 0.68rem; font-weight: 800; white-space: nowrap;">
                        🌲 Salida
                      </span>
                    ` : ''}
                    ${pendientes.length > 0 ? `
                      <span style="display: inline-flex; align-items: center; gap: 2px; background: rgba(0,0,0,0.08); color: inherit; padding: 1px 3px; border-radius: 3px; font-size: 0.65rem; font-weight: 700; white-space: nowrap;" title="Falta: ${pendientes.join(', ')}">
                        ⚠️ ${pendientes[0]}
                      </span>
                    ` : ''}
                  </div>
                </div>`
              };
            }

            if (props.es_opcional) {
              const lines = title.split('\n');
              return {
                html: `<div style="padding: 2px 4px; white-space: normal; line-height: 1.2;">
                  <div style="font-weight: bold;">${lines[0]}</div>
                  <div style="font-size: 0.72em; font-weight: 800; color: #78350f; background: #fef08a; border: 1px solid #facc15; border-radius: 3px; padding: 1px 5px; display: inline-block; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.02em;">
                    ⭐ Opcional vendida
                  </div>
                </div>`
              };
            }

            // Si el título contiene salto de línea, renderizar con HTML
            if (title.includes('\n')) {
              const lines = title.split('\n');
              return {
                html: `<div style="padding: 2px 4px; white-space: normal; line-height: 1.2;">
                  <div style="font-weight: bold;">${lines[0]}</div>
                  ${lines.slice(1).map(l => `<div style="font-size: 0.85em; margin-top: 2px;">${l}</div>`).join('')}
                </div>`
              };
            }

            // Renderizado por defecto
            return { html: `<div style="padding: 2px 4px;">${title}</div>` };
          }}
          eventClassNames={(arg) => {
            const props = arg.event?.extendedProps || {};
            if (filtroServicio && filtroServicio !== "todos") {
              const esAsig =
                props.tipo === "asignacion" ||
                props.tipo === "asignacion_readonly" ||
                props.tipo === "asignacion_hielo_resumen";
              if (esAsig) {
                return isEventoMatch(arg.event, filtroServicio)
                  ? ["fc-filtro-match"]
                  : ["fc-filtro-dimmed"];
              }
            }
            return [];
          }}
          eventDidMount={(info) => {
            const props = info.event.extendedProps || {};
            const tip = props.tooltip;
            if (tip) info.el.title = tip;

            if (props.tipo === "resumen_servicios") {
              info.el.style.pointerEvents = "none";
              info.el.style.boxShadow = "none";
              info.el.style.borderWidth = "1px";
              info.el.style.borderStyle = "dashed";
              info.el.style.borderColor = "#cbd5f5";
            }

            // CRITICAL: Al ser 'background', el evento no bloquea clicks. 
            // PERO queremos tooltip. FullCalendar a veces no muestra tooltip en background.
            // Aseguramos que tenga title.
            // No necesitamos pointerEvents none porque es background.
            // ACT: Necesitamos pointerEvents 'auto' para que salga el tooltip,
            // pero entonces captura el click, así que debemos manejarlo en eventClick (arriba).
            if (props.tipo === "grupo") {
              info.el.style.pointerEvents = "auto";
            }
          }}
        />
      </div>

      {!readOnly && modalOpen && (
        <div className="modal-overlay">
          <div className="modal">

            <h3>
              {editando?.tipo === "asignacion"
                ? "Asignación existente"
                : grupoAsignando
                  ? "Asignar evento al grupo"
                  : editando
                    ? "Editar evento global"
                    : "Nuevo evento global"
              }
              <br />
              <small>{selectedDate}</small>
            </h3>

            {grupoAsignando && (() => {
              const grupoObj = resources.find(r => String(r.id) === String(grupoAsignando));
              if (!grupoObj) return null;
              const gProps = grupoObj.extendedProps || {};
              return (
                <button
                  type="button"
                  onClick={() => {
                    setAnotacionGrupo({
                      grupoId: grupoObj.id,
                      grupoNombre: gProps.grupoNombre || grupoObj.title,
                      empresaNombre: gProps.empresaNombre || "",
                      fechaEntrada: gProps.fechaEntrada || "",
                      fechaSalida: gProps.fechaSalida || "",
                    });
                    setModalOpen(false);
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: 7,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12,
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    boxShadow: "0 2px 6px rgba(37,99,235,0.2)"
                  }}
                >
                  <span>📝 Abrir Anotador del Grupo (Hoteles / Comidas / Rooming)</span>
                  <span>➔</span>
                </button>
              );
            })()}

            {editando?.tipo === "asignacion" ? (
              <div style={{ margin: "10px 0" }}>
                <p><b>Evento:</b> {editando.nombre}</p>
                {/* Botón toggle opcional */}
                <div style={{ margin: "12px 0", padding: "10px", background: "#fef9c3", borderRadius: 8, border: "1px solid #fde68a" }}>
                  <p style={{ margin: "0 0 8px 0", fontWeight: 600, color: "#92400e", fontSize: "0.9rem" }}>
                    🌟 Compra opcional
                  </p>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.88rem" }}>
                    <input
                      type="checkbox"
                      checked={Boolean(editando.es_opcional)}
                      onChange={async (e) => {
                        const newVal = e.target.checked;
                        try {
                          captureCurrentScroll(editando?.fecha || selectedDate);
                          await api.put(`/calendario/asignacion/${editando.id}`, { es_opcional: newVal });
                          setEditando(prev => ({ ...prev, es_opcional: newVal }));
                          onRecargar?.();
                        } catch {
                          alert("Error al actualizar");
                        }
                      }}
                    />
                    Opcional vendida (precio diferente al incluido)
                  </label>
                  {editando.es_opcional && (
                    <p style={{ margin: "6px 0 0", fontSize: "0.8rem", color: "#78350f" }}>
                      ✅ Marcada como opcional. Aparecerá en finanzas con precio de "Disco Opcional".
                    </p>
                  )}
                </div>
                <p style={{ fontSize: "0.85rem", color: "#64748b" }}>Para eliminar esta asignación, pulsá el botón rojo.</p>
              </div>
            ) : (
              <>
                <select
                  value={eventoSeleccionado}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEventoSeleccionado(val);
                    const match = eventosDisponibles.find(ev => (ev.fecha_evento_id || ev.id) === Number(val));
                    if (match?.horario) {
                      setHorario(match.horario);
                    }
                  }}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.9rem" }}
                >
                  <option value="">-- Seleccionar evento o servicio --</option>
                  {(() => {
                    const abiertos = eventosDisponibles.filter(ev => ev.esta_abierto !== false);
                    const otros = eventosDisponibles.filter(ev => ev.esta_abierto === false);

                    const renderOption = (ev) => {
                      const instancia = localEvents.find(e =>
                        String(e.resourceId).startsWith("servicio-") &&
                        Number(e.extendedProps?.evento_id) === Number(ev.id) &&
                        e.start.startsWith(selectedDate)
                      );

                      let label = `${ev.nombre} (${ev.tipo})`;
                      if (instancia && instancia.extendedProps) {
                        const { ocupacion, capacidad, con_comida, sin_comida } = instancia.extendedProps;
                        let extra = "";
                        if (ev.tipo === "PARQUE" || ev.tipo === "POOL") {
                          extra = ` (Comida: ${con_comida} / Sin: ${sin_comida})`;
                        }
                        label += ` [Oc: ${ocupacion} / Cap: ${capacidad}]${extra}`;
                      } else if (ev.capacidad_maxima) {
                        label += ` [Cap: ${ev.capacidad_maxima}]`;
                      }

                      const esPrivadoEvento = Boolean(instancia?.extendedProps?.es_privado);
                      const empresaPrivadaEvento = instancia?.extendedProps?.empresa_privada_id != null
                        ? Number(instancia.extendedProps.empresa_privada_id)
                        : null;
                      const empresaObjId = empresaObjetivo != null ? Number(empresaObjetivo) : null;

                      if (grupoAsignando && esPrivadoEvento) {
                        if (!empresaObjId || empresaPrivadaEvento !== empresaObjId) {
                          return null;
                        }
                      }

                      if (esPrivadoEvento && instancia?.extendedProps?.empresa_privada_nombre) {
                        label += ` [Privado: ${instancia.extendedProps.empresa_privada_nombre}]`;
                      }

                      const optionVal = ev.fecha_evento_id || ev.id;
                      return (
                        <option key={`${ev.esta_abierto ? 'abierto' : 'base'}-${optionVal}`} value={optionVal}>
                          {label}
                        </option>
                      );
                    };

                    return (
                      <>
                        {abiertos.length > 0 && (
                          <optgroup label="✨ Eventos ya abiertos en esta fecha">
                            {abiertos.map(renderOption)}
                          </optgroup>
                        )}
                        {otros.length > 0 && (
                          <optgroup label="📋 Otros servicios disponibles (Crear / Asignar)">
                            {otros.map(renderOption)}
                          </optgroup>
                        )}
                      </>
                    );
                  })()}
                </select>

                {!grupoAsignando && (() => {
                  // Determinar tipo de evento
                  const eventoObj = eventosDisponibles.find(ev => ev.id === Number(eventoSeleccionado));
                  const tipoEv = (eventoObj?.tipo || editando?.evento_tipo || "").toUpperCase();
                  const nomEv = (eventoObj?.nombre || editando?.evento_nombre || "").toUpperCase();
                  const esDisco = tipoEv === "DISCO" || nomEv.includes("DISCO") || nomEv.includes("BOLICHE");

                  // Permitir Show y Animador / DJ para Boliches, Cascata Carolina, Zacarías, Cabral y Parador
                  const permiteShowAnimador =
                    esDisco ||
                    tipoEv === "ZACARIAS" ||
                    tipoEv === "PARADOR" ||
                    tipoEv === "POOL" ||
                    tipoEv === "CABRAL" ||
                    nomEv.includes("ZACARIAS") ||
                    nomEv.includes("PARADOR") ||
                    nomEv.includes("CASCATA") ||
                    nomEv.includes("CAROLINA") ||
                    nomEv.includes("CABRAL");

                  const bloqueoEmpresaPrivada = Boolean(editando?.tipo === "global" && (editando?.ocupacion || 0) > 0);

                  return (
                    <>
                      {esDisco && (
                        <div style={{ marginTop: 10 }}>
                          <label style={{ display: "block", marginBottom: 5, fontSize: "0.9rem", fontWeight: "bold" }}>
                            Modalidad Alcohol:
                          </label>
                          <select
                            value={tipoAlcohol}
                            onChange={(e) => setTipoAlcohol(e.target.value)}
                            style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                          >
                            <option value="sin">🟡 Sin Alcohol (Amarillo)</option>
                            <option value="mix">🟠 Mix / Pulsera (Naranja)</option>
                            <option value="con">🔴 Con Alcohol (Rojo)</option>
                          </select>
                        </div>
                      )}

                      {esDisco && (
                        <div style={{ marginTop: 10 }}>
                          <label style={{ display: "block", marginBottom: 5 }}>
                            Temática (opcional):
                          </label>
                          <select
                            value={tematicaSeleccionada}
                            onChange={(e) => setTematicaSeleccionada(e.target.value)}
                            style={{ width: "100%" }}
                          >
                            <option value="">Sin temática</option>
                            {tematicas.map((tem) => (
                              <option key={tem.id} value={tem.id}>
                                {tem.nombre} {tem.descripcion && `- ${tem.descripcion}`}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {permiteShowAnimador && (
                        <div style={{ marginTop: 12, padding: "10px 12px", background: "#f8fafc", borderRadius: 8, border: "1px dashed #94a3b8" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1e293b" }}>
                              🔒 Anotaciones Internas (Admin y Equipo)
                            </span>
                            <span style={{ fontSize: "0.72rem", background: "#e2e8f0", color: "#475569", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>
                              No visible para empresas
                            </span>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            <div>
                              <label style={{ display: "block", marginBottom: 4, fontSize: "0.8rem", color: "#475569", fontWeight: 600 }}>
                                🎤 Show:
                              </label>
                              <input
                                type="text"
                                placeholder="ej: Robot LED / Banda"
                                value={show}
                                onChange={(e) => setShow(e.target.value)}
                                style={{ width: "100%", padding: "6px 8px", borderRadius: "5px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                              />
                            </div>
                            <div>
                              <label style={{ display: "block", marginBottom: 4, fontSize: "0.8rem", color: "#475569", fontWeight: 600 }}>
                                🎧 Animador / DJ:
                              </label>
                              <input
                                type="text"
                                placeholder="ej: Animador Leo"
                                value={animador}
                                onChange={(e) => setAnimador(e.target.value)}
                                style={{ width: "100%", padding: "6px 8px", borderRadius: "5px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                              />
                            </div>
                          </div>

                          {esDisco && (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
                              <div>
                                <label style={{ display: "block", marginBottom: 4, fontSize: "0.8rem", color: "#475569", fontWeight: 600 }}>
                                  💵 Cajas:
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="ej: 4"
                                  value={cantidadCajas}
                                  onChange={(e) => setCantidadCajas(e.target.value)}
                                  style={{ width: "100%", padding: "6px 8px", borderRadius: "5px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                                />
                              </div>
                              <div>
                                <label style={{ display: "block", marginBottom: 4, fontSize: "0.8rem", color: "#475569", fontWeight: 600 }}>
                                  🛡️ Seguridad:
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="ej: 12"
                                  value={cantidadSeguridad}
                                  onChange={(e) => setCantidadSeguridad(e.target.value)}
                                  style={{ width: "100%", padding: "6px 8px", borderRadius: "5px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                                />
                              </div>
                              <div>
                                <label style={{ display: "block", marginBottom: 4, fontSize: "0.8rem", color: "#475569", fontWeight: 600 }}>
                                  🧹 Limpieza:
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="ej: 6"
                                  value={cantidadLimpieza}
                                  onChange={(e) => setCantidadLimpieza(e.target.value)}
                                  style={{ width: "100%", padding: "6px 8px", borderRadius: "5px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div style={{ marginTop: 10 }}>
                        <label style={{ display: "block", marginBottom: 5 }}>
                          Horario / Turno (opcional, ej: 18:00hs):
                        </label>
                        <input
                          type="text"
                          placeholder="ej: 18:00hs"
                          value={horario}
                          onChange={(e) => setHorario(e.target.value)}
                          style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                        />
                      </div>

                      <label style={{ display: "block", marginTop: 12 }}>
                        <input
                          type="checkbox"
                          checked={esPrivado}
                          onChange={(e) => setEsPrivado(e.target.checked)}
                        />
                        Evento privado para una empresa
                      </label>

                      {esPrivado && (
                        <div style={{ marginTop: 10 }}>
                          <label style={{ display: "block", marginBottom: 5 }}>Empresa asignada:</label>
                          <select
                            value={empresaPrivadaId}
                            onChange={(e) => setEmpresaPrivadaId(e.target.value)}
                            style={{ width: "100%" }}
                            disabled={bloqueoEmpresaPrivada}
                          >
                            <option value="">Seleccionar empresa</option>
                            {empresas.map((empresa) => (
                              <option key={empresa.id} value={empresa.id}>
                                {empresa.nombre}
                              </option>
                            ))}
                          </select>
                          {bloqueoEmpresaPrivada && (
                            <p style={{ fontSize: "0.8rem", color: "#ef4444", marginTop: 6 }}>
                              El evento tiene grupos asignados. Eliminá las asignaciones para cambiar de empresa.
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}

                {grupoAsignando && (
                  <>
                    <div style={{ marginTop: 10 }}>
                      <label style={{ display: "block", marginBottom: 5, fontSize: "0.85rem", fontWeight: 600, color: "#475569" }}>
                        ⏰ Horario del evento (opcional, ej: 20:30hs):
                      </label>
                      <input
                        type="text"
                        placeholder="ej: 20:30hs"
                        value={horario}
                        onChange={(e) => setHorario(e.target.value)}
                        style={{ width: "100%", padding: "6px 8px", borderRadius: "5px", border: "1px solid #cbd5e1", fontSize: "0.88rem" }}
                      />
                    </div>

                    <div style={{ marginTop: 12, padding: "10px", background: "#fef9c3", borderRadius: 8, border: "1px solid #fde68a" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.88rem", fontWeight: 700, color: "#854d0e" }}>
                        <input
                          type="checkbox"
                          checked={esOpcionalAsignar}
                          onChange={(e) => setEsOpcionalAsignar(e.target.checked)}
                        />
                        🌟 Marcar como Opcional vendida
                      </label>
                      <small style={{ display: "block", marginTop: 4, color: "#a16207", fontSize: "0.78rem" }}>
                        Permite asignar cualquier servicio vendido extra (Zacarías, Hielo, Pool, etc.). Tendrá valor diferenciado en Finanzas y dirá "Opcional vendida" en el diagrama.
                      </small>
                    </div>
                  </>
                )}
              </>
            )}

            {/* ===============================================================
                SECCIÓN HORARIOS POR EMPRESA (solo al editar evento global)
                =============================================================== */}
            {editando?.tipo === "global" && fechaEventoIdActual && (
              <HorariosEmpresaPanel
                fechaEventoId={fechaEventoIdActual}
                horariosEmpresa={horariosEmpresa}
                cargandoHorarios={cargandoHorarios}
                empresas={empresas}
                onGuardar={guardarHorarioEmpresa}
                onEliminar={eliminarHorarioEmpresa}
              />
            )}

            <div style={{ marginTop: 15 }}>
              {editando?.tipo !== "asignacion" && (
                <button className="primary" onClick={guardar}>
                  {editando ? "Guardar cambios" : "Crear / Asignar"}
                </button>
              )}

              {/* Boton Eliminar solo si estamos editando algo existente */}
              {(editando && editando.tipo) && (
                <button
                  className="danger"
                  onClick={eliminar}
                >
                  Eliminar
                </button>
              )}

              <button onClick={cerrar}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {anotacionGrupo && (
        <AnotacionGrupoPanel
          grupoId={anotacionGrupo.grupoId}
          grupoNombre={anotacionGrupo.grupoNombre}
          empresaNombre={anotacionGrupo.empresaNombre}
          fechaEntrada={anotacionGrupo.fechaEntrada}
          fechaSalida={anotacionGrupo.fechaSalida}
          onClose={() => {
            captureCurrentScroll(anotacionGrupo.fechaEntrada || anotacionGrupo.fechaSalida || null);
            setAnotacionGrupo(null);
            if (onRecargar) onRecargar();
          }}
          onActualizado={() => {
            captureCurrentScroll(anotacionGrupo.fechaEntrada || anotacionGrupo.fechaSalida || null);
            if (onRecargar) onRecargar();
          }}
        />
      )}
    </>
  );
}

// =========================================================
// SUB-COMPONENTE: Panel de horarios individuales por empresa
// =========================================================
function HorariosEmpresaPanel({ fechaEventoId, horariosEmpresa, cargandoHorarios, empresas, onGuardar, onEliminar }) {
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState("");
  const [horarioInput, setHorarioInput] = useState("");
  const [notaInput, setNotaInput] = useState("");

  // Pre-fill when selecting a company that already has a schedule
  const handleEmpresaChange = (e) => {
    const eid = e.target.value;
    setEmpresaSeleccionada(eid);
    const existente = horariosEmpresa.find(h => String(h.empresa_id) === String(eid));
    setHorarioInput(existente?.horario || "");
    setNotaInput(existente?.nota || "");
  };

  const handleGuardar = async () => {
    if (!empresaSeleccionada || !horarioInput.trim()) {
      alert("Seleccioná una empresa e ingresá el horario");
      return;
    }
    await onGuardar(fechaEventoId, Number(empresaSeleccionada), horarioInput, notaInput);
    setHorarioInput("");
    setNotaInput("");
    setEmpresaSeleccionada("");
  };

  return (
    <div style={{
      marginTop: 16,
      borderTop: "2px solid #e2e8f0",
      paddingTop: 12,
    }}>
      <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#0f172a", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
        🕐 Horarios individuales por empresa
        <span style={{ fontWeight: 400, fontSize: "0.78rem", color: "#64748b" }}>
          (visible solo en el portal de cada empresa)
        </span>
      </div>

      {cargandoHorarios && <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Cargando...</p>}

      {/* Lista de horarios ya asignados */}
      {horariosEmpresa.length > 0 && (
        <div style={{ marginBottom: 10, display: "flex", flexDirection: "column", gap: 4 }}>
          {horariosEmpresa.map(h => (
            <div key={h.id} style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: 6,
              padding: "4px 8px",
              fontSize: "0.85rem"
            }}>
              <span style={{ fontWeight: 600, color: "#166534", minWidth: 80 }}>{h.empresa_nombre}</span>
              <span style={{ color: "#0f172a" }}>⏰ {h.horario}</span>
              {h.nota && <span style={{ color: "#64748b", fontStyle: "italic" }}>({h.nota})</span>}
              <button
                onClick={() => onEliminar(h.id, fechaEventoId)}
                style={{
                  marginLeft: "auto",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#ef4444",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  padding: "0 4px"
                }}
                title="Eliminar horario"
              >✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Formulario para agregar/editar */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 10 }}>
        <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#475569" }}>Agregar / editar horario:</label>
        <select
          value={empresaSeleccionada}
          onChange={handleEmpresaChange}
          style={{ padding: "5px 8px", borderRadius: 5, border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
        >
          <option value="">— Seleccionar empresa —</option>
          {empresas.map(emp => (
            <option key={emp.id} value={emp.id}>
              {emp.nombre}
              {horariosEmpresa.find(h => h.empresa_id === emp.id) ? " ✓" : ""}
            </option>
          ))}
        </select>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            type="text"
            placeholder="Horario (ej: 10:00hs)"
            value={horarioInput}
            onChange={e => setHorarioInput(e.target.value)}
            style={{ flex: 1, padding: "5px 8px", borderRadius: 5, border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
          />
          <input
            type="text"
            placeholder="Nota (opcional)"
            value={notaInput}
            onChange={e => setNotaInput(e.target.value)}
            style={{ flex: 1, padding: "5px 8px", borderRadius: 5, border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
          />
          <button
            onClick={handleGuardar}
            style={{
              background: "#16a34a",
              color: "white",
              border: "none",
              borderRadius: 5,
              padding: "5px 12px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: "0.85rem"
            }}
          >Guardar</button>
        </div>
      </div>
    </div>
  );
}
