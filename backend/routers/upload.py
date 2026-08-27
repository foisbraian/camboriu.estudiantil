from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
import pandas as pd
import io
import math

router = APIRouter(prefix="/grupos/empresa", tags=["Upload Grupos"])

@router.post("/{empresa_id}/upload")
async def upload_grupos(empresa_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.xlsx'):
        raise HTTPException(status_code=400, detail="Debe ser un archivo Excel (.xlsx)")
    
    contents = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al leer Excel: {e}")
    
    # expected columns (we normalize them to lower and remove spaces)
    df.columns = [str(c).strip().lower() for c in df.columns]
    
    created_count = 0
    for _, row in df.iterrows():
        nombre = str(row.get('nombre', '')).strip()
        if not nombre or nombre == 'nan':
            continue
            
        def get_int(col):
            val = row.get(col, 0)
            try:
                val = float(val)
                if math.isnan(val): return 0
                return int(val)
            except:
                return 0
        
        def get_bool(col):
            val = row.get(col, False)
            if pd.isna(val): return False
            if isinstance(val, str):
                return val.strip().lower() in ['si', 'sí', 'true', '1', 'x', 'yes', 's']
            return bool(val)
        
        def get_date(col):
            val = row.get(col, None)
            if pd.notna(val):
                try:
                    return pd.to_datetime(val).date()
                except:
                    return None
            return None

        pax = get_int('pax')
        
        g = models.Grupo(
            nombre=nombre,
            empresa_id=empresa_id,
            cantidad_estudiantes=pax,
            fecha_entrada=get_date('in') or get_date('fecha entrada'),
            fecha_salida=get_date('out') or get_date('fecha salida'),
            discos_compradas=get_int('discos'),
            campamento_acceso=get_bool('campamento acceso') or get_bool('campamento'),
            campamento_con_comida=get_bool('campamento con comida'),
            zacarias_acceso=get_bool('zacarias acceso') or get_bool('zacarias'),
            zacarias_con_comida=get_bool('zacarias con comida'),
            pool_acceso=get_bool('pool acceso') or get_bool('pool'),
            pool_con_comida=get_bool('pool con comida'),
            permite_alcohol=get_bool('permite alcohol') or get_bool('con alcohol'),
            es_mix_grupo=get_bool('mix'),
            parque_acceso=get_bool('parque acceso') or get_bool('parque'),
            parque_con_comida=get_bool('parque con comida'),
            surf_acceso=get_bool('surf'),
            unipraias_acceso=get_bool('unipraias'),
            beto_acceso=get_bool('beto'),
            barco_acceso=get_bool('barco'),
            cristo_acceso=get_bool('cristo'),
            sunset_acceso=get_bool('sunset'),
            quinta_comida_acceso=get_bool('quinta comida'),
            multiparque_acceso=get_bool('multiparque')
        )
        db.add(g)
        created_count += 1
        
    db.commit()
    return {"ok": True, "created": created_count}
