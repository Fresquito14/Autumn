# Debug: Cálculo de Fechas

## Lógica Actual

### Finish-to-Start (FS) sin lag:
```
Tarea A: 10/11/2025 - 15/11/2025 (5 días)
Tarea B depende de A (FS, lag=0)

Cálculo:
1. Tomar fecha fin de A: 15/11/2025
2. Sumar 1 día: 16/11/2025
3. Ajustar a día laboral si es necesario
4. Esa es la fecha de inicio de B
5. Fecha fin de B = inicio + (duración - 1) días laborales
```

### Ejemplo con diferentes duraciones:

#### Tarea con duración 1 día:
```
Inicio: 16/11/2025
Duración: 1 día
Cálculo: addBusinessDays(16/11/2025, 1-1, [1,2,3,4,5]) = addBusinessDays(16/11/2025, 0, ...)
Resultado: 16/11/2025 (mismo día)
```

#### Tarea con duración 5 días:
```
Inicio: 16/11/2025
Duración: 5 días
Cálculo: addBusinessDays(16/11/2025, 5-1, [1,2,3,4,5]) = addBusinessDays(16/11/2025, 4, ...)
Contando días laborales:
- Día 0: 16/11 (domingo - no cuenta, busca siguiente laboral)
- Día 1: 17/11 (lunes) - cuenta
- Día 2: 18/11 (martes) - cuenta
- Día 3: 19/11 (miércoles) - cuenta
- Día 4: 20/11 (jueves) - cuenta
Resultado: 20/11/2025
```

## Posibles Problemas

### Problema 1: Duración incluye día de inicio
En gestión de proyectos:
- Duración de 1 día = inicio y fin el mismo día
- Duración de 5 días = desde lunes hasta viernes (ambos incluidos)

**Fórmula actual:** `endDate = addBusinessDays(startDate, duration - 1)`

Esto es CORRECTO si:
- duration = 1 → addBusinessDays(start, 0) → mismo día ✅
- duration = 5 → addBusinessDays(start, 4) → 5 días totales ✅

### Problema 2: Fin de semana no se maneja bien
Si la tarea predecesora termina en viernes:
```
Tarea A termina: Viernes 14/11/2025
Tarea B debería iniciar: Lunes 17/11/2025 (siguiente día laboral)

Cálculo actual:
1. predecessorEnd = 14/11 (viernes)
2. newStartDate = 14/11 + 1 día = 15/11 (sábado)
3. Ajustar a día laboral: busca siguiente laboral → 17/11 (lunes) ✅
```

Esto debería funcionar correctamente.

### Problema 3: addBusinessDays con 0 días
```javascript
addBusinessDays(new Date('2025-11-16'), 0, [1,2,3,4,5])
```

Con la implementación actual:
```javascript
let currentDate = new Date(date)  // 16/11
let remainingDays = 0

while (remainingDays > 0) {  // No entra al loop
  // ...
}

return currentDate  // Devuelve 16/11
```

Esto es correcto para duración de 1 día.

## Test Cases para Verificar

### Test 1: Tarea de 1 día
```
Input:
- Tarea A: 10/11 - 10/11 (1 día)
- Tarea B: depende de A, duración 1 día

Expected:
- Tarea B: 11/11 - 11/11

Cálculo:
- A termina: 10/11
- B inicia: 10/11 + 1 = 11/11
- B termina: addBusinessDays(11/11, 0) = 11/11 ✅
```

### Test 2: Tarea de 5 días
```
Input:
- Tarea A: 10/11 - 14/11 (5 días, L-V)
- Tarea B: depende de A, duración 5 días

Expected:
- Tarea B: 17/11 - 21/11 (L-V siguiente semana)

Cálculo:
- A termina: 14/11 (viernes)
- B inicia: 14/11 + 1 = 15/11 (sábado)
- Ajustar a laboral: 17/11 (lunes)
- B termina: addBusinessDays(17/11, 4) = 21/11 (viernes) ✅
```

### Test 3: Con lag
```
Input:
- Tarea A: 10/11 - 14/11 (5 días)
- Tarea B: depende de A, lag=2 días, duración 3 días

Expected:
- Tarea B: 19/11 - 21/11

Cálculo:
- A termina: 14/11 (viernes)
- Sin lag: 17/11 (lunes)
- Con lag de 2: addBusinessDays(17/11, 2) = 19/11 (miércoles)
- B termina: addBusinessDays(19/11, 2) = 21/11 (viernes) ✅
```

## Instrucciones para Debug

1. Abre consola del navegador (F12)
2. Crea 2 tareas:
   - Tarea A: cualquier fecha, duración X días
   - Tarea B: cualquier fecha, duración Y días
3. Crea dependencia: A → B (FS, lag=0)
4. Anota las fechas originales
5. Click "Recalcular Fechas"
6. Verifica los logs en consola
7. Compara fechas resultantes con las esperadas

## Formato para reportar bug:

```
Configuración:
- Tarea A: Inicio: DD/MM/YYYY, Fin: DD/MM/YYYY, Duración: X días
- Tarea B: Inicio: DD/MM/YYYY, Fin: DD/MM/YYYY, Duración: Y días
- Dependencia: A → B, FS, lag=0

Después de recalcular:
- Tarea B: Inicio: DD/MM/YYYY, Fin: DD/MM/YYYY

Esperaba:
- Tarea B: Inicio: DD/MM/YYYY, Fin: DD/MM/YYYY

Logs de consola:
[Pegar aquí]
```
