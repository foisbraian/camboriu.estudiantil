import re

with open('frontend/src/pages/Empresas.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix double label injection issue
# Find the exact block we want to fix
bad_block = """{e.numero_contacto && 
              <label style={{ display: "flex", alignItems: "center", gap: "4px", marginRight: "10px", fontSize: "0.9rem", cursor: "pointer" }} onClick={(ev) => ev.stopPropagation()}>
                <input 
                  type="checkbox" 
                  checked={e.anios_informados ? e.anios_informados.split(",").includes(anioInformado) : false}
                  onChange={() => toggleInformado(e, anioInformado)}
                />
                Informado {anioInformado}
              </label>
              <span style={{
 marginLeft: 10, color: "#666", fontSize: "0.9rem" }}>📞 {e.numero_contacto}</span>}"""

content = content.replace(bad_block, '{e.numero_contacto && <span style={{ marginLeft: 10, color: "#666", fontSize: "0.9rem" }}>📞 {e.numero_contacto}</span>}')

with open('frontend/src/pages/Empresas.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
