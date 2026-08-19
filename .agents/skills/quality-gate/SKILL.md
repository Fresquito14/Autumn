---
name: quality-gate
description: >-
  Protocolo de verificación y validación estricta post-cambios para Autumn.
  Ejecuta comprobaciones de TypeScript, linter de ESLint, suite de pruebas en Vitest
  y auditoría de diff para evitar regresiones.
---

# Skill: Quality Gate & Verificación Estricta

Esta skill proporciona el procedimiento de validación y control de calidad obligatorio antes de dar por completada cualquier modificación en el repositorio **Autumn**.

---

## 🎯 Cuándo Activar esta Skill

Activa esta skill al finalizar cualquier fase de implementación de código, antes de presentar el resultado final al usuario.

---

## 📋 Batería de Validación Automatizada

Ejecutar secuencialmente los siguientes pasos utilizando la herramienta `run_command` en PowerShell:

### Paso 1: Verificación de Tipos TypeScript
```powershell
npm run build
```
*(o `npx tsc -b`)*
- **Criterio de Aprobación:** 0 errores de tipado.
- Si hay errores, corregir los tipos o interfaces afectadas sin usar `any` ni `// @ts-ignore`.

### Paso 2: Análisis Estático con ESLint
```powershell
npm run lint
```
- **Criterio de Aprobación:** 0 errores y 0 advertencias críticas de React Hooks (ej. dependencias faltantes en `useEffect`, mutaciones directas de estado).

### Paso 3: Suite de Pruebas Automatizadas (Vitest)
```powershell
npm run test -- --run
```
- **Criterio de Aprobación:** 100% de tests en verde en `src/tests/`.
- Ningún test preexistente debe haber sido eliminado o deshabilitado para ocultar un fallo.

---

## 🔍 Paso 4: Lista de Comprobación Manual / Auditoría de Diff

Revisar el código modificado contra esta lista de control:

1. **Gestión de Estado (Zustand):**
   - [ ] No se mutan objetos directamente en el estado.
   - [ ] Los selectores devuelven referencias estables o valores primitivos (no nuevos arrays u objetos en cada render salvo que usen `useShallow`).
2. **Persistencia (Dexie):**
   - [ ] Las escrituras asíncronas capturan errores con `try/catch` y notifican mediante toast (`sonner`) si procede.
   - [ ] No hay llamadas bloqueantes en el render principal.
3. **Grafos y Fechas:**
   - [ ] La propagación de dependencias no provoca llamadas recursivas infinitas.
   - [ ] Se contemplan fines de semana y festivos globales si aplica el cálculo de días hábiles.
4. **Accesibilidad y UX:**
   - [ ] Los diálogos y modales de Radix UI tienen `DialogTitle` o `aria-describedby` configurados.
   - [ ] Los botones tienen etiquetas accesibles o iconos con `aria-label`.
