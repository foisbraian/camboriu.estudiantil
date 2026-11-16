import json
import urllib.request
import urllib.error
import time

API_BASE = "https://camboriu-estudiantil.onrender.com"

files = {
    'oct': r'C:\Users\Braai\.gemini\antigravity\brain\e421368e-b9b7-438a-a33e-7d01be4336ea\.system_generated\steps\67\output.txt',
    'nov': r'C:\Users\Braai\.gemini\antigravity\brain\e421368e-b9b7-438a-a33e-7d01be4336ea\.system_generated\steps\68\output.txt',
    'dic': r'C:\Users\Braai\.gemini\antigravity\brain\e421368e-b9b7-438a-a33e-7d01be4336ea\.system_generated\steps\69\output.txt',
}

# Recolectar fechas disco globales (no privadas) de Oct-Dic 2026
disco_fechas = {}

for mes, fpath in files.items():
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()
    start = content.find('{')
    data = json.loads(content[start:])
    events = data.get('events', [])
    
    for ev in events:
        ep = ev.get('extendedProps', {})
        if ep.get('tipo') == 'servicio_global' and ep.get('evento_tipo') == 'DISCO':
            if ep.get('es_privado', False):
                continue  # skip privados
            
            fecha = ev.get('start', '')
            if not (fecha.startswith('2026-10') or fecha.startswith('2026-11') or fecha.startswith('2026-12')):
                continue
            
            evento_id = ep.get('evento_id')
            nombre = ep.get('evento_nombre', '') or ep.get('nombre_evento', '')
            horario = ep.get('horario')
            con_alcohol = ep.get('con_alcohol', False)
            es_mix = ep.get('es_mix_evento', False)
            tematica_id = ep.get('tematica_id')
            
            key = (fecha, evento_id)
            if key not in disco_fechas:
                disco_fechas[key] = {
                    'fecha': fecha,
                    'evento_id': evento_id,
                    'nombre': nombre,
                    'horario': horario,
                    'con_alcohol': con_alcohol,
                    'es_mix': es_mix,
                    'tematica_id': tematica_id,
                }

print(f"Fechas disco globales (no privadas) Oct-Dic 2026: {len(disco_fechas)}")

# Calcular fechas para 2027 (mismo dia/mes)
to_create = []
for (fecha_2026, evento_id), info in sorted(disco_fechas.items()):
    # Cambiar 2026 -> 2027
    fecha_2027 = fecha_2026.replace('2026-', '2027-')
    to_create.append({
        'fecha_2027': fecha_2027,
        'fecha_2026': fecha_2026,
        'evento_id': evento_id,
        'nombre': info['nombre'],
        'horario': info['horario'],
        'con_alcohol': info['con_alcohol'],
        'es_mix': info['es_mix'],
        'tematica_id': info['tematica_id'],
    })

print(f"Fechas a crear en 2027: {len(to_create)}")
for t in to_create:
    print(f"  {t['fecha_2026']} ({t['nombre']}) -> {t['fecha_2027']}")
