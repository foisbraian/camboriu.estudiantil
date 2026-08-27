import pandas as pd
import re

text = """
1 V
35PAX
28 AL 5/12
ZACARIAS + 3 DISCOS DIA 4 , GV 2

2 V
29 AL 6/12
40PAX
ZACARIAS + 2 DISCOS DIA 4 , GV 2

3 V 
29 AL 6/12
15PAX
ZACARIAS + 3 DISCOS DIA 4 , GV 2

4 V
30 AL 5/12
23PAX
3 DISCOS, GV 2


5 V
2 AL 9/12
30 PAX
ZACARIAS + 3 DISCOS DIA 4 , GV 2

6 V
2 AL 9/12
33PAX
ZACARIAS + 3 DISCOS DIA 4 , GV 2

7 V
2 AL 9/12
27PAX
ZACARIAS + 3 DISCOS DIA 4 , GV 2

8 V
2 AL 9/12
32PAX
ZACARIAS + 3 DISCOS DIA 4 , GV 2

9 V
4 AL 11/12
34PAX
ZACARIAS + 3 DISCOS DIA 8, GV 9

10 V
4 AL 11/12
86PAX
ZACARIAS + 2 DISCOS DIA 8, GV 9

11 V
4 AL 11/12
23PAX
ZACARIAS + 2 DISCOS DIA 8, GV 9

12 V
4 AL 11/12
33PAX
ZACARIAS + 2 DISCOS DIA 8, GV 9


13 V 
4 AL 11/12
27PAX
ZACARIAS + 2 DISCOS DIA 8, GV 9

14 V
4 AL 11/12
33PAX
ZACARIAS + 2 DISCOS DIA 8, GV 9

15 V
4 AL 11/12
26PAX
ZACARIAS + 2 DISCOS DIA 8, GV 9

16 V 
5 AL 11/12
6PAX
3 DISCOS, GV 9

17 V
5 AL 11/12
23PAX
3 DISCOS, GV 9

18 V
5 AL 11/12
37PAX
ZACARIAS + 3 DISCOS, ZACARIAS 10, GV 9

19 V 
5 AL 10/12
30PAX
ZACARIAS + 2 DISCOS, ZACARIAS 8, GV 9

20 V
6 AL 13/12
28PAX
ZACARIAS + 3 DISCOS, ZACARIAS 10, GV 9

21 V
6 AL 11/12
20PAX
2 DISCOS, GV 9

22 V
6 AL 13/12
15PAX
ZACARIAS + 3 DISCOS, ZACARIAS 10, GV 9

23 V
6 AL 13/12
43PAX
ZACARIAS + 2 DISCOS, ZACARIAS 10, GV 9

24 V
6 AL 13/12
38PAX
ZACARIAS + 2 DISCOS, ZACARIAS 10, GV 9

25 V
6 AL 13/12
40PAX
ZACARIAS + 2 DISCOS, ZACARIAS 10, GV 9

26 V
6 AL 12/12
26PAX
3 DISCOS, GV 9

27 V
7 AL 12/12
26PAX
2 DISCOS, GV 9

28 V
7 A L 13/12
33PAX
CAMP + 2, CAMP 10, GV 9

29 V
7 AL 13/12
37PAX
CAMP + 2, EL 10 Y 9 GV

30 V
7 AL 14/12
21PAX
CAMP + 3, EL 10 Y 9 GV

31 V
8 AL 13/12
25PAX
2DISCOS ,9 GV

32 V
8 AL 14/12
24PAX
CAMP + 2 DISCOS, CAMP 10, GV 9

33 V
9 AL 16/12
30PAX
CAMP + 3 DISCOS, GV 9 , 12 CAMP. 

34 V 
10 AL 15/12
19PAX
2 DISCOS

35 V
10 AL 17/12
26PAX
CAMP + 3, CAMP 16, GV 16

36 V
10 AL 17/12
19PAX
CAMP + , 16 CAMP, GV 16

37 V 
11 AL 18/12
40PAX
CAMP + 3 , CAMP 17, GV 16.

38 V
11 AL 18/12
27PAX
CAMP + 3, 17 CAMP, 16 GV

39 V
11 AL 16/12
20PAX
CAMP + 2 DISCOS, CAMP 15.

40 V
11 AL 16/12
29PAX
CAMP + 2 DISCOS, CAMP 15.

41 V
11 AL 16/12
29PAX
CAMP + 2 DISCOS, CAMP 15.

42 V
11 AL 16/12
21PAX
CAMP + 2 DISCOS, CAMP 15.

43 V
11 AL 16/12
15PAX
CAMP + 2 DISCOS, CAMP 15.

44 V
11 AL 16/12
23PAX
CAMP + 2 DISCOS, CAMP 15.


45 V
11 AL 16/12
41PAX
CAMP + 2 DISCOS, CAMP 15.

47 V
11 AL 18/12
34PAX
CAMP + 3 DISCOS, CAMP 17, GV 16.

48 V 
11 AL 18/12
30 PAX
CAMP + 3 DISCOS, CAMP 17, GV 16.

49 V 
12 AL 19/12
45 PAX
CAMP + 3 DISCOS, CAMP 17, GV 16.

50 V 
12 AL 19/12
36 PAX
CAMP + 3 DISCOS, CAMP 17, GV 16.

51 V 
12 AL 17/12
29 PAX
2 DISCOS, GV 16.

52 V 
12 AL 18/12
30 PAX
3 DISCOS, GV 16.

53 V 
13 AL 20/12
37  PAX
CAMP + 3 DISCOS,CAMP 17, GV 16.

54 V 
13 AL 20/12
24  PAX
CAMP + 3 DISCOS,CAMP 17, GV 16.

55 V 
13 AL 17/12
18  PAX
2 DISCOS, GV 16.

56 V 
13 AL 19/12
38  PAX
CAMP + 2 DISCOS, CAMP 15, GV 16.

56 V 
13 AL 19/12
38  PAX
CAMP + 2 DISCOS, CAMP 15, GV 16.

57 V 
13 AL 20/12
40  PAX
CAMP + 2 DISCOS, CAMP 15, GV 16.


58 V 
13 AL 20/12
35  PAX
CAMP + 2 DISCOS, CAMP 15, GV 16.

59 V 
13 AL 20/12
38  PAX
CAMP + 2 DISCOS, CAMP 15, GV 16.

60 V 
13 AL 20/12
20  PAX
CAMP + 2 DISCOS, CAMP 15, GV 16.

61 V 
13 AL 20/12
18  PAX
2 DISCOS, GV 16.

62 V 
14 AL 21/12
21  PAX
CAMP + 3 DISCOS, GV 16 , CAMP 16.

63 V 
14 AL 21/12
36  PAX
CAMP + 3 DISCOS, GV 16 , CAMP 16.

64 V 
14 AL 19/12
25  PAX
2 DISCOS, GV 16.

65 V 
15 AL 22/12
28  PAX
CAMP + 3 DISCOS, GV 16, CAMP 19. 

66 V 
15 AL 20/12
14  PAX
2 DISCOS, GV 16.

67 V 
15 AL 20/12
15  PAX
2 DISCOS, GV 16.

68 V 
15 AL 20/12
42  PAX
2 DISCOS, GV 16.

69 V 
16 AL 22/12
25  PAX
3 DISCOS, GV 16.

70 V 
16 AL 21/12
17  PAX
2 DISCOS, GV 16.

71A F 
29 AL 6/12
22PAX
CAMP + 3 DISCOS, CAMP 4 , GV 2

72A CREA
1 AL 7/12
26PAX
CAMP + 4 DISCOS, CAMP 5 , GV 2  (almuerzan primero tipo 12, luego camp)

73A CREA
4 AL 9/12
44PAX
CAMP + 3 DISCOS, CAMP 5. (almuerzan primero tipo 12, luego camp)

74A CREA
4 AL 10/12
35PAX
CAMP + 4 DISCOS, CAMP 5. (almuerzan primero tipo 12, luego camp)

75A CREA
2GRUPOS EN 1 SOLO
31PAX
4 AL 9/12  3DISCOS.

15PAX
4 AL 11/12 , 5 DISCOS
CAMP EL DIA 5 (almuerzan primero tipo 12, luego camp)

76A CREA
4 AL 11/12
50PAX
CAMP + 5 DISCOS, CAMP 5. (almuerzan primero tipo 12, luego camp)
 
77A F
4 AL 9/12
23PAX
CAMP + 2 DISCOS. CAMP 8.

78A F
5 AL 12/12
28PAX
CAMP + 2 DISCOS, CAMP 8, 9 GV.

79A F
6 AL 13/12
33PAX
CAMP + 2 DISCOS, CAMP 8, GV 9. 

80A CREA 
7 AL 12/12
35PAX
3 DISCOS

81A F
9 AL 16/12
28PAX
4 DISCOS + CAMP, CAMP EL DIA 12, GV  9.

82A F
9 AL 16/12
34PAX
2DISCOS, GV 9

83A F 
27PAX
9 AL 16/12
2 DISCOS, GV 9

84A F 
9 AL 16/12
15PAX
CAMP + 3 DISCOS, CAMP 12, GV 9

85A F 
16 AL 23/12
31PAX
CAMP + 4 DISCOS, GV 16 Y CAMP 19. 

86A CREA
11 AL 16/12
42
CAMP + 3 DISCOS, CAMP DIA 15 (almuerzan primero tipo 12, luego camp)

87A CREA
11 AL 17/12
34PAX
CAMP + 4 DISCOS, CAMP 15. (almuerzan primero tipo 12, luego camp)

88A CREA
11 AL 18/12
32PAX
CAMP + 5 DISCOS, 15 CAMP   (almuerzan primero tipo 12, luego camp)
 
89A CREA
11 AL 18/12
30PAX
CAMP + 5 DISCOS. CAMP 15 (almuerzan primero tipo 12, luego camp)

90A F
12 AL 17/12
27PAX
CAMP 16 + 2 DISCOS, GV 16.

91A F
12 AL 17/12
23PAX
CAMP 16 + 2 DISCOS, GV 16.

92A CREA
16 AL 23/12
41PAX
CAMP 19 + 5 DISCOS, GV 16.  (almuerzan primero tipo 12, luego camp)
"""

