import { useRef, useState, useEffect, useCallback } from "react";
import FullCalendar from "@fullcalendar/react";
import resourceTimelinePlugin from "@fullcalendar/resource-timeline";
import interactionPlugin from "@fullcalendar/interaction";
import api from "../api";
import "./timeline.css";

export default function TimelineCalendar({ resources, events, readOnly = false, onRegisterRef }) {
  const calendarRef = useRef(null);

  // Exponer método navegarAMes al padre via callback prop
  useEffect(() => {
    if (onRegisterRef) {
      onRegisterRef({
        navegarAMes(fecha) {
          const api = calendarRef.current?.getApi();
          if (!api) return;
          api.changeView("resourceTimelineMonth", fecha);
        },
        irAFecha(fecha) {
          const api = calendarRef.current?.getApi();
          if (!api) return;
          api.gotoDate(fecha);
        }
      });
    }
  }, [onRegisterRef]);

  // =========================================================
  // STATE
  // =========================================================
  const [slotWidth, setSlotWidth] = useState(110);
  const [localEvents, setLocalEvents] = useState(events);
  const hasCenteredToday = useRef(false);

  const centerToday = useCallback(() => {
    const rootEl = calendarRef.current?.el;
    if (!rootEl) return false;
    const todayISO = new Date().toISOString().slice(0, 10);
    const slot =
      rootEl.querySelector(`.fc-timeline-slot[data-date="${todayISO}"]`)
      || rootEl.querySelector(`.fc-col-header-cell[data-date="${todayISO}"]`);
    const scroller =
      rootEl.querySelector(".fc-scroller-harness .fc-scroller")
      || rootEl.querySelector(".fc-timeline-body .fc-scroller");
    if (slot && scroller) {
      const offset = slot.offsetLeft - scroller.clientWidth / 2 + slot.clientWidth / 2;
      scroller.scrollLeft = offset;
      return true;
    }
    if (slot?.scrollIntoView) {
      slot.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    if (hasCenteredToday.current) return;
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.gotoDate(new Date());

    let attempts = 0;
    const maxAttempts = 6;

    const tryCenter = () => {
      if (centerToday()) {
        hasCenteredToday.current = true;
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
  }, [centerToday, events]);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);

  const [eventosDisponibles, setEventosDisponibles] = useState([]);
  const [eventoSeleccionado, setEventoSeleccionado] = useState("");
  const [conAlcohol, setConAlcohol] = useState(false);

  const [tematicas, setTematicas] = useState([]);
  const [tematicaSeleccionada, setTematicaSeleccionada] = useState("");
  const [esPrivado, setEsPrivado] = useState(false);
  const [empresaPrivadaId, setEmpresaPrivadaId] = useState("");
  const [empresas, setEmpresas] = useState([]);
  const [empresaObjetivo, setEmpresaObjetivo] = useState(null);

  const [editando, setEditando] = useState(null);
  const [grupoAsignando, setGrupoAsignando] = useState(null);

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
        const res = await api.get("/empresas");
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
  // REFRESH
  // =========================================================
  const refresh = async () => {
    const res = await api.get("/calendario");
    setLocalEvents(res.data.events);
  };

  // =========================================================
  // EVENTOS DEL DIA SOLAMENTE
  // =========================================================
  const cargarEventosDelDia = async (fechaISO) => {
    // 1. Obtener todas las definiciones de eventos (Eclipse, Parque, etc)
    const res = await api.get("/eventos");
    const todosLosEventos = res.data;

    // 2. Obtener lo que está "abierto" ese día desde el calendario
    // Si no hay evento global creado, el array estará vacío.
    const calendario = await api.get("/calendario");

    // Filtrar los que son resourceId "eventos" (la fila 0) y coinciden con la fecha
    const existentes = calendario.data.events.filter(
      (e) => e.resourceId === "eventos" && e.start.startsWith(fechaISO)
    );

    const ids = existentes.map((e) => e.extendedProps?.evento_id);

    // Filtrar la lista de definiciones
    const filtrados = todosLosEventos.filter((ev) => ids.includes(ev.id));

    setEventosDisponibles(filtrados);
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
  const abrirNuevoGlobal = async (dateObj) => {
    const fechaISO = dateObj.toISOString().slice(0, 10);

    setSelectedDate(fechaISO);
    setGrupoAsignando(null); // No es grupo
    setEditando(null);       // No es edición de existente
    setEventoSeleccionado("");
    setConAlcohol(false);
    setTematicaSeleccionada("");
    setEsPrivado(false);
    setEmpresaPrivadaId("");

    // Para crear global, mostramos TODOS los eventos posibles para elegir
    const res = await api.get("/eventos/");
    setEventosDisponibles(res.data);

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
        nombre: props.nombre_evento
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
    if (info.event.getResources()[0]?.id === "eventos") {
      const res = await api.get("/eventos/");
      setEventosDisponibles(res.data);

      setSelectedDate(fechaISO);
      setEventoSeleccionado(props.evento_id);
      setConAlcohol(props.con_alcohol);
      setTematicaSeleccionada(props.tematica_id || "");
      setEsPrivado(Boolean(props.es_privado));
      setEmpresaPrivadaId(props.empresa_privada_id ? String(props.empresa_privada_id) : "");

      // CRITICAL FIX: Do NOT spread info.event directly. It's a complex object.
      // Extract what we need.
      setEditando({
        id: info.event.id,
        title: info.event.title,
        ...props,
        tipo: "global"
      });
      setGrupoAsignando(null);

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

    // A. CLIC EN FILA DE EVENTOS GLOBAL (No debería pasar mucho si está lleno, pero por si acaso)
    if (resourceIdStr === "eventos") {
      abrirNuevoGlobal(info.date);
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

    setModalOpen(true);
  };

  // =========================================================
  // GUARDAR
  // =========================================================
  const guardar = async () => {
    try {
      if (!eventoSeleccionado && !editando) return;
      if (!grupoAsignando && esPrivado && !empresaPrivadaId) {
        alert("Seleccioná la empresa para el evento privado");
        return;
      }

      // 1. Asignar a grupo (Nueva asignación)
      if (grupoAsignando && !editando) {
        if (!eventoSeleccionado) return;
        await api.post(`/calendario/grupo/${grupoAsignando}/asignar`, {
          evento_id: Number(eventoSeleccionado),
          fecha: selectedDate,
        });
      }

      // 2. Editar global
      else if (editando && editando.tipo === "global") {
        await api.put(`/calendario/fecha/${getCleanId(editando.id)}`, {
          evento_id: Number(eventoSeleccionado),
          fecha_nueva: selectedDate,
          con_alcohol: conAlcohol,
          tematica_id: tematicaSeleccionada ? Number(tematicaSeleccionada) : null,
          es_privado: esPrivado,
          empresa_privada_id: esPrivado ? Number(empresaPrivadaId) : null,
        });
      }

      // 3. Crear global
      else if (!grupoAsignando && !editando) {
        await api.post("/eventos/fecha", {
          evento_id: Number(eventoSeleccionado),
          fecha: selectedDate,
          con_alcohol: conAlcohol,
          tematica_id: tematicaSeleccionada ? Number(tematicaSeleccionada) : null,
          es_privado: esPrivado,
          empresa_privada_id: esPrivado ? Number(empresaPrivadaId) : null,
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
    setModalOpen(false);
    setEditando(null);
    setGrupoAsignando(null);
    setEsPrivado(false);
    setEmpresaPrivadaId("");
    refresh();
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
          initialView="resourceTimelineYear"
          initialDate={new Date()}
          views={{
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
          resourceAreaWidth={230}
          resourceLabelContent={(arg) => {
            if (arg.resource.id === "eventos") {
              return <span style={{ fontWeight: 700, fontSize: "1em" }}>Servicios</span>;
            }
            const props = arg.resource.extendedProps || {};
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
            return (
              <div style={{ display: "flex", flexDirection: "column", lineHeight: 0.9 }}>
                <span style={{ fontWeight: 500, color: "#0f172a", fontSize: "0.95em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{groupName}</span>
                {secondary && <span style={{ fontSize: "0.8em", color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{secondary}</span>}
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

            // Si el título contiene salto de línea, renderizar con HTML
            if (title.includes('\n')) {
              const lines = title.split('\n');
              return {
                html: `<div style="padding: 2px 4px; white-space: normal; line-height: 1.2;">
                  <div style="font-weight: bold;">${lines[0]}</div>
                  ${lines[1] ? `<div style="font-size: 0.9em; margin-top: 2px;">${lines[1]}</div>` : ''}
                </div>`
              };
            }

            // Renderizado por defecto
            return { html: `<div style="padding: 2px 4px;">${title}</div>` };
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

            {editando?.tipo === "asignacion" ? (
              <div style={{ margin: "10px 0" }}>
                <p><b>Evento:</b> {editando.nombre}</p>
                <p>Para eliminar esta asignación, pulsa el botón rojo.</p>
              </div>
            ) : (
              <>
                <select
                  value={eventoSeleccionado}
                  onChange={(e) => setEventoSeleccionado(e.target.value)}
                >
                  <option value="">Seleccionar evento</option>
                  {eventosDisponibles.map((ev) => {
                    // Buscar si este evento ya está instanciado este día para mostrar cap?
                    // El usuario quiere ver ocupacion al asignar.
                    // 'eventosDisponibles' son Event Definitions.
                    // Pero en 'cargarEventosDelDia' filtramos los que existen dia.
                    // Si esta instanciado, en 'localEvents' tenemos su extendedProps con ocupacion.
                    // Pero localEvents tiene 'id' "id-X".
                    // Buscamos en localEvents
                    const instancia = localEvents.find(e =>
                      e.resourceId === "eventos" &&
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
                    } else {
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

                    return (
                      <option key={ev.id} value={ev.id}>
                        {label}
                      </option>
                    );
                  })}
                </select>

                {!grupoAsignando && (() => {
                  // Determinar si el evento seleccionado es tipo DISCO
                  const eventoObj = eventosDisponibles.find(ev => ev.id === Number(eventoSeleccionado));
                  const esDisco = eventoObj?.tipo === "DISCO";
                  const bloqueoEmpresaPrivada = Boolean(editando?.tipo === "global" && (editando?.ocupacion || 0) > 0);

                  return (
                    <>
                      <label style={{ display: "block", marginTop: 10 }}>
                        <input
                          type="checkbox"
                          checked={conAlcohol}
                          onChange={(e) => setConAlcohol(e.target.checked)}
                        />
                        Con alcohol
                      </label>

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
              </>
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
    </>
  );
}
