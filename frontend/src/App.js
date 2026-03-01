import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Layout from "./components/Layout";
import Empresas from "./pages/Empresas";
import Eventos from "./pages/Eventos";
import Tematicas from "./pages/Tematicas";
import AdminCalendar from "./pages/AdminCalendar";
import EmpresaDetalle from "./pages/EmpresaDetalle";
import PortalEmpresa from "./pages/PortalEmpresa";
import Login from "./pages/Login";
import SelectorInicio from "./pages/SelectorInicio";
import FinanzasDashboard from "./pages/FinanzasDashboard";
import FinanzasDetalle from "./pages/FinanzasDetalle";
import ValidarQR from "./pages/ValidarQR";
import ImprimirVoucher from "./pages/ImprimirVoucher";
import ImprimirTodosVouchers from "./pages/ImprimirTodosVouchers";
import Proveedores from "./pages/Proveedores";
import ProveedorDetalle from "./pages/ProveedorDetalle";

function Protected({ children }) {
  const isAuth = localStorage.getItem("admin_auth") === "true";
  if (!isAuth) return <Navigate to="/login" />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Pantalla de Selección post-login */}
        <Route path="/inicio" element={<Protected><SelectorInicio /></Protected>} />

        {/* Rutas Protegidas bajo Layout */}
        <Route element={<Protected><Layout /></Protected>}>
          <Route path="/" element={<AdminCalendar />} />
          <Route path="/empresas" element={<Empresas />} />
          <Route path="/empresas/:id" element={<EmpresaDetalle />} />
          <Route path="/eventos" element={<Eventos />} />
          <Route path="/tematicas" element={<Tematicas />} />
          <Route path="/finanzas" element={<FinanzasDashboard />} />
          <Route path="/finanzas/:id" element={<FinanzasDetalle />} />
          <Route path="/validar" element={<ValidarQR />} />
          <Route path="/imprimir-voucher/:id" element={<ImprimirVoucher />} />
          <Route path="/imprimir-vouchers-grupo/:grupoId" element={<ImprimirTodosVouchers />} />
          <Route path="/proveedores" element={<Proveedores />} />
          <Route path="/proveedores/:id" element={<ProveedorDetalle />} />
        </Route>

        {/* Rutas Públicas */}
        <Route path="/portal/:codigo" element={<PortalEmpresa />} />
      </Routes>
    </BrowserRouter>
  );
}