blocks = re.split(r'\n\s*\n', text.strip())
parsed = []

for b in blocks:
    lines = [x.strip() for x in b.split('\n') if x.strip()]
    if not lines or "2GRUPOS EN 1 SOLO" in b: continue # skip complex manual one for now
    
    nombre = lines[0]
    pax_line = next((l for l in lines if 'PAX' in l or l.isdigit()), '0')
    pax = int(re.sub(r'[^\d]', '', pax_line)) if re.sub(r'[^\d]', '', pax_line) else 0
    
    date_line = next((l for l in lines if 'AL' in l or '/' in l and 'PAX' not in l), '')
    
    # Simple parse dates (assumes month 12 normally)
    date_in, date_out = "", ""
    if date_line:
        # e.g., 28 AL 5/12
        match = re.search(r'(\d+)\s*A?L?\s*(\d+)/(\d+)', date_line.replace(' ', ''))
        if match:
            d1, d2, m2 = match.groups()
            d1, d2, m2 = int(d1), int(d2), int(m2)
            m1 = m2 if d1 < d2 else m2 - 1
            if m1 == 0: m1 = 11
            y1 = 2026 if m1 > 6 else 2027 # Assuming end of year / summer season
            y2 = 2026 if m2 > 6 else 2027
            date_in = f"{y1}-{m1:02d}-{d1:02d}"
            date_out = f"{y2}-{m2:02d}-{d2:02d}"

    services = " ".join(lines[2:]).upper()
    discos = 0
    d_match = re.search(r'(\d+)\s*DISCOS', services)
    if d_match: discos = int(d_match.group(1))
    
    # specific case "2 DISCOS" without space
    d_match2 = re.search(r'(\d+)DISCOS', services)
    if d_match2: discos = int(d_match2.group(1))

    # "CAMP + " without number defaults to 1 service (acceso) + comida
    campamento = "Si" if "CAMP" in services else "No"
    zacarias = "Si" if "ZACARIAS" in services else "No"

    parsed.append({
        "Nombre": nombre,
        "PAX": pax,
        "Fecha Entrada": date_in,
        "Fecha Salida": date_out,
        "Discos": discos,
        "Campamento Acceso": campamento,
        "Campamento Con Comida": campamento,
        "Zacarias Acceso": zacarias,
        "Zacarias Con Comida": zacarias,
        "Pool Acceso": "No",
        "Pool Con Comida": "No",
        "Permite Alcohol": "No",
        "Mix": "No",
        "Parque Acceso": "No",
        "Parque Con Comida": "No"
    })

