---
name: test-driven-assurance
description: >-
  Guía para escribir y mantener suites de pruebas en Vitest y React Testing Library para Autumn.
  Usar para crear tests unitarios, tests de hooks y tests de algoritmos de cálculo.
---

# Skill: Aseguramiento mediante Tests (Vitest & React Testing Library)

Esta skill define los patrones, utilidades y estándares para crear y mantener pruebas automatizadas en **Autumn**.

---

## 🎯 Cuándo Activar esta Skill

Activa esta skill cuando:
1. Se cree una nueva función de cálculo en `src/lib/`.
2. Se modifique o agregue un custom hook o store de Zustand en `src/hooks/`.
3. Se corrija un bug crítico para asegurar que existe un test de regresión (*regression test*).

---

## 🧪 Estructura de Tests en Autumn

Los tests residen en `src/tests/`:
- `dependencies.test.ts`: Validación de ordenación topológica y propagación de fechas.
- `wbs.test.ts`: Generación y cálculo de numeración WBS jerárquica.
- `useAutosave.test.ts`: Comportamiento de persistencia y debouncing.
- `setup.ts`: Configuración inicial del entorno (`jsdom`, mocks globales).

---

## 📐 Patrones y Ejemplos de Tests

### 1. Test de Función Pura (Cálculos / Algoritmos)
```typescript
import { describe, it, expect } from 'vitest';
import { calculateTaskDates } from '@/lib/calculations/date_calculations';

describe('calculateTaskDates', () => {
  it('debe recalcular la fecha de fin excluyendo fines de semana', () => {
    const startDate = new Date('2026-08-17'); // Lunes
    const duration = 5; // 5 días laborables
    const result = calculateTaskDates(startDate, duration, []);
    
    // Debe terminar el Viernes 2026-08-21
    expect(result.toISOString().split('T')[0]).toBe('2026-08-21');
  });

  it('debe detectar dependencias circulares y no bloquear el hilo', () => {
    // Caso de prueba con ciclo A -> B -> A
    // ...
  });
});
```

### 2. Test de Custom Hooks con Zustand
```typescript
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useTasks } from '@/hooks/useTasks';

describe('useTasks Hook', () => {
  beforeEach(() => {
    // Resetear store o base de datos de test si aplica
  });

  it('debe agregar una nueva tarea correctamente', async () => {
    const { result } = renderHook(() => useTasks());

    await act(async () => {
      await result.current.addTask({
        name: 'Nueva Tarea',
        duration: 3,
        projectId: 'project-1',
      });
    });

    expect(result.current.tasks.some(t => t.name === 'Nueva Tarea')).toBe(true);
  });
});
```

---

## 🚀 Comandos de Ejecución

```powershell
# Ejecutar toda la suite una vez
npm run test -- --run

# Ejecutar un archivo específico
npm run test -- src/tests/dependencies.test.ts --run

# Ver reporte de cobertura
npm run test:coverage
```
