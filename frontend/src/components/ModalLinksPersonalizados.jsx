import { useState, useEffect, useCallback } from "react";
import api from "../api";

export const SERVICIOS_DISPONIBLES = [
  { id: "DISCO", nombre: "Boliches / Discotecas", emoji: "🎉", color: "#a855f7" },
  { id: "ZACARIAS", nombre: "Zacarías", emoji: "🌲", color: "#15803d" },
  { id: "POOL", nombre: "Cascata / Pool", emoji: "🌊", color: "#0ea5e9" },
  { id: "MULTIPARQUE", nombre: "Multiparque", emoji: "🎡", color: "#22c55e" },
  { id: "PARADOR", nombre: "Parador", emoji: "🏖️", color: "#f97316" },
  { id: "HIELO", nombre: "Bar de Hielo", emoji: "❄️", color: "#0284c7" },
  { id: "CENA", nombre: "Cena de Velas", emoji: "🕯️", color: "#eab308" },
  { id: "SURF", nombre: "Surf", emoji: "🏄", color: "#3b82f6" },
  { id: "UNIPRAIAS", nombre: "Unipraias", emoji: "🚡", color: "#10b981" },
  { id: "BETO", nombre: "Beto Carrero", emoji: "🎢", color: "#ec4899" },
  { id: "BARCO", nombre: "Barco Pirata", emoji: "🏴‍☠️", color: "#8b5cf6" },
  { id: "CRISTO", nombre: "Cristo Luz", emoji: "✨", color: "#ca8a04" },
  { id: "PARQUE", nombre: "Parque", emoji: "🌳", color: "#16a34a" },
  { id: "CAMPAMENTO", nombre: "Campamento", emoji: "⛺", color: "#f97316" },
];

