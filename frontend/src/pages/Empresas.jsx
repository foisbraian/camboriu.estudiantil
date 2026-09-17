import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { BASE_URL } from "../api";

export default function Empresas() {
  const [empresas, setEmpresas] = useState([]);
  const [nombre, setNombre] = useState("");
  const [numeroContacto, setNumeroContacto] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState("");
  const [anioInformado, setAnioInformado] = useState(new Date().getFullYear().toString());

  const navigate = useNavigate();

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    const res = await api.get("/empresas");
    setEmpresas(res.data);
  }

  // =========================
  // crear empresa
  // =========================
  
  async function toggleInformado(empresa, anio) {
    let anios = empresa.anios_informados ? empresa.anios_informados.split(",") : [];
    if (anios.includes(anio)) {
      anios = anios.filter(a => a !== anio);
    } else {
      anios.push(anio);
    }
    const nuevoAnios = anios.filter(Boolean).join(",");
    
    try {
      await api.put(`/empresas/${empresa.id}`, {
        nombre: empresa.nombre,
        numero_contacto: empresa.numero_contacto,
        anios_informados: nuevoAnios
      });
      cargar();
    } catch (err) {
      alert("Error al actualizar");
    }
  }

  async function crear(e) {
    e.preventDefault();
    setError("");

    if (!nombre.trim()) return;

    try {
      await api.post("/empresas", { nombre, numero_contacto: numeroContacto });
      setNombre("");
      setNumeroContacto("");
      cargar();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al crear empresa");
    }
  }

  // =========================
  // filtro búsqueda local
  // =========================
  const filtradas = empresas.filter((e) =>
    e.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div style={{ padding: "40px 20px", maxWidth: "800px" }}>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Empresas</h2>
        <div style={{display: "flex", gap: "10px", alignItems: "center"}}>
          <input 
            type="number" 
            value={anioInformado} 
            onChange={(e) => setAnioInformado(e.target.value)} 
            style={{ width: "80px", padding: "4px" }}
            title="Año para gestionar informados"
          />
          <a href={`${BASE_URL}/excel/empresas-informadas?anio=${anioInformado}`} target="_blank" rel="noreferrer">
            <button style={{ background: "blue", color: "white" }}>Excel Informadas {anioInformado}</button>
          </a>
          <a href={`${BASE_URL}/excel/exportar`} target="_blank" rel="noreferrer">
            <button style={{ background: "green", color: "white" }}>Descargar Excel</button>
          </a>
        </div>
      </div>


      {/* ================= FORM CREAR ================= */}
      <form onSubmit={crear} style={{ marginBottom: 20, display: "flex", gap: 10 }}>
        <input
          placeholder="Nombre empresa"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          style={{ flex: 1 }}
        />
        <input
          placeholder="Número de contacto (opcional)"
          value={numeroContacto}
          onChange={(e) => setNumeroContacto(e.target.value)}
          style={{ flex: 1 }}
        />
        <button>Crear</button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {/* ================= BUSCADOR ================= */}
      <input
        placeholder="🔍 Buscar empresa..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={{
          width: "100%",
          marginBottom: 15,
          padding: 6
        }}
      />

      {/* ================= LISTA ================= */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtradas.map((e) => (
          <div
            key={e.id}
            onClick={() => navigate(`/empresas/${e.id}`)}
            style={{
              padding: 10,
              border: "1px solid #ddd",
              borderRadius: 6,
              background: "#fafafa",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}
          >
            <div
              onClick={() => navigate(`/empresas/${e.id}`)}
              style={{ cursor: "pointer", flex: 1 }}
            >
              <b>{e.nombre}</b>
              {e.numero_contacto && <span style={{ marginLeft: 10, color: "#666", fontSize: "0.9rem" }}>📞 {e.numero_contacto}</span>}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              
              <label style={{ display: "flex", alignItems: "center", gap: "4px", marginRight: "10px", fontSize: "0.9rem", cursor: "pointer" }} onClick={(ev) => ev.stopPropagation()}>
                <input 
                  type="checkbox" 
                  checked={e.anios_informados ? e.anios_informados.split(",").includes(anioInformado) : false}
                  onChange={() => toggleInformado(e, anioInformado)}
                />
                Informado {anioInformado}
              </label>
              <span style={{

                fontFamily: "monospace",
                background: "#eee",
                padding: "2px 6px",
                borderRadius: 4,
                fontSize: "0.9rem"
              }}>
                {e.codigo_acceso}
              </span>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  const link = `https://camboriu-estudiantil-front.vercel.app/portal/${e.codigo_acceso}`;
                  navigator.clipboard.writeText(link);
                  alert(`Link copiado: ${link}`);
                }}
                style={{ padding: "4px 8px", fontSize: "0.8rem", background: "#f0f0f0", border: "1px solid #ccc" }}
              >
                Copiar link
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtradas.length === 0 && <p>No hay empresas</p>}
    </div>
  );
}