# Add the manual one (75A CREA)
parsed.append({
    "Nombre": "75A CREA G1",
    "PAX": 31,
    "Fecha Entrada": "2026-12-04",
    "Fecha Salida": "2026-12-09",
    "Discos": 3,
    "Campamento Acceso": "Si",
    "Campamento Con Comida": "Si",
    "Zacarias Acceso": "No",
    "Zacarias Con Comida": "No",
    "Pool Acceso": "No",
    "Pool Con Comida": "No",
    "Permite Alcohol": "No",
    "Mix": "No",
    "Parque Acceso": "No",
    "Parque Con Comida": "No"
})
parsed.append({
    "Nombre": "75A CREA G2",
    "PAX": 15,
    "Fecha Entrada": "2026-12-04",
    "Fecha Salida": "2026-12-11",
    "Discos": 5,
    "Campamento Acceso": "Si",
    "Campamento Con Comida": "Si",
    "Zacarias Acceso": "No",
    "Zacarias Con Comida": "No",
    "Pool Acceso": "No",
    "Pool Con Comida": "No",
    "Permite Alcohol": "No",
    "Mix": "No",
    "Parque Acceso": "No",
    "Parque Con Comida": "No"
})

df = pd.DataFrame(parsed)
df.to_excel('Grupos_Preformateados.xlsx', index=False)
print("Hecho")
