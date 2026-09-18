"""
Script que reemplaza la lógica de combo en get_asignaciones_pagadas (finanzas.py).

LÓGICA ANTERIOR (incorrecta):
  - Asigna el costo TOTAL del combo al PRIMER evento.
  - El resto de los eventos combo cuestan $0.
  -> Con una seña parcial, el primer evento queda bloqueado aunque la seña cubra varios eventos.

LÓGICA NUEVA (correcta):
  - Pre-calcula cuántos eventos del combo tiene asignados el grupo.
  - Divide el costo total del combo entre esa cantidad de eventos.
  - Asigna ese costo proporcional a CADA evento combo.
  -> La seña parcial habilita tantos eventos como alcance.

Ejemplo del usuario:
  Combo $60/PAX, 250 PAX, 6 discos = $15.000 total
  Seña $4.000 / $2.500 por disco = puede usar disco 1 ✅, disco 2 ❌
"""

import re

filepath = 'backend/routers/finanzas.py'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

OLD_BLOCK = '''        for g in grupos:
            asigs_grupo = db.query(models.Asignacion).filter(models.Asignacion.grupo_id == g.id).all()
            for a in asigs_grupo:
                if not a.fecha_evento:
                    print(f"ALERTA: Asignacion {a.id} sin fecha_evento")
                    continue
                
                tipo = a.fecha_evento.evento.tipo
                costo = 0
                
                # Resolucion de combo
                if config.es_combo:
                    # Si es combo, el primer evento del grupo se cobra al precio del combo
                    # Pero solo si el tipo de evento es parte del combo o si es el primer evento general
                    asigs_g_sorted = sorted(asigs_grupo, key=lambda x: x.fecha_evento.fecha if x.fecha_evento else date.max)
                    if asigs_g_sorted and a.id == asigs_g_sorted[0].id:
                        pax = calcular_pax_cobrar(g, config.disco_liberados_ratio, config.disco_padres_gratis, config.disco_guias_gratis)
                        pax = _aplicar_pagantes_override(pax, g, "combo")
                        c_combo = obtener_precio_servicio_grupo(g, "combo", (config.precio_combo or 0), config)
                        costo = pax * c_combo
                    else:
                        # Para los eventos siguientes, ver si no estan en el combo, se cobran individualmente
                        es_adicional = False
                        precio_u = 0
                        s_key = None
                        
                        if tipo == "HIELO" and not config.combo_bar_hielo:
                            es_adicional = True
                            s_key = "hielo"
                            precio_u = config.precio_bar_hielo or 0
                        elif tipo == "CENA" and not config.combo_cena_velas:
                            es_adicional = True
                            s_key = "cena"
                            precio_u = config.precio_cena_velas or 0
                        elif tipo == "SURF" and not getattr(config, "combo_surf", False):
                            es_adicional = True
                            s_key = "surf"
                            precio_u = getattr(config, "precio_surf", 0) or 0
                        elif tipo == "UNIPRAIAS" and not getattr(config, "combo_unipraias", False):
                            es_adicional = True
                            s_key = "unipraias"
                            precio_u = getattr(config, "precio_unipraias", 0) or 0
                        elif tipo == "BETO" and not getattr(config, "combo_beto", False):
                            es_adicional = True
                            s_key = "beto"
                            precio_u = getattr(config, "precio_beto", 0) or 0
                        elif tipo == "BARCO" and not getattr(config, "combo_barco", False):
                            es_adicional = True
                            s_key = "barco"
                            precio_u = getattr(config, "precio_barco", 0) or 0
                        elif tipo == "CRISTO" and not getattr(config, "combo_cristo", False):
                            es_adicional = True
                            s_key = "cristo"
                            precio_u = getattr(config, "precio_cristo", 0) or 0
                        elif tipo == "SUNSET" and not getattr(config, "combo_sunset", False):
                            es_adicional = True
                            s_key = "sunset"
                            precio_u = getattr(config, "precio_sunset", 0) or 0
                        elif tipo == "QUINTA_COMIDA" and not getattr(config, "combo_quinta_comida", False):
                            es_adicional = True
                            s_key = "quinta_comida"
                            precio_u = getattr(config, "precio_quinta_comida", 0) or 0
                            
                        if es_adicional and s_key:
                            pax = _aplicar_pagantes_override((g.cantidad_pax or 0), g, s_key)
                            precio_u = obtener_precio_servicio_grupo(g, s_key, precio_u, config)
                            costo = pax * precio_u'''

