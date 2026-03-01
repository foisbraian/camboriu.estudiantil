import React, { useEffect } from "react";
import { useParams } from "react-router-dom";
import { BASE_URL } from "../api";

export default function ImprimirVoucher() {
    const { id } = useParams();
    const imageUrl = `${BASE_URL}/vouchers/generate/${id}`;

    useEffect(() => {
        // Pequeño delay para asegurar que la imagen cargue antes de imprimir
        const timer = setTimeout(() => {
            window.print();
        }, 1000);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            background: "white"
        }}>
            <div className="no-print" style={{ marginBottom: 20 }}>
                <button
                    onClick={() => window.close()}
                    style={{ padding: "10px 20px", cursor: "pointer", borderRadius: 8, border: "1px solid #ccc" }}
                >
                    Cerrar / Volver
                </button>
            </div>

            <img
                src={imageUrl}
                alt="Voucher"
                style={{ maxWidth: "100%", height: "auto", display: "block" }}
            />

            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    body { margin: 0; padding: 0; }
                    img { width: 100%; height: auto; }
                }
            `}</style>
        </div>
    );
}
