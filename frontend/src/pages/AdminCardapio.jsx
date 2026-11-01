import React, { useEffect, useState, useCallback } from "react";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

function getAdminToken() {
  // Reutiliza la password guardada en localStorage o pide una nueva
  return localStorage.getItem("cardapio_admin_token") || "";
}

const SECCIONES_ALCOHOL = ["COMBOS", "TRAGOS Y MEDIDAS", "DIVERSOS", "ESPECIAL"];
const SECCIONES_SIN_ALCOHOL = ["DIVERSOS", "ESPECIAL"];

export default function AdminCardapio() {
  const [tab, setTab] = useState("alcohol");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adminToken, setAdminToken] = useState(getAdminToken);
  const [tokenInput, setTokenInput] = useState("");
  const [tokenOk, setTokenOk] = useState(!!getAdminToken());
  const [saving, setSaving] = useState({});
  const [editValues, setEditValues] = useState({});
  const [seedStatus, setSeedStatus] = useState("");
  const [newItem, setNewItem] = useState({ seccion: "", nombre: "", descripcion: "", precio: "", orden: 0 });
  const [adding, setAdding] = useState(false);

  const fetchItems = useCallback(() => {
    setLoading(true);
    fetch(`${API}/cardapio/${tab}`)
      .then((r) => r.json())
      .then((data) => {
        setItems(data);
        // Inicializa editValues con los precios actuales
        const vals = {};
        data.forEach((it) => { vals[it.id] = it.precio; });
        setEditValues(vals);
      })
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => { if (tokenOk) fetchItems(); }, [tab, tokenOk, fetchItems]);

  function handleSaveToken() {
    localStorage.setItem("cardapio_admin_token", tokenInput);
    setAdminToken(tokenInput);
    setTokenOk(true);
  }

  async function handleSave(itemId) {
    setSaving((p) => ({ ...p, [itemId]: true }));
    const payload = { precio: parseFloat(editValues[itemId]) };
    const r = await fetch(`${API}/cardapio/${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
      body: JSON.stringify(payload),
    });
    if (r.ok) {
      fetchItems();
    } else {
      alert("Error al guardar. ¿Token correcto?");
    }
    setSaving((p) => ({ ...p, [itemId]: false }));
  }

  async function handleDelete(itemId) {
    if (!window.confirm("¿Eliminar este item?")) return;
    await fetch(`${API}/cardapio/${itemId}`, {
      method: "DELETE",
      headers: { "x-admin-token": adminToken },
    });
    fetchItems();
  }

  async function handleSeed() {
    setSeedStatus("Ejecutando...");
    const r = await fetch(`${API}/cardapio/seed`, {
      method: "GET",
      headers: { "x-admin-token": adminToken },
    });
    const data = await r.json();
    setSeedStatus(data.message || "Hecho");
    fetchItems();
  }

  async function handleAddItem() {
    if (!newItem.seccion || !newItem.nombre || !newItem.precio) {
      alert("Completa sección, nombre y precio");
      return;
    }
    setAdding(true);
    const payload = {
      tipo: tab,
      seccion: newItem.seccion,
      nombre: newItem.nombre,
      descripcion: newItem.descripcion || null,
      precio: parseFloat(newItem.precio),
      orden: parseInt(newItem.orden) || 0,
      activo: true,
    };
    const r = await fetch(`${API}/cardapio/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
      body: JSON.stringify(payload),
    });
    if (r.ok) {
      setNewItem({ seccion: "", nombre: "", descripcion: "", precio: "", orden: 0 });
      fetchItems();
    } else {
      alert("Error al agregar item");
    }
    setAdding(false);
  }

  if (!tokenOk) {
    return (
      <div style={{ maxWidth: 400, margin: "80px auto", padding: 24, background: "#f5f5f5", borderRadius: 12 }}>
        <h2 style={{ marginBottom: 16, color: "#005740" }}>🔐 Admin Cardapio</h2>
        <p style={{ color: "#666", marginBottom: 12 }}>Ingresa tu contraseña de admin para editar los precios:</p>
        <input
          type="password"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSaveToken()}
          placeholder="Contraseña admin"
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #ccc", fontSize: 15, boxSizing: "border-box" }}
        />
        <button
          onClick={handleSaveToken}
          style={{ marginTop: 12, width: "100%", padding: "10px 0", background: "#005740", color: "#FFDE5B", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: "pointer" }}
        >
          Ingresar
        </button>
      </div>
    );
  }

  const secciones = tab === "alcohol" ? SECCIONES_ALCOHOL : SECCIONES_SIN_ALCOHOL;

  return (
    <div style={{ padding: "24px 16px", maxWidth: 700, margin: "0 auto" }}>
      <h2 style={{ color: "#005740", marginBottom: 4 }}>🍹 Admin Cardapio</h2>
      <p style={{ color: "#666", marginBottom: 16, fontSize: 13 }}>
        Editá los precios del menú digital. Los cambios se reflejan inmediatamente en los links públicos.
      </p>

      {/* Links públicos */}
      <div style={{ background: "#eafaf1", border: "1px solid #4BB61E", borderRadius: 10, padding: 14, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, color: "#005740", marginBottom: 8 }}>🔗 Links públicos del menú:</div>
        <div style={{ fontSize: 13, color: "#333", marginBottom: 4 }}>
          <b>Con alcohol:</b>{" "}
          <a href="/cardapio" target="_blank" rel="noreferrer" style={{ color: "#005740" }}>
            {window.location.origin}/cardapio
          </a>
        </div>
        <div style={{ fontSize: 13, color: "#333" }}>
          <b>Sin alcohol:</b>{" "}
          <a href="/cardapio-sin-alcohol" target="_blank" rel="noreferrer" style={{ color: "#c45c00" }}>
            {window.location.origin}/cardapio-sin-alcohol
          </a>
        </div>
      </div>

      {/* Seed */}
      <div style={{ background: "#fff9e6", border: "1px solid #FFDE5B", borderRadius: 10, padding: 12, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>🌱 Carga inicial de datos</div>
        <p style={{ fontSize: 12, color: "#666", margin: "0 0 8px" }}>
          Si la base de datos está vacía, carga todos los items del cardapio físico:
        </p>
        <button
          onClick={handleSeed}
          style={{ background: "#FFDE5B", border: "none", padding: "8px 20px", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
        >
          Cargar datos iniciales
        </button>
        {seedStatus && <span style={{ marginLeft: 12, fontSize: 13, color: "#005740" }}>{seedStatus}</span>}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["alcohol", "sin_alcohol"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 20px",
              borderRadius: 20,
              border: "none",
              fontWeight: 700,
              cursor: "pointer",
              background: tab === t ? "#005740" : "#eee",
              color: tab === t ? "#FFDE5B" : "#333",
              fontSize: 13,
            }}
          >
            {t === "alcohol" ? "🍹 Con Alcohol" : "🥤 Sin Alcohol"}
          </button>
        ))}
      </div>

      {loading && <div style={{ color: "#005740", padding: 20 }}>Cargando...</div>}

      {/* Items agrupados por sección */}
      {secciones.map((sec) => {
        const secItems = items.filter((i) => i.seccion === sec);
        if (secItems.length === 0) return null;
        return (
          <div key={sec} style={{ marginBottom: 24 }}>
            <div style={{
              background: "#005740", color: "#FFDE5B",
              padding: "8px 14px", borderRadius: 8, fontWeight: 800,
              fontSize: 13, letterSpacing: 2, marginBottom: 10,
            }}>
              {sec}
            </div>
            {secItems.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  background: "#f9f9f9", borderRadius: 8, padding: "10px 12px",
                  marginBottom: 6, border: "1px solid #eee",
                }}
              >
                <div style={{ flex: 1, fontSize: 13, color: "#222" }}>
                  <div style={{ fontWeight: 600 }}>{item.nombre}</div>
                  {item.descripcion && <div style={{ fontSize: 11, color: "#888" }}>{item.descripcion}</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#555" }}>R$</span>
                  <input
                    type="number"
                    value={editValues[item.id] ?? item.precio}
                    onChange={(e) => setEditValues((p) => ({ ...p, [item.id]: e.target.value }))}
                    style={{
                      width: 70, padding: "6px 8px", borderRadius: 6,
                      border: "1px solid #ccc", fontSize: 14, fontWeight: 700,
                      textAlign: "right",
                    }}
                  />
                  <button
                    onClick={() => handleSave(item.id)}
                    disabled={saving[item.id]}
                    style={{
                      background: "#005740", color: "#FFDE5B",
                      border: "none", borderRadius: 6, padding: "6px 12px",
                      fontWeight: 700, fontSize: 12, cursor: "pointer",
                    }}
                  >
                    {saving[item.id] ? "..." : "Guardar"}
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    style={{
                      background: "#ff4444", color: "#fff",
                      border: "none", borderRadius: 6, padding: "6px 10px",
                      fontWeight: 700, fontSize: 12, cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {/* Agregar nuevo item */}
      <div style={{ background: "#f0f9ff", border: "1px solid #4BB61E", borderRadius: 10, padding: 16, marginTop: 24 }}>
        <div style={{ fontWeight: 700, color: "#005740", marginBottom: 12 }}>➕ Agregar nuevo item</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <select
            value={newItem.seccion}
            onChange={(e) => setNewItem((p) => ({ ...p, seccion: e.target.value }))}
            style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13 }}
          >
            <option value="">— Sección —</option>
            {secciones.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input
            placeholder="Nombre del item"
            value={newItem.nombre}
            onChange={(e) => setNewItem((p) => ({ ...p, nombre: e.target.value }))}
            style={{ flex: 1, minWidth: 160, padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13 }}
          />
          <input
            placeholder="Descripción (opcional)"
            value={newItem.descripcion}
            onChange={(e) => setNewItem((p) => ({ ...p, descripcion: e.target.value }))}
            style={{ flex: 1, minWidth: 120, padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13 }}
          />
          <input
            type="number"
            placeholder="Precio R$"
            value={newItem.precio}
            onChange={(e) => setNewItem((p) => ({ ...p, precio: e.target.value }))}
            style={{ width: 90, padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13 }}
          />
          <button
            onClick={handleAddItem}
            disabled={adding}
            style={{
              background: "#4BB61E", color: "#fff",
              border: "none", borderRadius: 6, padding: "8px 16px",
              fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}
          >
            {adding ? "..." : "Agregar"}
          </button>
        </div>
      </div>

      {/* Logout token */}
      <div style={{ marginTop: 30, textAlign: "right" }}>
        <button
          onClick={() => { localStorage.removeItem("cardapio_admin_token"); setTokenOk(false); setAdminToken(""); }}
          style={{ background: "none", border: "none", color: "#999", fontSize: 12, cursor: "pointer" }}
        >
          Cerrar sesión admin cardapio
        </button>
      </div>
    </div>
  );
}
