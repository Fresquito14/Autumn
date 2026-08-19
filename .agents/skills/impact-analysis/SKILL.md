---
name: impact-analysis
description: >-
  Protocolo exhaustivo de análisis de impacto y dependencias cruzadas para Autumn.
  Usar antes de modificar cualquier store de Zustand, cálculo de fechas, esquema de Dexie,
  servicio de Supabase o componente central de la UI.
---

# Skill: Análisis de Impacto y Dependencias Cruzadas

Esta skill guía al agente en el mapeo riguroso de dependencias y riesgos antes de escribir código en **Autumn**.

---

## 🎯 Cuándo Activar esta Skill

Activa esta skill **siempre** que la tarea implique:
1. Modificación de interfaces o tipos en `src/types/`.
2. Cambios en la lógica de cálculo de fechas, grafos o algoritmo de Kahn (`src/lib/calculations/`, `src/lib/algorithms/`).
3. Modificaciones en stores de Zustand (`src/hooks/useTasks.ts`, `useProject.ts`, etc.).
4. Modificación de tablas o índices de Dexie / IndexedDB (`src/lib/storage/`).
5. Modificación de llamadas a Supabase (`src/lib/supabase/`).
6. Movimiento de archivos o refactorizaciones estructurales.

---

## 📋 Protocolo de Ejecución Paso a Paso

### Paso 1: Mapeo del Grafo de Dependencias
Rastrear los archivos dependientes mediante búsquedas de texto / referencias:
- **Nivel 1 (Contratos de Datos):** ¿Qué interfaces de `src/types/` cambian?
- **Nivel 2 (Persistencia):** ¿Afecta a las tablas de Dexie (`db.ts`), esquemas o migraciones? ¿Afecta a las tablas de Supabase (`db_service.ts`)?
- **Nivel 3 (Estado Reactivo):** ¿Qué stores de Zustand consumen estos datos? ¿Hay selectores o acciones modificadas?
- **Nivel 4 (Vistas UI):** ¿Qué vistas consumen el hook/store? (Gantt, WBS, Board, Milestones, Portfolio, Resources).
- **Nivel 5 (Tests):** ¿Qué tests en `src/tests/` cubren esta funcionalidad?

### Paso 2: Matriz de Evaluación de Riesgos
Evaluar y documentar los siguientes 5 riesgos críticos:

| Vector de Riesgo | Pregunta de Control | Nivel de Riesgo (Bajo/Medio/Alto) |
|---|---|---|
| **Bucle de Fechas** | ¿El cambio puede generar dependencias circulares o invalidar Kahn? | |
| **Pérdida de Datos** | ¿El cambio en Dexie requiere migración de versión o reseteo? | |
| **Desincronización** | ¿Hay discrepancia entre el estado en memoria (Zustand) y Dexie/Supabase? | |
| **Re-renders en UI** | ¿Se crean nuevos objetos/arrays en selectores que disparen renders infinitos? | |
| **Rotura de Tests** | ¿Fallarán los tests existentes en `src/tests/`? | |

### Paso 3: Plan de Mitigación
Redactar una lista con:
1. Archivos exactos que deben ser editados y en qué orden.
2. Comprobaciones que se realizarán tras el cambio.
3. Tests que deberán crearse o actualizarse.
