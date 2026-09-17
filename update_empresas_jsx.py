import re

with open('frontend/src/pages/Empresas.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add states
content = content.replace(
    'const [error, setError] = useState("");',
    'const [error, setError] = useState("");\n  const [anioInformado, setAnioInformado] = useState(new Date().getFullYear().toString());'
)

# Add toggle function
toggle_func = """
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
"""
content = content.replace(
    'async function crear(e) {',
    toggle_func + '\n  async function crear(e) {'
)

# Add download excel and year selector
header_ui = """
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
"""

content = re.sub(
    r'<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>.*?</a>\s*</div>',
    header_ui,
    content,
    flags=re.DOTALL
)

# Add checkbox in list
checkbox_ui = """
              <label style={{ display: "flex", alignItems: "center", gap: "4px", marginRight: "10px", fontSize: "0.9rem", cursor: "pointer" }} onClick={(ev) => ev.stopPropagation()}>
                <input 
                  type="checkbox" 
                  checked={e.anios_informados ? e.anios_informados.split(",").includes(anioInformado) : false}
                  onChange={() => toggleInformado(e, anioInformado)}
                />
                Informado {anioInformado}
              </label>
              <span style={{
"""
content = content.replace(
    '<span style={{',
    checkbox_ui
)

with open('frontend/src/pages/Empresas.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
