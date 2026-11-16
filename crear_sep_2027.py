import json
import urllib.request
import urllib.error
import time

API_BASE = "https://camboriu-estudiantil.onrender.com"

fpath = r'C:\Users\Braai\.gemini\antigravity\brain\e421368e-b9b7-438a-a33e-7d01be4336ea\.system_generated\sep2026.json'

with open(fpath, 'r', encoding='utf-8') as f:
    content = f.read()

start = content.find('{')
data = json.loads(content[start:])
events = data.get('events', [])

# Recolectar TODAS las fechas disco de sep 2026 (globales y privadas)
disco_sep = {}

for ev in events:
    ep = ev.get('extendedProps', {})
    if ep.get('tipo') == 'servicio_global' and ep.get('evento_tipo') == 'DISCO':
        fecha = ev.get('start', '')
        if not fecha.startswith('2026-09'):
            continue
        
        evento_id = ep.get('evento_id')
        nombre = ep.get('evento_nombre', '') or ep.get('nombre_evento', '')
        horario = ep.get('horario')
        con_alcohol = ep.get('con_alcohol', False)
        es_mix = ep.get('es_mix_evento', False)
        tematica_id = ep.get('tematica_id')
        es_privado = ep.get('es_privado', False)
        
        key = (fecha, evento_id)
        if key not in disco_sep:
            disco_sep[key] = {
                'fecha': fecha,
                'evento_id': evento_id,
                'nombre': nombre,
                'horario': horario,
                'con_alcohol': con_alcohol,
                'es_mix': es_mix,
                'tematica_id': tematica_id,
                'era_privado': es_privado,
            }

to_create = []
for (fecha_2026, evento_id), info in sorted(disco_sep.items()):
    fecha_2027 = fecha_2026.replace('2026-', '2027-')
    to_create.append({**info, 'fecha_2027': fecha_2027, 'fecha_2026': fecha_2026})

print(f"Fechas disco sep 2026 -> sep 2027: {len(to_create)}")
for t in to_create:
    priv = " [era privado]" if t['era_privado'] else ""
    print(f"  {t['fecha_2026']} ({t['nombre']}){priv} -> {t['fecha_2027']}")

print("\nCreando...")
created = 0
errors = []

for item in to_create:
    payload = {
        "evento_id": item['evento_id'],
        "fecha": item['fecha_2027'],
        "horario": item['horario'],
        "con_alcohol": item['con_alcohol'],
        "es_mix_evento": item['es_mix'],
        "tematica_id": item['tematica_id'],
        "es_privado": False,
        "empresa_privada_id": None,
        "show": None,
        "animador": None,
        "cantidad_cajas": None,
        "cantidad_seguridad": None,
        "cantidad_limpieza": None,
        "cantidad_ambulancias": None,
    }
    
    body = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        f"{API_BASE}/eventos/fecha",
        data=body,
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())
            created += 1
            print(f"OK [{created}]: {item['fecha_2027']} - {item['nombre']} (id={result.get('id')})")
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8', errors='replace')
        errors.append(f"ERROR {item['fecha_2027']} {item['nombre']}: HTTP {e.code} - {err_body}")
        print(f"ERROR: {item['fecha_2027']} {item['nombre']}: HTTP {e.code}")
    except Exception as e:
        errors.append(f"ERROR {item['fecha_2027']} {item['nombre']}: {e}")
        print(f"ERROR: {item['fecha_2027']} {item['nombre']}: {e}")
    
    time.sleep(0.3)

print(f"\n=== RESUMEN ===")
print(f"Creados: {created}")
print(f"Errores: {len(errors)}")
for e in errors:
    print(e)
