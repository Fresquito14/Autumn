---
name: obsidian-backlog-sync
description: >-
  Sincronización, consulta y gestión del backlog y tareas de Autumn en Obsidian.
  Utiliza el CLI oficial de Obsidian (Obsidian.com) para consultas instantáneas
  en JSON y gestiona el ciclo de vida de tareas cumpliendo estrictamente con la
  sintaxis del plugin Obsidian Tasks (tasksPluginEmoji, 📅 para vencimiento y ✅ YYYY-MM-DD para completadas).
---

# Skill: Sincronización de Backlog con Obsidian

Esta skill permite al agente interactuar bidireccionalmente con la bóveda de **Obsidian** del usuario para consultar, planificar y actualizar tareas del proyecto **Autumn**.

---

## 📂 1. Configuración de Entorno y Rutas

- **Ruta de la Bóveda (Vault):**  
  `C:\Users\Fresquito\OneDrive\Documentos\Fresquito`
- **Nota Principal del Backlog de Autumn:**  
  `Apps/Autumn/Proyecto.md` (relativa al Vault)  
  `C:\Users\Fresquito\OneDrive\Documentos\Fresquito\Apps\Autumn\Proyecto.md` (absoluta)
- **Ejecutable Obsidian CLI:**  
  `C:\Users\Fresquito\AppData\Local\Programs\obsidian\Obsidian.com`

---

## ⚡ 2. Uso del CLI Oficial de Obsidian

El CLI se comunica en tiempo real con la instancia activa de Obsidian mediante IPC:

### Consultar tareas en JSON
```powershell
& "C:\Users\Fresquito\AppData\Local\Programs\obsidian\Obsidian.com" tasks path="Apps/Autumn/Proyecto.md" format=json
```

### Buscar texto en la carpeta de Autumn
```powershell
& "C:\Users\Fresquito\AppData\Local\Programs\obsidian\Obsidian.com" search query="path:Apps/Autumn" format=json
```

### Leer contenido completo de una nota
```powershell
& "C:\Users\Fresquito\AppData\Local\Programs\obsidian\Obsidian.com" read path="Apps/Autumn/Proyecto.md"
```

---

## 📝 3. Estándar del Plugin Obsidian Tasks (`tasksPluginEmoji`)

El Vault utiliza la configuración:
```json
{
  "taskFormat": "tasksPluginEmoji",
  "setDoneDate": true
}
```

### Estados y Emojis Soportados:
1. **Pendiente (Todo):**  
   `- [ ] <Descripción de la tarea> 📅 YYYY-MM-DD`
2. **En progreso (In Progress):**  
   `- [/] <Descripción de la tarea> 📅 YYYY-MM-DD`
3. **Completada (Done):**  
   `- [x] <Descripción de la tarea> 📅 YYYY-MM-DD ✅ YYYY-MM-DD`
4. **Cancelada (Cancelled):**  
   `- [-] <Descripción de la tarea> 📅 YYYY-MM-DD ❌ YYYY-MM-DD`

> [!IMPORTANT]
> El comando nativo del CLI `task done` solo conmuta `[ ]` por `[x]`, **sin añadir la fecha `✅`**. Por tanto, para completar tareas respetando el plugin Tasks, se utiliza el script helper o edición directa sobre la línea en el archivo `.md`.

---

## 🛠️ 4. Script de Automatización (`obsidian-tasks.cjs`)

Se proporciona un script listo para ejecutar en `.agents/skills/obsidian-backlog-sync/scripts/obsidian-tasks.cjs`:

### Comandos disponibles:

```bash
# 1. Listar todas las tareas (muestra iconos de estado y número de línea)
node .agents/skills/obsidian-backlog-sync/scripts/obsidian-tasks.cjs list

# 2. Listar únicamente tareas pendientes
node .agents/skills/obsidian-backlog-sync/scripts/obsidian-tasks.cjs todo

# 3. Marcar una tarea como completada (por número de línea o parte del texto)
node .agents/skills/obsidian-backlog-sync/scripts/obsidian-tasks.cjs complete 2
node .agents/skills/obsidian-backlog-sync/scripts/obsidian-tasks.cjs complete "icono de una bombilla"

# 4. Añadir una nueva tarea al backlog con fecha planificada opcional
node .agents/skills/obsidian-backlog-sync/scripts/obsidian-tasks.cjs add "Implementar panel de feedback en Supabase" 2026-09-10

# 5. Consultar sugerencias y feedback de usuarios en Supabase
node .agents/skills/obsidian-backlog-sync/scripts/obsidian-tasks.cjs feedback-list

# 6. Sincronizar feedbacks hacia la nota Apps/Autumn/Feedback.md
node .agents/skills/obsidian-backlog-sync/scripts/obsidian-tasks.cjs feedback-sync

# 7. Cambiar el estado de un feedback (nuevo -> aceptado -> planificado -> completado -> desestimado)
node .agents/skills/obsidian-backlog-sync/scripts/obsidian-tasks.cjs feedback-status <id_o_prefijo> aceptado "Aceptado para sprint próximo"
```

---

## 🔄 5. Protocolo de Sincronización en Desarrollo

Cuando el usuario pida avanzar en el proyecto o planificar:

1. **Al iniciar sesión / tarea:**
   * Ejecutar `node .agents/skills/obsidian-backlog-sync/scripts/obsidian-tasks.cjs todo` para verificar el estado de las tareas y acordar la siguiente a implementar.
2. **Gestión de Feedback de Usuarios:**
   * Ejecutar `node .agents/skills/obsidian-backlog-sync/scripts/obsidian-tasks.cjs feedback-sync` para descargar las sugerencias recibidas en la aplicación hacia `Apps/Autumn/Feedback.md`.
   * Realizar triaje: evaluar duplicados, agrupar sugerencias y actualizar estados con `feedback-status`.
3. **Al implementar:**
   * Respetar las invariantes de Autumn (`autumn-domain-engine`, `quality-gate`, `impact-analysis`).
4. **Al finalizar y superar el Quality Gate:**
   * Ejecutar `node .agents/skills/obsidian-backlog-sync/scripts/obsidian-tasks.cjs complete "<tarea>"` para reflejar la finalización con la fecha actual `✅` en Obsidian.