NEW_BLOCK = '''        for g in grupos:
            asigs_grupo = db.query(models.Asignacion).filter(models.Asignacion.grupo_id == g.id).all()

            # ── PRE-CÁLCULO PARA COMBO ────────────────────────────────────────────────
            # Si la empresa usa combo, distribuimos el costo TOTAL del combo en partes
            # iguales entre todos los eventos combo asignados al grupo.
            #
            # Ejemplo: combo $60/PAX, 250 PAX, 6 discos → $15.000 total
            #          → $2.500 por evento
            #          Con seña de $4.000: habilita evento 1 ✅, evento 2 ❌
            combo_costo_por_evento = 0
            combo_tipos = set()
            if config.es_combo:
                # Tipos de evento incluidos en el combo
                combo_tipos = {"DISCO"}
                if config.combo_parque:                           combo_tipos.add("PARQUE")
                if getattr(config, "combo_campamento", False):   combo_tipos.add("CAMPAMENTO")
                if getattr(config, "combo_zacarias", False):     combo_tipos.add("ZACARIAS")
                if config.combo_pool:                             combo_tipos.add("POOL")
                if config.combo_cena_velas:                      combo_tipos.add("CENA")
                if config.combo_bar_hielo:                       combo_tipos.add("HIELO")
                if getattr(config, "combo_surf", False):         combo_tipos.add("SURF")
                if getattr(config, "combo_unipraias", False):    combo_tipos.add("UNIPRAIAS")
                if getattr(config, "combo_beto", False):         combo_tipos.add("BETO")
                if getattr(config, "combo_barco", False):        combo_tipos.add("BARCO")
                if getattr(config, "combo_cristo", False):       combo_tipos.add("CRISTO")
                if getattr(config, "combo_sunset", False):       combo_tipos.add("SUNSET")
                if getattr(config, "combo_quinta_comida", False):combo_tipos.add("QUINTA_COMIDA")
                if getattr(config, "combo_multiparque", False):  combo_tipos.add("MULTIPARQUE")

                pax_combo = calcular_pax_cobrar(g, config.disco_liberados_ratio, config.disco_padres_gratis, config.disco_guias_gratis)
                pax_combo = _aplicar_pagantes_override(pax_combo, g, "combo")
                c_combo = obtener_precio_servicio_grupo(g, "combo", (config.precio_combo or 0), config)
                total_costo_combo = pax_combo * c_combo

                # Cuántos eventos combo tiene asignados este grupo
                num_combo_eventos = sum(
                    1 for a2 in asigs_grupo
                    if a2.fecha_evento and a2.fecha_evento.evento and a2.fecha_evento.evento.tipo in combo_tipos
                )
                combo_costo_por_evento = (total_costo_combo / num_combo_eventos) if num_combo_eventos > 0 else total_costo_combo
            # ─────────────────────────────────────────────────────────────────────────

            for a in asigs_grupo:
                if not a.fecha_evento:
                    print(f"ALERTA: Asignacion {a.id} sin fecha_evento")
                    continue
                
                tipo = a.fecha_evento.evento.tipo
                costo = 0
                
                # Resolucion de combo
                if config.es_combo:
                    if tipo in combo_tipos:
                        # Evento incluido en el combo → costo proporcional
                        costo = combo_costo_por_evento
                    else:
                        # Evento ADICIONAL fuera del combo → precio individual
                        es_adicional = False
                        precio_u = 0
                        s_key = None
                        
                        if tipo == "HIELO" and not config.combo_bar_hielo:
                            es_adicional = True
                            s_key = "hielo"
                            precio_u = config.precio_bar_hielo or 0
                        elif tipo == "CENA" and not config.combo_cena_velas:
                            es_adicional = True
                            s_key = "cena"
                            precio_u = config.precio_cena_velas or 0
                        elif tipo == "SURF" and not getattr(config, "combo_surf", False):
                            es_adicional = True
                            s_key = "surf"
                            precio_u = getattr(config, "precio_surf", 0) or 0
                        elif tipo == "UNIPRAIAS" and not getattr(config, "combo_unipraias", False):
                            es_adicional = True
                            s_key = "unipraias"
                            precio_u = getattr(config, "precio_unipraias", 0) or 0
                        elif tipo == "BETO" and not getattr(config, "combo_beto", False):
                            es_adicional = True
                            s_key = "beto"
                            precio_u = getattr(config, "precio_beto", 0) or 0
                        elif tipo == "BARCO" and not getattr(config, "combo_barco", False):
                            es_adicional = True
                            s_key = "barco"
                            precio_u = getattr(config, "precio_barco", 0) or 0
                        elif tipo == "CRISTO" and not getattr(config, "combo_cristo", False):
                            es_adicional = True
                            s_key = "cristo"
                            precio_u = getattr(config, "precio_cristo", 0) or 0
                        elif tipo == "SUNSET" and not getattr(config, "combo_sunset", False):
                            es_adicional = True
                            s_key = "sunset"
                            precio_u = getattr(config, "precio_sunset", 0) or 0
                        elif tipo == "QUINTA_COMIDA" and not getattr(config, "combo_quinta_comida", False):
                            es_adicional = True
                            s_key = "quinta_comida"
                            precio_u = getattr(config, "precio_quinta_comida", 0) or 0
                            
                        if es_adicional and s_key:
                            pax = _aplicar_pagantes_override((g.cantidad_pax or 0), g, s_key)
                            precio_u = obtener_precio_servicio_grupo(g, s_key, precio_u, config)
                            costo = pax * precio_u'''

if OLD_BLOCK in content:
    content = content.replace(OLD_BLOCK, NEW_BLOCK, 1)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("OK: bloque de combo reemplazado correctamente")
else:
    print("ERROR: no se encontró el bloque a reemplazar")
    # Show a portion of what we found
    idx = content.find("for g in grupos:")
    if idx >= 0:
        print("Encontrado 'for g in grupos:' en posición", idx)
        print(repr(content[idx:idx+200]))
    else:
        print("No se encontró 'for g in grupos:'")
