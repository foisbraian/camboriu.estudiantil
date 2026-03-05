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
import VouchersPlanilla from "./pages/VouchersPlanilla";
import Hoteleria from "./pages/Hoteleria";

const hasStoredRole = (role) => {
  const storedRole = localStorage.getItem("auth_role");
  if (storedRole) {
    return storedRole === role;
  }

  if (role === "admin") {
    return localStorage.getItem("admin_auth") === "true";
  }
  if (role === "validator") {
    return localStorage.getItem("validator_auth") === "true";
  }
  if (role === "calendar") {
    return localStorage.getItem("calendar_auth") === "true";
  }
  return false;
};

function Protected({ children, allow = ["admin"] }) {
  const canAccess = allow.some((role) => hasStoredRole(role));
  if (!canAccess) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Home/Root redirect logic */}
        <Route
          path="/"
          element={
            <Protected allow={["admin", "calendar"]}>
              <Navigate to={hasStoredRole("admin") ? "/inicio" : "/calendario"} replace />
            </Protected>
          }
        />

        {/* Pantalla de Selección post-login */}
        <Route path="/inicio" element={<Protected><SelectorInicio /></Protected>} />

        {/* Ruta abierta solo para validadores o admins */}
        <Route
          path="/validar"
          element={
            <Protected allow={["admin", "validator"]}>
              <ValidarQR />
            </Protected>
          }
        />

        {/* Calendario compartido entre admin y rol solo lectura */}
        <Route element={<Protected allow={["admin", "calendar"]}><Layout /></Protected>}>
          <Route path="/calendario" element={<AdminCalendar />} />
        </Route>

        {/* Resto de rutas solo para admin */}
        <Route element={<Protected allow={["admin"]}><Layout /></Protected>}>
          <Route path="/empresas" element={<Empresas />} />
          <Route path="/empresas/:id" element={<EmpresaDetalle />} />
          <Route path="/eventos" element={<Eventos />} />
          <Route path="/tematicas" element={<Tematicas />} />
          <Route path="/finanzas" element={<FinanzasDashboard />} />
          <Route path="/finanzas/:id" element={<FinanzasDetalle />} />
          <Route path="/panel/validar" element={<ValidarQR />} />
          <Route path="/imprimir-voucher/:id" element={<ImprimirVoucher />} />
          <Route path="/imprimir-vouchers-grupo/:grupoId" element={<ImprimirTodosVouchers />} />
          <Route path="/proveedores" element={<Proveedores />} />
          <Route path="/proveedores/:id" element={<ProveedorDetalle />} />
          <Route path="/vouchers/planilla" element={<VouchersPlanilla />} />
          <Route path="/hoteleria" element={<Hoteleria />} />
        </Route>

        {/* Rutas Públicas */}
        <Route path="/portal/:codigo" element={<PortalEmpresa />} />

        {/* Catch-all to root */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