export default function ModalLinksPersonalizados({ empresa, isOpen, onClose }) {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [copiadoId, setCopiadoId] = useState(null);

  // Lista de todas las empresas disponibles en el sistema
  const [todasLasEmpresas, setTodasLasEmpresas] = useState([]);

  // Formulario nuevo link
  const [nombre, setNombre] = useState("");
  const [modoEmpresas, setModoEmpresas] = useState("unica"); // "todas" | "multiples" | "unica"
  const [empresasSeleccionadas, setEmpresasSeleccionadas] = useState([]);
  const [serviciosSeleccionados, setServiciosSeleccionados] = useState(["DISCO"]);
  const [todosLosGrupos, setTodosLosGrupos] = useState(true);
  const [gruposSeleccionados, setGruposSeleccionados] = useState([]);
  const [incluirVouchers, setIncluirVouchers] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Grupos disponibles si es modo una empresa
  const [gruposEmpresa, setGruposEmpresa] = useState([]);

  const cargarTodasLasEmpresas = useCallback(async () => {
    try {
      const res = await api.get("/empresas");
      setTodasLasEmpresas(res.data || []);
    } catch {
      // Ignorar
    }
  }, []);

  const cargarLinks = useCallback(async () => {
    setLoading(true);
    try {
      const url = empresa?.id ? `/links-personalizados?empresa_id=${empresa.id}` : "/links-personalizados";
      const res = await api.get(url);
      setLinks(res.data);
    } catch {
      setError("Error al cargar los links personalizados");
    } finally {
      setLoading(false);
    }
  }, [empresa?.id]);

  const cargarGruposEmpresaUnica = useCallback(async (empId) => {
    if (!empId) {
      setGruposEmpresa([]);
      return;
    }
    try {
      const res = await api.get(`/empresas/${empId}`);
      setGruposEmpresa(res.data?.grupos || []);
    } catch {
      setGruposEmpresa([]);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      cargarTodasLasEmpresas();
      cargarLinks();
      setError("");
      setMostrarFormulario(false);

      if (empresa?.id) {
        setModoEmpresas("unica");
        setEmpresasSeleccionadas([empresa.id]);
        cargarGruposEmpresaUnica(empresa.id);
      } else {
        setModoEmpresas("todas");
        setEmpresasSeleccionadas([]);
        setGruposEmpresa([]);
      }
      resetForm();
    }
  }, [isOpen, empresa, cargarLinks, cargarTodasLasEmpresas, cargarGruposEmpresaUnica]);

  function resetForm() {
    setNombre("");
    if (empresa?.id) {
      setModoEmpresas("unica");
      setEmpresasSeleccionadas([empresa.id]);
    } else {
      setModoEmpresas("todas");
      setEmpresasSeleccionadas([]);
    }
    setServiciosSeleccionados(["DISCO"]);
    setTodosLosGrupos(true);
    setGruposSeleccionados([]);
    setIncluirVouchers(false);
    setGuardando(false);
  }

  function toggleEmpresa(empId) {
    if (empresasSeleccionadas.includes(empId)) {
      setEmpresasSeleccionadas(empresasSeleccionadas.filter((id) => id !== empId));
    } else {
      setEmpresasSeleccionadas([...empresasSeleccionadas, empId]);
    }
  }

  function toggleServicio(id) {
    if (serviciosSeleccionados.includes(id)) {
      setServiciosSeleccionados(serviciosSeleccionados.filter((s) => s !== id));
    } else {
      setServiciosSeleccionados([...serviciosSeleccionados, id]);
    }
  }

  function toggleGrupo(id) {
    if (gruposSeleccionados.includes(id)) {
      setGruposSeleccionados(gruposSeleccionados.filter((g) => g !== id));
    } else {
      setGruposSeleccionados([...gruposSeleccionados, id]);
    }
  }

  function seleccionarSoloDiscos() {
    setServiciosSeleccionados(["DISCO"]);
    if (!nombre) setNombre("Solo Boliches / Discos");
  }

  function seleccionarSoloParques() {
    setServiciosSeleccionados(["ZACARIAS", "POOL", "MULTIPARQUE", "PARADOR", "SURF", "UNIPRAIAS", "BETO", "BARCO", "CRISTO"]);
    if (!nombre) setNombre("Parques y Excursiones");
  }

  function seleccionarTodosServicios() {
    setServiciosSeleccionados(SERVICIOS_DISPONIBLES.map((s) => s.id));
  }

  function desmarcarTodosServicios() {
    setServiciosSeleccionados([]);
  }

  async function crearLink(e) {
    e.preventDefault();
    if (!nombre.trim()) {
      alert("Por favor ingresa un nombre o destinatario para el link");
      return;
    }
    if (serviciosSeleccionados.length === 0) {
      alert("Debes seleccionar al menos un servicio permitido");
      return;
    }

    if (modoEmpresas === "unica" && empresasSeleccionadas.length === 0) {
      alert("Debes seleccionar una empresa");
      return;
    }
    if (modoEmpresas === "multiples" && empresasSeleccionadas.length === 0) {
      alert("Debes seleccionar al menos una empresa o marcar 'Todas las empresas'");
      return;
    }

    setGuardando(true);
    try {
      await api.post("/links-personalizados", {
        empresa_id: modoEmpresas === "unica" ? empresasSeleccionadas[0] : null,
        empresas_ids: modoEmpresas === "multiples" ? empresasSeleccionadas : null,
        todas_las_empresas: modoEmpresas === "todas",
        nombre: nombre.trim(),
        servicios_permitidos: serviciosSeleccionados,
        grupos_permitidos: (modoEmpresas === "unica" && !todosLosGrupos) ? gruposSeleccionados : null,
        incluir_vouchers: incluirVouchers,
      });
      resetForm();
      setMostrarFormulario(false);
      cargarLinks();
    } catch (err) {
      alert(err.response?.data?.detail || "Error al crear link personalizado");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarLink(id) {
    if (!window.confirm("¿Seguro que deseas eliminar este link personalizado? Quienes tengan este enlace ya no podrán acceder.")) {
      return;
    }
    try {
      await api.delete(`/links-personalizados/${id}`);
      cargarLinks();
    } catch {
      alert("Error al eliminar el link");
    }
  }

  async function toggleActivo(link) {
    try {
      await api.put(`/links-personalizados/${link.id}`, {
        activo: !link.activo,
      });
      cargarLinks();
    } catch {
      alert("Error al modificar estado");
    }
  }

  function copiarAlPortapapeles(texto, idFeedback) {
    navigator.clipboard.writeText(texto).then(() => {
      setCopiadoId(idFeedback);
      setTimeout(() => setCopiadoId(null), 2500);
    });
  }

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "800px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del modal */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            color: "#ffffff",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
              <span>🔗</span> Links Personalizados para Terceros / Proveedores
            </h3>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "#94a3b8" }}>
              {empresa ? (
                <>Empresa seleccionada: <strong style={{ color: "#ffffff" }}>{empresa.nombre}</strong> (puedes incluir más si lo deseas)</>
              ) : (
                <>Gestión global: enlaces multi-empresa o individuales</>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              color: "#cbd5e1",
              fontSize: "1.2rem",
              borderRadius: "8px",
              width: "32px",
              height: "32px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        {/* Cuerpo del modal */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
          {/* Explicación amigable */}
          <div
            style={{
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: "10px",
              padding: "12px 16px",
              marginBottom: "20px",
              fontSize: "0.88rem",
              color: "#166534",
            }}
          >
            💡 <strong>Enlaces Multi-Empresa o Específicos:</strong> Puedes crear un link que agrupe a <strong>múltiples empresas</strong> (o a todas) para proveedores que le brindan servicios a varias empresas a la vez (ej: el mismo boliche o parque de diversiones). Solo verán los servicios que tú elijas. Los <strong>links comunes</strong> de cada empresa continúan operando normalmente.
          </div>

          {/* Botón para mostrar / ocultar formulario */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h4 style={{ margin: 0, fontSize: "1rem", color: "#1e293b" }}>
              Links Configurados ({links.length})
            </h4>
            <button
              onClick={() => setMostrarFormulario(!mostrarFormulario)}
              style={{
                background: mostrarFormulario ? "#f1f5f9" : "#2563eb",
                color: mostrarFormulario ? "#475569" : "#ffffff",
                border: mostrarFormulario ? "1px solid #cbd5e1" : "none",
                padding: "8px 16px",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "0.88rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {mostrarFormulario ? "✕ Cancelar" : "+ Crear Nuevo Link Personalizado"}
            </button>
          </div>

          {/* Formulario de Creación */}
          {mostrarFormulario && (
            <form
              onSubmit={crearLink}
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "18px",
                marginBottom: "24px",
              }}
            >
              <h4 style={{ margin: "0 0 14px 0", fontSize: "0.98rem", color: "#0f172a", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px" }}>
                Configuración del Nuevo Link
              </h4>

              {/* Nombre / Destinatario */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Nombre descriptivo / Destinatario: *
                </label>
                <input
                  type="text"
                  placeholder="Ej: Green Valley - Discos (Todas), Proveedor Zacarías, Barco Pirata..."
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.9rem",
                    outline: "none",
                  }}
                  required
                />
              </div>

              {/* SELECCIÓN DE EMPRESAS INCLUIDAS */}
              <div style={{ marginBottom: "16px", background: "#ffffff", padding: "12px 14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#1e293b", marginBottom: "8px" }}>
                  🏢 Empresas incluidas en este link:
                </label>
                <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "10px", fontSize: "0.85rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontWeight: 600, color: modoEmpresas === "todas" ? "#2563eb" : "#475569" }}>
                    <input
                      type="radio"
                      name="modoEmpresas"
                      checked={modoEmpresas === "todas"}
                      onChange={() => {
                        setModoEmpresas("todas");
                        setGruposEmpresa([]);
                      }}
                    />
                    🌐 Todas las empresas
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontWeight: 600, color: modoEmpresas === "multiples" ? "#2563eb" : "#475569" }}>
                    <input
                      type="radio"
                      name="modoEmpresas"
                      checked={modoEmpresas === "multiples"}
                      onChange={() => {
                        setModoEmpresas("multiples");
                        setGruposEmpresa([]);
                      }}
                    />
                    👥 Múltiples empresas específicas
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontWeight: 600, color: modoEmpresas === "unica" ? "#2563eb" : "#475569" }}>
                    <input
                      type="radio"
                      name="modoEmpresas"
                      checked={modoEmpresas === "unica"}
                      onChange={() => {
                        setModoEmpresas("unica");
                        const empId = empresasSeleccionadas[0] || empresa?.id || todasLasEmpresas[0]?.id;
                        if (empId) {
                          setEmpresasSeleccionadas([empId]);
                          cargarGruposEmpresaUnica(empId);
                        }
                      }}
                    />
                    🏢 Solo una empresa
                  </label>
                </div>

                {/* Si es modo múltiples empresas: mostrar checkboxes */}
                {modoEmpresas === "multiples" && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                        Selecciona las empresas que verá este tercero ({empresasSeleccionadas.length} seleccionada/s):
                      </span>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          type="button"
                          onClick={() => setEmpresasSeleccionadas(todasLasEmpresas.map((e) => e.id))}
                          style={{ fontSize: "0.72rem", padding: "2px 6px", borderRadius: 4, border: "1px solid #cbd5e1", background: "#f8fafc", cursor: "pointer" }}
                        >
                          Marcar todas
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmpresasSeleccionadas([])}
                          style={{ fontSize: "0.72rem", padding: "2px 6px", borderRadius: 4, border: "1px solid #cbd5e1", background: "#f8fafc", cursor: "pointer" }}
                        >
                          Limpiar
                        </button>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                        gap: "6px",
                        background: "#f8fafc",
                        padding: "8px",
                        borderRadius: "6px",
                        maxHeight: "130px",
                        overflowY: "auto",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      {todasLasEmpresas.map((emp) => {
                        const seleccionada = empresasSeleccionadas.includes(emp.id);
                        return (
                          <label
                            key={emp.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "4px 6px",
                              borderRadius: "4px",
                              background: seleccionada ? "#e0e7ff" : "transparent",
                              cursor: "pointer",
                              fontSize: "0.82rem",
                              fontWeight: seleccionada ? 600 : 400,
                              color: seleccionada ? "#3730a3" : "#334155",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={seleccionada}
                              onChange={() => toggleEmpresa(emp.id)}
                            />
                            {emp.nombre}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Si es modo única empresa: mostrar selector desplegable */}
                {modoEmpresas === "unica" && (
                  <div>
                    <select
                      value={empresasSeleccionadas[0] || ""}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setEmpresasSeleccionadas([val]);
                        cargarGruposEmpresaUnica(val);
                      }}
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.85rem",
                        background: "white",
                      }}
                    >
                      {todasLasEmpresas.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Accesos rápidos de selección de servicios */}
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Servicios permitidos para este link: *
                </label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
                  <button
                    type="button"
                    onClick={seleccionarSoloDiscos}
                    style={{
                      background: "#f3e8ff",
                      color: "#7e22ce",
                      border: "1px solid #d8b4fe",
                      borderRadius: "6px",
                      padding: "4px 10px",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    🎵 Solo Boliches / Discos
                  </button>
                  <button
                    type="button"
                    onClick={seleccionarSoloParques}
                    style={{
                      background: "#ecfdf5",
                      color: "#047857",
                      border: "1px solid #a7f3d0",
                      borderRadius: "6px",
                      padding: "4px 10px",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    🌴 Parques y Excursiones
                  </button>
                  <button
                    type="button"
                    onClick={seleccionarTodosServicios}
                    style={{
                      background: "#f1f5f9",
                      color: "#334155",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      padding: "4px 10px",
                      fontSize: "0.78rem",
                      cursor: "pointer",
                    }}
                  >
                    Marcar Todos
                  </button>
                  <button
                    type="button"
                    onClick={desmarcarTodosServicios}
                    style={{
                      background: "#f1f5f9",
                      color: "#334155",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      padding: "4px 10px",
                      fontSize: "0.78rem",
                      cursor: "pointer",
                    }}
                  >
                    Desmarcar
                  </button>
                </div>

                {/* Grid de Servicios */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                    gap: "8px",
                    background: "#ffffff",
                    padding: "12px",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    maxHeight: "180px",
                    overflowY: "auto",
                  }}
                >
                  {SERVICIOS_DISPONIBLES.map((serv) => {
                    const seleccionado = serviciosSeleccionados.includes(serv.id);
                    return (
                      <label
                        key={serv.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "6px 8px",
                          borderRadius: "6px",
                          background: seleccionado ? "#eff6ff" : "transparent",
                          border: seleccionado ? "1px solid #bfdbfe" : "1px solid transparent",
                          cursor: "pointer",
                          fontSize: "0.85rem",
                          userSelect: "none",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={seleccionado}
                          onChange={() => toggleServicio(serv.id)}
                          style={{ cursor: "pointer" }}
                        />
                        <span>{serv.emoji}</span>
                        <span style={{ fontWeight: seleccionado ? 600 : 400, color: seleccionado ? "#1d4ed8" : "#334155" }}>
                          {serv.nombre}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Filtro opcional de grupos (solo si es modo única empresa) */}
              {modoEmpresas === "unica" && gruposEmpresa.length > 0 && (
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                    Grupos visibles:
                  </label>
                  <div style={{ display: "flex", gap: "16px", marginBottom: "8px", fontSize: "0.85rem" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                      <input
                        type="radio"
                        checked={todosLosGrupos}
                        onChange={() => setTodosLosGrupos(true)}
                      />
                      Todos los grupos ({gruposEmpresa.length})
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                      <input
                        type="radio"
                        checked={!todosLosGrupos}
                        onChange={() => setTodosLosGrupos(false)}
                      />
                      Elegir grupos específicos
                    </label>
                  </div>

                  {!todosLosGrupos && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        background: "#ffffff",
                        padding: "10px",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        maxHeight: "120px",
                        overflowY: "auto",
                      }}
                    >
                      {gruposEmpresa.map((g) => (
                        <label
                          key={g.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            fontSize: "0.85rem",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={gruposSeleccionados.includes(g.id)}
                            onChange={() => toggleGrupo(g.id)}
                          />
                          <span>
                            <strong>{g.nombre}</strong> ({g.cantidad_estudiantes + g.cantidad_padres + g.cantidad_guias || 0} PAX)
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Permitir acceso a Vouchers */}
              <div style={{ marginBottom: "18px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                    fontSize: "0.88rem",
                    color: "#334155",
                    background: "#ffffff",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={incluirVouchers}
                    onChange={(e) => setIncluirVouchers(e.target.checked)}
                  />
                  <span>
                    🎫 <strong>Habilitar acceso a Vouchers</strong> (permitirá abrir los vouchers de los servicios seleccionados)
                  </span>
                </label>
              </div>

              {/* Botones de envío */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setMostrarFormulario(false)}
                  style={{
                    background: "#e2e8f0",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "8px",
                    fontSize: "0.88rem",
                    fontWeight: 600,
                    color: "#475569",
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  style={{
                    background: guardando ? "#93c5fd" : "#2563eb",
                    border: "none",
                    padding: "8px 20px",
                    borderRadius: "8px",
                    fontSize: "0.88rem",
                    fontWeight: 600,
                    color: "#ffffff",
                    cursor: guardando ? "not-allowed" : "pointer",
                  }}
                >
                  {guardando ? "Generando link..." : "✓ Guardar y Generar Link"}
                </button>
              </div>
            </form>
          )}

          {/* Lista de links creados */}
          {loading ? (
            <p style={{ color: "#64748b", fontSize: "0.9rem" }}>Cargando links...</p>
          ) : error ? (
            <p style={{ color: "#ef4444", fontSize: "0.9rem" }}>{error}</p>
          ) : links.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "30px 20px",
                background: "#f8fafc",
                borderRadius: "12px",
                border: "1px dashed #cbd5e1",
                color: "#64748b",
              }}
            >
              <p style={{ margin: 0, fontSize: "0.95rem" }}>
                Aún no has creado links personalizados{empresa ? ` para ${empresa.nombre}` : ""}.
              </p>
              <button
                onClick={() => setMostrarFormulario(true)}
                style={{
                  marginTop: "12px",
                  background: "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  padding: "6px 16px",
                  borderRadius: "6px",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                + Crear el primero
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {links.map((link) => {
                const urlPortal = `${window.location.origin}/portal/${link.token}`;
                const urlVouchers = `${window.location.origin}/vouchers/${link.token}`;

                return (
                  <div
                    key={link.id}
                    style={{
                      background: link.activo ? "#ffffff" : "#f1f5f9",
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      padding: "16px",
                      opacity: link.activo ? 1 : 0.7,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "1.05rem", fontWeight: 700, color: "#1e293b" }}>
                            {link.nombre}
                          </span>

                          {/* Badge de Empresa(s) */}
                          {link.todas_las_empresas ? (
                            <span style={{ background: "#f3e8ff", color: "#7e22ce", border: "1px solid #d8b4fe", fontSize: "0.72rem", padding: "2px 8px", borderRadius: "999px", fontWeight: 700 }}>
                              🌐 Todas las empresas
                            </span>
                          ) : link.empresas_nombres && link.empresas_nombres.length > 1 ? (
                            <span style={{ background: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd", fontSize: "0.72rem", padding: "2px 8px", borderRadius: "999px", fontWeight: 700 }} title={link.empresas_nombres.join(", ")}>
                              👥 {link.empresas_nombres.length} Empresas ({link.empresas_nombres.join(", ")})
                            </span>
                          ) : (
                            <span style={{ background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1", fontSize: "0.72rem", padding: "2px 8px", borderRadius: "999px", fontWeight: 600 }}>
                              🏢 {link.empresa_nombre || "Empresa"}
                            </span>
                          )}

                          {!link.activo && (
                            <span style={{ background: "#fecaca", color: "#b91c1c", fontSize: "0.72rem", padding: "2px 8px", borderRadius: "999px", fontWeight: 700 }}>
                              Desactivado
                            </span>
                          )}
                          {link.incluir_vouchers && (
                            <span style={{ background: "#dbeafe", color: "#1d4ed8", fontSize: "0.72rem", padding: "2px 8px", borderRadius: "999px", fontWeight: 700 }}>
                              🎫 Con Vouchers
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "4px" }}>
                          Código: <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px" }}>{link.token}</code>
                        </div>
                      </div>

                      {/* Botones de acción */}
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          type="button"
                          onClick={() => toggleActivo(link)}
                          title={link.activo ? "Desactivar link" : "Activar link"}
                          style={{
                            background: "transparent",
                            border: "1px solid #cbd5e1",
                            borderRadius: "6px",
                            padding: "4px 8px",
                            fontSize: "0.75rem",
                            cursor: "pointer",
                            color: link.activo ? "#475569" : "#16a34a",
                          }}
                        >
                          {link.activo ? "Pausar" : "Reactivar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => eliminarLink(link.id)}
                          title="Eliminar link"
                          style={{
                            background: "#fee2e2",
                            border: "1px solid #fca5a5",
                            color: "#b91c1c",
                            borderRadius: "6px",
                            padding: "4px 8px",
                            fontSize: "0.75rem",
                            cursor: "pointer",
                          }}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>

                    {/* Badges de servicios permitidos */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
                      <span style={{ fontSize: "0.78rem", color: "#64748b", alignSelf: "center", marginRight: "4px" }}>
                        Servicios visibles:
                      </span>
                      {link.servicios_permitidos.map((sId) => {
                        const meta = SERVICIOS_DISPONIBLES.find((item) => item.id === sId);
                        return (
                          <span
                            key={sId}
                            style={{
                              background: meta?.color ? meta.color + "18" : "#f1f5f9",
                              color: meta?.color || "#334155",
                              border: `1px solid ${meta?.color ? meta.color + "35" : "#cbd5e1"}`,
                              borderRadius: "999px",
                              padding: "2px 8px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                            }}
                          >
                            {meta?.emoji} {meta?.nombre || sId}
                          </span>
                        );
                      })}
                    </div>

                    {/* Links y botones de copia */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", background: "#f8fafc", padding: "10px", borderRadius: "8px" }}>
                      {/* Link Portal */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                        <div style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#166534", marginRight: "6px" }}>
                            📅 PORTAL:
                          </span>
                          <a
                            href={urlPortal}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontSize: "0.82rem", color: "#2563eb", textDecoration: "none" }}
                          >
                            {urlPortal}
                          </a>
                        </div>
                        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => copiarAlPortapapeles(urlPortal, `portal-${link.id}`)}
                            style={{
                              background: copiadoId === `portal-${link.id}` ? "#16a34a" : "#2563eb",
                              color: "#ffffff",
                              border: "none",
                              padding: "4px 10px",
                              borderRadius: "6px",
                              fontSize: "0.78rem",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            {copiadoId === `portal-${link.id}` ? "✓ Copiado" : "Copiar"}
                          </button>
                          <a
                            href={urlPortal}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              background: "#e2e8f0",
                              color: "#334155",
                              border: "none",
                              padding: "4px 8px",
                              borderRadius: "6px",
                              fontSize: "0.78rem",
                              textDecoration: "none",
                              display: "inline-flex",
                              alignItems: "center",
                            }}
                          >
                            ↗ Abrir
                          </a>
                        </div>
                      </div>

                      {/* Link Vouchers (si habilitado) */}
                      {link.incluir_vouchers && (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", borderTop: "1px dashed #e2e8f0", paddingTop: "6px" }}>
                          <div style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#0369a1", marginRight: "6px" }}>
                              🎫 VOUCHERS:
                            </span>
                            <a
                              href={urlVouchers}
                              target="_blank"
                              rel="noreferrer"
                              style={{ fontSize: "0.82rem", color: "#0284c7", textDecoration: "none" }}
                            >
                              {urlVouchers}
                            </a>
                          </div>
                          <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => copiarAlPortapapeles(urlVouchers, `vouchers-${link.id}`)}
                              style={{
                                background: copiadoId === `vouchers-${link.id}` ? "#16a34a" : "#0284c7",
                                color: "#ffffff",
                                border: "none",
                                padding: "4px 10px",
                                borderRadius: "6px",
                                fontSize: "0.78rem",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              {copiadoId === `vouchers-${link.id}` ? "✓ Copiado" : "Copiar"}
                            </button>
                            <a
                              href={urlVouchers}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                background: "#e2e8f0",
                                color: "#334155",
                                border: "none",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                fontSize: "0.78rem",
                                textDecoration: "none",
                                display: "inline-flex",
                                alignItems: "center",
                              }}
                            >
                              ↗ Abrir
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pie del modal */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "flex-end",
            background: "#f8fafc",
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: "#1e293b",
              color: "#ffffff",
              border: "none",
              padding: "8px 20px",
              borderRadius: "8px",
              fontSize: "0.88rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
