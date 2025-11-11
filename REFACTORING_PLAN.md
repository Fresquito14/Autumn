# Plan de Refactorización - Autumn

## Problema Actual
El recálculo automático de fechas cuando se crean/eliminan dependencias causa bucles infinitos o bloquea la página.

## Causa Raíz
- Los hooks de Zustand retornan nuevas referencias en cada render
- Las actualizaciones de estado causan re-renders que pueden re-ejecutar los efectos
- No hay control sobre cuándo y cómo se ejecutan los recálculos

## Soluciones Propuestas

### ✅ Opción 1: Botón Manual de Recálculo (MÁS SIMPLE Y SEGURA)

**Ventajas:**
- Control total del usuario sobre cuándo recalcular
- Cero riesgo de bucles infinitos
- Fácil de implementar
- Patrón común en software profesional (Primavera P6 tiene "Schedule" button)

**Implementación:**
```typescript
// Agregar un botón "Recalcular Fechas" en la UI
// El usuario hace clic cuando necesita actualizar las fechas
// Es simple, predecible y profesional
```

**Tiempo estimado:** 30 minutos

---

### ⚠️ Opción 2: Optimistic Updates (MEDIA COMPLEJIDAD)

**Ventajas:**
- La UI se actualiza inmediatamente
- El recálculo ocurre en segundo plano
- Mejor experiencia de usuario

**Desventajas:**
- Más complejo de implementar
- Puede mostrar datos incorrectos temporalmente
- Requiere manejo de errores robusto

**Implementación:**
```typescript
// 1. Al crear dependencia, actualizar UI inmediatamente
// 2. Ejecutar recálculo en background
// 3. Si falla, revertir cambios
// 4. Si tiene éxito, actualizar con datos reales
```

**Tiempo estimado:** 2-3 horas

---

### ⚠️ Opción 3: Web Workers (ALTA COMPLEJIDAD)

**Ventajas:**
- Cálculos no bloquean el thread principal
- Mejor rendimiento en proyectos grandes
- Arquitectura profesional

**Desventajas:**
- Mayor complejidad
- Requiere serialización de datos
- Más difícil de debuggear

**Implementación:**
```typescript
// 1. Crear Web Worker para cálculos pesados
// 2. Enviar tasks y dependencies al worker
// 3. Worker calcula nuevas fechas
// 4. Main thread recibe resultados y actualiza UI
```

**Tiempo estimado:** 4-6 horas

---

### ⚠️ Opción 4: Middleware de Zustand (MEDIA COMPLEJIDAD)

**Ventajas:**
- Centraliza la lógica de recálculo
- Se ejecuta automáticamente en cambios específicos
- Más limpio que hooks en componentes

**Desventajas:**
- Requiere entender Zustand a profundidad
- Puede ser difícil debuggear
- Aún puede causar bucles si no se hace correctamente

**Implementación:**
```typescript
// Crear middleware que intercepta acciones de dependencies
// Cuando se crea/elimina dependencia, ejecutar recálculo
// Usar flags para evitar loops
```

**Tiempo estimado:** 2-3 horas

---

### ⚠️ Opción 5: Event Bus (MEDIA COMPLEJIDAD)

**Ventajas:**
- Desacopla componentes
- Fácil de extender
- Patrón común en aplicaciones grandes

**Desventajas:**
- Agrega otra capa de abstracción
- Puede ser difícil rastrear el flujo de datos

**Implementación:**
```typescript
// 1. Crear EventEmitter global
// 2. Emitir evento cuando cambian dependencies
// 3. Listener ejecuta recálculo
// 4. Actualiza stores con resultados
```

**Tiempo estimado:** 2-3 horas

---

## Recomendación

### Para MVP y desarrollo rápido:
**Opción 1: Botón Manual de Recálculo**

Razones:
1. Es lo que usan herramientas profesionales como Primavera P6
2. Cero bugs, cero complejidad
3. Usuario tiene control total
4. Puedes implementarlo en 30 minutos y seguir desarrollando otras features

### Para aplicación en producción:
**Opción 2: Optimistic Updates** + **Opción 4: Middleware**

Razones:
1. Balance entre UX y complejidad
2. Mantenible a largo plazo
3. Escalable para proyectos grandes

### Para aplicación enterprise:
**Opción 3: Web Workers** + **Opción 4: Middleware** + **Opción 2: Optimistic Updates**

Razones:
1. Máximo rendimiento
2. No bloquea UI nunca
3. Profesional y escalable

---

## Pasos Inmediatos Recomendados

1. **Implementar Opción 1** (botón manual) - 30 minutos
2. Continuar desarrollando otras features del roadmap
3. Cuando la app esté más madura, evaluar migrar a Opción 2 o 3

## Código para Opción 1 (Recomendada para ahora)

```typescript
// En DependencyList.tsx o en un nuevo componente
import { RefreshCw } from 'lucide-react'

export function ScheduleRecalculateButton() {
  const { recalculateDatesFromDependencies } = useTasks()
  const { dependencies } = useDependencies()
  const { currentProject } = useProject()
  const [isRecalculating, setIsRecalculating] = useState(false)

  const handleRecalculate = async () => {
    if (!currentProject) return

    setIsRecalculating(true)
    try {
      const workingDays = currentProject.config?.workingDays || [1, 2, 3, 4, 5]
      await recalculateDatesFromDependencies(dependencies, workingDays)
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setIsRecalculating(false)
    }
  }

  return (
    <Button
      onClick={handleRecalculate}
      disabled={isRecalculating}
      variant="outline"
    >
      <RefreshCw className={cn("h-4 w-4 mr-2", isRecalculating && "animate-spin")} />
      {isRecalculating ? 'Recalculando...' : 'Recalcular Fechas'}
    </Button>
  )
}
```

Esta solución es profesional, simple y te permite seguir desarrollando sin bloqueos.
