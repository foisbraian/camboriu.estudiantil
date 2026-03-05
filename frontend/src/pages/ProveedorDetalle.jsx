import { useParams, useNavigate } from "react-router-dom";
import PlanillaProveedor from "../components/PlanillaProveedor";

export default function ProveedorDetalle() {
    const { id } = useParams();
    const navigate = useNavigate();

    return (
        <PlanillaProveedor
            proveedorId={id}
            onBack={() => navigate("/proveedores")}
        />
    );
}
