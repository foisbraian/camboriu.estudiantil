code = """
@router.get("/empresas-informadas")
def exportar_empresas_informadas(anio: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    wb = Workbook()
    ws = wb.active
    ws.title = f"Empresas Informadas {anio}"

    ws.append(["ID", "Empresa", "Contacto", "Años Informados"])

    empresas = db.query(models.Empresa).all()
    
    for emp in empresas:
        if emp.anios_informados and anio in emp.anios_informados:
            ws.append([emp.id, emp.nombre, emp.numero_contacto or "", emp.anios_informados])

    filename = f"empresas_informadas_{anio}.xlsx"
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        filepath = tmp.name

    wb.save(filepath)
    background_tasks.add_task(_cleanup_file, filepath)

    return FileResponse(
        filepath,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
"""
with open('backend/routers/excel.py', 'a', encoding='utf-8') as f:
    f.write(code)
