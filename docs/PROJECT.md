---
title: Autumn - Gestión de Proyectos
created: 2025-11-07
updated: 2025-11-07
type: proyecto
status: idea
tech:
  - react
  - typescript
  - vite
  - tailwind
priority: alta
estimated-time: 8-12 semanas
tags:
  - proyecto/react
  - desarrollo/productividad
  - desarrollo/gestion-proyectos
---

# 🍂 Autumn - Gestión de Proyectos

> Una aplicación React profesional para planificación y seguimiento de proyectos con diagramas de Gantt. Inspirada en Primavera pero moderna, accesible y gratuita.

---

## 📋 Concepto

### Descripción
**Autumn** es una herramienta de gestión de proyectos con capacidades profesionales: WBS jerárquico, cálculo de camino crítico, gestión de recursos, y tracking de ejecución. El nombre es un guiño a **Primavera** (Spring), uno de los softwares de gestión de proyectos más potentes, pero con un enfoque moderno, web-first y accesible.

### El Nombre
**Autumn** (Otoño) → Juego de palabras con **Primavera** (Spring)
- Representa madurez y consolidación (vs la renovación de primavera)
- Evoca profesionalismo y elegancia
- Fácil de pronunciar y recordar

### Problema que Resuelve
- **Primavera/MS Project** son extremadamente caros (€1000+/licencia) y complejos
- **Herramientas modernas** (Asana, Monday) son de pago o muy limitadas en free tier
- **Falta de transparencia**: Datos atrapados en plataformas, difícil exportar
- **Complejidad innecesaria**: Features que el 90% de usuarios nunca usa
- **No accesibles**: Requieren instalación, no funcionan en cualquier dispositivo

### Características Principales

#### Fase 1: Planificación (MVP)
- **WBS Jerárquico**: Work Breakdown Structure multinivel
- **Dependencias Finish-to-Start**: Tareas que dependen de otras
- **Hitos con offset**: Milestones distanciados X días de tareas
- **Checklist de pasos**: Subtareas granulares sin duración
- **Camino crítico**: Cálculo automático y resaltado visual
- **Asignación de recursos**: Trabajadores asignados a tareas
- **Calendario del proyecto**: Días laborables, jornadas, festivos
- **Ocupación de recursos**: Vista de carga de trabajo por persona
- **Baseline**: Snapshot del plan original para comparación
- **Export/Import**: JSON para backup y portabilidad

#### Fase 2: Tracking & Ejecución
- **Porcentaje de cumplimiento**: % completado de cada tarea
- **Imputación de tiempo real**: Horas trabajadas en cada tarea
- **Recálculo dinámico**: Camino crítico actualizado con datos reales
- **Comparación Planificado vs Real**: Visualización de desviaciones
- **Dashboard de métricas**: SPI/CPI básicos, tendencias

#### Features Adicionales (Roadmap)
- **Warnings de recursos**: Alertas de sobreasignación
- **Zoom temporal**: Vistas día/semana/mes/trimestre
- **Filtros visuales**: Por recurso, criticidad, estado
- **Templates**: Plantillas de proyectos tipo
- **Export avanzado**: PDF, Excel, imágenes
- **Timeline de cambios**: Historial de modificaciones

### Casos de Uso
1. **Project Manager planifica construcción**: WBS detallado con 100+ tareas, gestión de 10+ trabajadores
2. **Tech Lead organiza desarrollo software**: Sprints con dependencias, asignación de equipo
3. **Event planner coordina evento**: Timeline detallado con milestones y deadlines críticos
4. **Consultora presenta plan a cliente**: Exportar Gantt profesional con camino crítico

---

## 🎯 Motivación

![[_secciones-comunes#^motivacion-personal]]

### Específico de este proyecto

He usado Primavera, MS Project, y decenas de herramientas modernas. Todas tienen problemas:
- **Primavera**: Potentísimo pero cuesta miles de euros, curva de aprendizaje brutal
- **MS Project**: Caro, solo Windows, interfaz anticuada
- **Herramientas modernas**: Bonitas pero limitadas, te obligan a pagar para features básicas

Quiero **Autumn** porque:
- Combina lo mejor de herramientas profesionales (camino crítico, WBS, recursos)
- Con la accesibilidad de apps web modernas (gratis, en navegador, hermoso)
- **Control total**: Mis datos son míos, puedo exportar cuando quiera
- **Aprendizaje técnico**: Algoritmos complejos (critical path), visualizaciones avanzadas, gestión de estado complejo

**Este es el proyecto más ambicioso de mi lista**, pero también el más satisfactorio si lo ejecuto bien.

---

## 🛠️ Tech Stack

![[_secciones-comunes#^tech-stack-react]]

### Dependencias Específicas de este Proyecto

**Librerías principales:**
- **@dnd-kit/core** - Drag and drop profesional y accesible
- **date-fns** - Manipulación de fechas, cálculo de business days
- **react-zoom-pan-pinch** - Navegación del Gantt (zoom/pan)
- **dexie.js** - IndexedDB wrapper (más robusto que localStorage)
- **recharts** - Gráficos para dashboard de métricas
- **lucide-react** - Sistema de iconos
- **react-hook-form + zod** - Forms complejos con validación

**Librerías de visualización (evaluar):**
- **SVG React** - Enfoque inicial (simplicidad, accesibilidad)
- **Konva.js** o **fabric.js** - Si SVG tiene problemas de performance con 100+ tareas
- **Canvas API nativo** - Máxima performance pero más complejo

**Consideraciones:**
- **IndexedDB desde el inicio**: Proyectos pueden ser grandes (100s de tareas)
- **Web Workers**: Para cálculos pesados (critical path con muchas dependencias)
- **Virtual scrolling**: Si timeline tiene muchas tareas (react-window)

---

## 🏗️ Arquitectura

### Estructura de Componentes
```
src/
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Dialog.tsx
│   │   ├── DatePicker.tsx
│   │   ├── Select.tsx
│   │   └── Tabs.tsx
│   └── features/
│       ├── ProjectSetup/
│       │   ├── ProjectConfig.tsx      # Calendario, jornadas, festivos
│       │   └── ProjectInfo.tsx        # Metadata del proyecto
│       ├── WBS/
│       │   ├── WBSTree.tsx            # Vista jerárquica de tareas
│       │   ├── TaskForm.tsx           # Crear/editar tarea
│       │   └── TaskRow.tsx            # Fila de tarea en árbol
│       ├── GanttChart/
│       │   ├── GanttChart.tsx         # Contenedor principal
│       │   ├── GanttTimeline.tsx      # Timeline con barras
│       │   ├── GanttTaskBar.tsx       # Barra de tarea (draggable)
│       │   ├── GanttMilestone.tsx     # Rombo de hito
│       │   ├── GanttDependencyLine.tsx # Líneas de dependencia
│       │   └── GanttResourceLayer.tsx  # Overlay de asignaciones
│       ├── Resources/
│       │   ├── ResourceList.tsx       # Gestión de trabajadores
│       │   ├── ResourceCalendar.tsx   # Vacaciones por recurso
│       │   └── ResourceUtilization.tsx # Gráfico de ocupación
│       ├── CriticalPath/
│       │   ├── CriticalPathView.tsx   # Vista resaltada de CP
│       │   └── CPCalculator.tsx       # Lógica de cálculo (puede ser Web Worker)
│       ├── Tracking/
│       │   ├── ProgressForm.tsx       # Actualizar % y horas
│       │   ├── ComparisonView.tsx     # Planificado vs Real
│       │   └── MetricsDashboard.tsx   # SPI, CPI, etc.
│       └── Export/
│           ├── ExportDialog.tsx
│           └── ImportDialog.tsx
├── hooks/
│   ├── useProject.ts          # Estado global del proyecto
│   ├── useTasks.ts            # CRUD de tareas y WBS
│   ├── useResources.ts        # Gestión de recursos
│   ├── useDependencies.ts     # Gestión de dependencias
│   ├── useCriticalPath.ts     # Cálculo de camino crítico
│   ├── useCalendar.ts         # Lógica de calendario y business days
│   ├── useTimeline.ts         # Cálculos de visualización
│   └── useStorage.ts          # IndexedDB abstraction
├── lib/
│   ├── algorithms/
│   │   ├── critical-path.ts   # Algoritmo CPM (Critical Path Method)
│   │   ├── schedule.ts        # Cálculo de fechas con dependencias
│   │   └── resource-leveling.ts # Sugerencias de optimización
│   ├── calculations/
│   │   ├── dates.ts           # Business days, offsets
│   │   ├── metrics.ts         # SPI, CPI, variance analysis
│   │   └── utilization.ts     # Ocupación de recursos
│   ├── storage/
│   │   ├── db.ts              # Dexie setup
│   │   └── migrations.ts      # Schema versions
│   └── export/
│       ├── json.ts            # Export/import JSON
│       ├── pdf.ts             # Export PDF (future)
│       └── excel.ts           # Export Excel (future)
└── types/
    ├── project.ts             # Project, ProjectConfig
    ├── task.ts                # Task, WBSNode, Milestone
    ├── resource.ts            # Resource, Assignment
    ├── dependency.ts          # Dependency, DependencyType
    ├── calendar.ts            # Calendar, Holiday, WorkingDay
    └── tracking.ts            # Progress, TimeEntry, Baseline
```

### Modelo de Datos

```typescript
// Project
interface Project {
  id: string
  name: string
  description?: string
  startDate: Date
  endDate?: Date // Calculado
  config: ProjectConfig
  baselineId?: string
  createdAt: Date
  updatedAt: Date
}

interface ProjectConfig {
  workingDays: number[] // [1,2,3,4,5] = Lun-Vie
  hoursPerDay: number   // 8
  holidays: Holiday[]
  defaultDuration: number // 1 día por defecto
}

// Task & WBS
interface Task {
  id: string
  projectId: string
  name: string
  description?: string

  // WBS
  wbsCode: string        // "1.2.3"
  parentId?: string      // Para jerarquía
  level: number          // 0, 1, 2, 3...

  // Schedule
  duration: number       // En días laborables
  startDate: Date
  endDate: Date          // Calculado

  // Constraints
  constraintType?: 'ASAP' | 'ALAP' | 'MUST_START' | 'MUST_FINISH'
  constraintDate?: Date

  // Resources
  assignedTo: string[]   // Resource IDs

  // Tracking (Fase 2)
  percentComplete?: number
  actualStart?: Date
  actualFinish?: Date
  actualDuration?: number

  // Metadata
  notes?: string
  checklist: ChecklistItem[]
  tags?: string[]

  createdAt: Date
  updatedAt: Date
}

interface ChecklistItem {
  id: string
  text: string
  completed: boolean
}

// Milestone
interface Milestone {
  id: string
  projectId: string
  name: string
  date: Date
  linkedTaskId?: string  // Tarea de la que depende
  offsetDays?: number    // Días después de la tarea
  description?: string
}

// Dependency
interface Dependency {
  id: string
  projectId: string
  predecessorId: string  // Task ID
  successorId: string    // Task ID
  type: 'FS'             // Solo Finish-to-Start por ahora
  lag?: number           // Días de retraso (0 por defecto)
}

// Resource
interface Resource {
  id: string
  projectId: string
  name: string
  email?: string
  role?: string
  maxHoursPerWeek: number // 40 por defecto
  calendar: ResourceCalendar
  costPerHour?: number
}

interface ResourceCalendar {
  vacations: DateRange[]
  customWorkingDays?: number[] // Override de proyecto
}

// Tracking (Fase 2)
interface TimeEntry {
  id: string
  taskId: string
  resourceId: string
  date: Date
  hours: number
  notes?: string
}

interface Baseline {
  id: string
  projectId: string
  name: string // "Plan Original", "Revisión 1"
  createdAt: Date
  snapshot: {
    tasks: Task[]
    dependencies: Dependency[]
  }
}
```

### Flujo de Datos
```
[ProjectSetup] → [useProject] → IndexedDB
                      ↓
[WBSTree] → [useTasks] → [Cálculo de Schedule] → [Critical Path]
                ↓                                       ↓
        [useDependencies]                        [useTimeline]
                ↓                                       ↓
        [GanttChart] ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ←┘
                ↓
        [GanttTaskBar] (drag) → Actualiza Task → Recalcula Schedule
```

### Decisiones Arquitectónicas Clave

1. **Estado con Zustand**:
   - Más simple que Redux para este caso
   - Devtools para debugging
   - Subscripciones granulares para performance

2. **IndexedDB con Dexie**:
   - Proyectos pueden tener 100s de tareas
   - Queries eficientes con índices
   - Transacciones para consistencia

3. **Web Workers para algoritmos pesados**:
   - Critical Path con 100+ tareas puede tardar
   - No bloquear UI thread
   - Recalcular en background

4. **SVG para visualización inicial**:
   - Más simple de implementar y depurar
   - Accesibilidad built-in
   - Migrar a Canvas solo si es necesario

5. **Cálculo incremental**:
   - No recalcular todo el schedule en cada cambio
   - Topological sort para orden de cálculo
   - Marcar tareas "dirty" y propagar

6. **Layout horizontal con Focus Mode**:
   - Toolbar horizontal no penaliza ancho del Gantt
   - Focus Mode maximiza espacio (oculta toolbar)
   - Responsive: En móvil/tablet, toolbar → hamburger menu
   - Preferencia persistida en localStorage

---

## 🎨 Diseño UI/UX

### Principios de Diseño
- **Professional but Accessible**: Herramienta seria pero fácil de usar
- **Information Density**: Mostrar mucha info sin abrumar
- **Visual Hierarchy**: Usar color y tamaño para guiar atención
- **Feedback Inmediato**: Cambios visibles instantáneamente

### Layout Principal (Desktop)

**Modo Normal - Toolbar Horizontal:**
```
┌──────────────────────────────────────────────────────────────┐
│ 🍂 Autumn   Project: Web Relaunch  v1.0    [⚙️][💾][📤][◄]  │
├─[WBS]─[Gantt]─[Resources]─[Tracking]────────────────────────┤
│ View:[Week▼] Show:[☑️CP][☐Delayed] Filter:[👤All▼] Zoom:[━●━]│
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────┬──────────────────────────────────────────────────┐  │
│  │Task│ W1  W2  W3  W4  W5  W6  W7  W8  W9  W10 W11 W12  │  │
│  ├────┼──────────────────────────────────────────────────┤  │
│  │1.0 │████████                                      [CP]│  │
│  │1.1 │  █████                                       [CP]│  │
│  │1.2 │      ████                                        │  │
│  │2.0 │          ██████████                          [CP]│  │
│  │ ◆  │              ◆                          Milestone│  │
│  └────┴──────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Focus Mode - Máxima Visibilidad:**
```
┌──────────────────────────────────────────────────────────────┐
│                                                          [►] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──┬────────────────────────────────────────────────────┐  │
│  │  │   Jan 2025      │   Feb 2025      │   Mar 2025    │  │
│  ├──┼────────────────────────────────────────────────────┤  │
│  │1 │████████████████                                [CP]│  │
│  │2 │  ███████████                                   [CP]│  │
│  │3 │          █████████                                 │  │
│  │4 │                  ████████████████              [CP]│  │
│  │◆ │                      ◆                    Milestone│  │
│  └──┴────────────────────────────────────────────────────┘  │
│                                                              │
│  [Gantt ocupa 100% del espacio disponible]                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Características del Layout:**
- **Toolbar horizontal**: Todos los controles accesibles sin ocupar ancho crítico
- **3 filas de controles**:
  - Fila 1: Branding, proyecto, acciones globales
  - Fila 2: Navegación entre vistas principales
  - Fila 3: Controles contextuales (filtros, zoom, escala temporal)
- **Focus Mode**: Click en [◄] oculta toolbar, solo queda [►] para restaurar
- **Responsive**: En tablet/móvil, toolbar se convierte en hamburger menu
- **Preferencia persistente**: Guarda último estado (normal/focus) en localStorage

### Paleta de Colores
- **Primary**: Autumn orange (#D97706) - Para brand y accents
- **Critical Path**: Deep red (#DC2626) - Tareas en camino crítico
- **Completed**: Forest green (#059669) - Tareas completadas
- **In Progress**: Sky blue (#0284C7) - Tareas en curso
- **Delayed**: Warning amber (#F59E0B) - Tareas retrasadas
- **Neutrals**: Warm grays - UI chrome y backgrounds
- **Resources**: Palette de colores para cada persona

### Interacciones Clave

**WBS Management:**
- Crear tarea: Botón "+" en nivel deseado
- Indent/Outdent: Drag horizontal para cambiar nivel
- Reorder: Drag vertical dentro de nivel

**Gantt Interactions:**
- Mover tarea: Drag barra → Cambia start date
- Cambiar duración: Drag extremo de barra
- Crear dependencia: Drag desde punto de conexión
- Zoom: Scroll wheel o controles
- Pan: Click & drag en fondo

**Resource Assignment:**
- Asignar: Dropdown en task form o drag avatar a barra
- Ver ocupación: Hover en recurso muestra tooltip con %

**Critical Path:**
- Toggle "Show CP only" para filtrar
- CP siempre resaltado en rojo
- Tooltip muestra float/slack de tarea

**Focus Mode:**
- **Activar**: Click en botón [◄] en toolbar o atajo `F`
- **Desactivar**: Click en botón [►] o atajo `Esc`
- **Comportamiento**: Oculta todo el toolbar, Gantt ocupa 100% del viewport
- **Uso**: Presentaciones, revisiones con cliente, concentración profunda
- **Persistencia**: Preferencia guardada en localStorage

---

## 📝 Roadmap

> **Filosofía de desarrollo**: Iterativo y colaborativo con Claude. Sin timelines rígidos - cada fase se completa cuando funciona bien, no cuando el calendario lo dice. Prioridad en ver resultados visuales rápido y validar con ejemplos reales.

---

### Fase 1: Fundación
**Data model + Infraestructura básica**

- [ ] Setup proyecto (Vite + React + TypeScript + Tailwind + shadcn/ui)
- [ ] Configurar Dexie para IndexedDB
- [ ] Implementar data model completo (types + schema)
- [ ] Setup Zustand stores (project, tasks, resources, dependencies)
- [ ] Implementar ProjectSetup (calendario, jornadas, festivos)
- [ ] Tests unitarios de modelo de datos
- [ ] Deploy pipeline en Vercel

**✓ Resultado**: Base sólida para construir encima. Nada visual todavía, pero fundación correcta.

---

### Fase 2: Visualización Básica
**Ver algo funcional rápido**

- [ ] WBSTree con jerarquía visual (lista de tareas)
- [ ] CRUD básico de tareas (crear, editar, borrar)
- [ ] GanttChart con barras estáticas (sin interacción)
- [ ] Timeline con grid temporal
- [ ] Algoritmo simple de schedule (sin dependencias aún)
- [ ] UI básica pero funcional

**✓ Resultado**: Puedes crear tareas y ver un Gantt básico. Primer milestone visual.

---

### Fase 3: El Cerebro - Algoritmos
**Critical Path y dependencias**

- [ ] Gestión de dependencias Finish-to-Start
- [ ] Algoritmo de Critical Path Method (CPM)
- [ ] Cálculo de ES, EF, LS, LF, Float/Slack
- [ ] Validación de dependencias (detectar ciclos)
- [ ] Recálculo automático de schedule
- [ ] Resaltado visual de camino crítico en rojo
- [ ] Tests exhaustivos con casos edge

**✓ Resultado**: El core value de Autumn funciona. Algoritmos validados con ejemplos reales.

---

### Fase 4: Interactividad
**Hacer el Gantt útil de verdad**

- [ ] Drag & drop de barras (mover tareas)
- [ ] Resize de barras (cambiar duración)
- [ ] Crear dependencias visualmente (drag desde barra)
- [ ] Indent/outdent para cambiar nivel WBS
- [ ] Zoom temporal (día/semana/mes)
- [ ] Pan en timeline
- [ ] Feedback visual inmediato

**✓ Resultado**: Gantt interactivo y fluido. Experiencia comparable a herramientas profesionales.

---

### Fase 5: Features Profesionales
**Lo que hace Autumn completo**

- [ ] Gestión de recursos (CRUD + asignación)
- [ ] Vista de ocupación de recursos
- [ ] Warnings de sobreasignación
- [ ] Milestones con offset de tareas
- [ ] Checklist de pasos por tarea
- [ ] Baseline (snapshot de plan original)
- [ ] Export/Import JSON
- [ ] Focus Mode con toolbar toggle
- [ ] Atajos de teclado básicos

**✓ Resultado**: MVP completo de planificación. Usable para proyectos reales.

---

### Fase 6: Tracking & Métricas
**Seguimiento de ejecución**

- [ ] Actualizar % de cumplimiento
- [ ] Imputación de tiempo real
- [ ] Actual start/finish dates
- [ ] Vista de comparación planificado vs real
- [ ] Recálculo de critical path con datos reales
- [ ] Dashboard con métricas (SPI, CPI, variance)
- [ ] Gráficos de tendencias
- [ ] Vista de tareas retrasadas
- [ ] Predicción de fecha de fin

**✓ Resultado**: Sistema completo de planificación + tracking. Autumn v1.0 funcional.

---

### Backlog - Features Avanzadas
**Para después del MVP, basado en feedback real**

- [ ] Templates de proyectos comunes
- [ ] Filtros avanzados y búsqueda
- [ ] Timeline de cambios (historial)
- [ ] Export a PDF/Excel
- [ ] Modo oscuro
- [ ] Multi-idioma (i18n)
- [ ] Resource leveling automático
- [ ] Más tipos de dependencias (SS, FF, SF)
- [ ] Múltiples baselines
- [ ] Integración con calendarios externos

### Colaboración & Cloud (Opcional)
**Solo si hay demanda real**

- [ ] Backend simple para sync
- [ ] Compartir proyecto vía URL pública
- [ ] Comentarios en tareas
- [ ] Real-time collaboration

### Integraciones (Nice-to-have)
**Interoperabilidad con herramientas existentes**

- [ ] Import desde MS Project XML
- [ ] Export a Primavera XER
- [ ] Integración con Google Calendar
- [ ] API REST para integraciones custom

---

## 🧪 Testing

![[_secciones-comunes#^plan-testing]]

### Tests Específicos de este Proyecto

**Unit Tests (CRÍTICOS):**
- `critical-path.ts`: Algoritmo CPM con casos edge (ciclos, desconexiones)
- `schedule.ts`: Cálculo de fechas con dependencias y calendario
- `dates.ts`: Business days considerando festivos y vacaciones
- `metrics.ts`: Cálculos de SPI, CPI, variance
- Stores de Zustand: Operaciones CRUD y actualizaciones

**Component Tests:**
- `WBSTree`: Jerarquía, indent/outdent, reorder
- `GanttTaskBar`: Drag & drop, resize, rendering
- `TaskForm`: Validación, submission
- `DependencyLine`: Rendering correcto de conexiones

**Integration Tests:**
- Crear tarea → Se actualiza Gantt
- Añadir dependencia → Recalcula schedule
- Cambiar calendario → Recalcula todas las fechas
- Guardar baseline → Comparar con estado actual
- Export → Import mantiene integridad

**E2E Tests:**
- Crear proyecto completo (20 tareas, 10 dependencias)
- Calcular critical path correctamente
- Asignar recursos y detectar sobrecarga
- Actualizar progreso y ver métricas
- Guardar, cerrar, reabrir proyecto

**Performance Tests:**
- Renderizar Gantt con 100+ tareas < 500ms
- Calcular critical path con 100 tareas < 200ms
- Drag de barra responde < 16ms (60fps)

---

## 🚀 Deployment

![[_secciones-comunes#^deployment-cicd]]

### Configuración Específica
- **Platform**: Vercel
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Domain**: `autumn-pm.vercel.app` (o custom)

### Performance Budget
- **First Contentful Paint**: < 2s
- **Time to Interactive**: < 3.5s
- **Bundle size**: < 300kb inicial (code splitting por ruta)
- **Lighthouse Performance**: > 90

### CI/CD
- Tests en cada PR
- Build preview por branch
- Deploy automático a prod en merge a main

---

## 📚 Documentación

![[_secciones-comunes#^estrategia-documentacion]]

### Documentos del Proyecto
- [ ] README.md con demo y screenshots
- [ ] ARCHITECTURE.md con explicación de algoritmos
- [ ] ALGORITHMS.md explicando CPM detalladamente
- [ ] User Guide integrado en app
- [ ] API documentation para data model
- [ ] Video tutorial de 5 minutos

---

## 🔗 Enlaces Relacionados

### Inspiración y Referencias
- **Primavera P6** - El gold standard de gestión de proyectos
- **Microsoft Project** - Herramienta tradicional, features sólidas
- **TeamGantt** - UX moderna y limpia
- **GanttPRO** - Interfaz elegante
- **Monday.com Timeline** - Interactividad fluida

### Recursos Técnicos
- [Critical Path Method - Wikipedia](https://en.wikipedia.org/wiki/Critical_path_method)
- [PERT/CPM Algorithms](https://www.geeksforgeeks.org/pert-cpm/)
- [Project Scheduling Algorithms](https://link.springer.com/chapter/10.1007/978-3-540-92666-5_2)
- [Earned Value Management](https://www.pmi.org/learning/library/earned-value-project-management-7183)

### Librerías
- [Dexie.js Documentation](https://dexie.org)
- [date-fns Documentation](https://date-fns.org)
- [dnd-kit Documentation](https://docs.dndkit.com)
- [Zustand Documentation](https://docs.pmnd.rs/zustand)

---

## 📅 Log de Desarrollo

### 2025-11-07 - Concepción de Autumn
- Rebautizado de "Gantt Ágil" a "Autumn"
- Definido alcance profesional inspirado en Primavera
- Roadmap dividido en 2 fases: Planificación (6 sem) + Tracking (4 sem)
- Funcionalidades core definidas: WBS, CP, recursos, baseline
- Decisión: Solo dependencias FS, pasos como checklist, frontend-only

---

## ✅ Criterios de Éxito

### Fase 1 (Planificación)
- [ ] Puedo crear un proyecto con WBS de 50+ tareas en 20 minutos
- [ ] El camino crítico se calcula correctamente (validar manualmente)
- [ ] Puedo asignar 5+ recursos y ver su ocupación
- [ ] Las dependencias funcionan (cambiar una tarea mueve las dependientes)
- [ ] Baseline permite comparar plan original vs actual
- [ ] Export/Import funciona sin pérdida de datos
- [ ] Interfaz es clara y profesional
- [ ] Performance es buena con 100+ tareas

### Fase 2 (Tracking)
- [ ] Puedo actualizar % de progreso y ver comparación
- [ ] Imputar horas reales y ver desviaciones
- [ ] Métricas SPI/CPI se calculan correctamente
- [ ] Dashboard muestra estado del proyecto de un vistazo
- [ ] Puedo identificar problemas (retrasos, sobrecarga) fácilmente

### General
- [ ] Tests pasando con 80%+ cobertura en lógica crítica
- [ ] Documentación completa y clara
- [ ] Deploy público y accesible
- [ ] Yo mismo lo uso para gestionar proyectos reales
- [ ] Al menos 3 personas externas lo prueban y dan feedback positivo

---

## 🤔 Decisiones Pendientes

### Resueltas en Brainstorming
- ✅ **Nombre**: Autumn (decidido)
- ✅ **Alcance MVP**: 2 fases (Planificación + Tracking)
- ✅ **Dependencias**: Solo FS por ahora
- ✅ **Pasos de tareas**: Checklist simple
- ✅ **Backend**: Frontend-only con IndexedDB

### Aún por Decidir
- [ ] **SVG vs Canvas**: Prototipar y decidir en Semana 3-4
- [ ] **Web Workers**: ¿Desde el inicio o solo si es necesario?
- [ ] **Límite de tareas**: ¿Optimizar para 100, 500, o 1000+ tareas?
- [ ] **Algoritmo de leveling**: ¿Incluir en Fase 1 o postponer?
- [ ] **Tema oscuro**: ¿MVP o post-launch?

---

## 💡 Ideas de Diferenciación

### Lo que hace único a Autumn:

1. **Profesional pero accesible**
   - Capacidades de Primavera/MS Project
   - UX de herramientas modernas

2. **Gratis y Open Source**
   - No freemium, no límites artificiales
   - Código abierto, transparencia total

3. **Web-first, Sin instalación**
   - Funciona en cualquier navegador
   - No requiere licencias ni instalación

4. **Data sovereignty**
   - Tus datos son tuyos (IndexedDB local)
   - Export/import sin lock-in

5. **Algoritmos correctos**
   - Critical Path Method implementado correctamente
   - No aproximaciones, cálculos precisos

6. **Enfoque en lo esencial**
   - Solo features que el 80% usa
   - No bloat, no complejidad innecesaria

---

## 🎓 Aprendizajes Técnicos Esperados

### Algoritmos
- **Critical Path Method (CPM)**: Topological sort, forward/backward pass
- **Project scheduling**: Constraint satisfaction, calendar calculations
- **Resource optimization**: Leveling algorithms

### Performance
- **Large datasets**: Virtual scrolling, incremental calculation
- **Web Workers**: Offload cálculos pesados
- **IndexedDB**: Queries eficientes, transacciones

### Visualización
- **SVG/Canvas**: Rendering de gráficos complejos
- **Drag & drop avanzado**: Múltiples constraints, snap to grid
- **Responsive charts**: Zoom, pan, diferentes escalas

### State Management
- **Zustand avanzado**: Subscriptions granulares, devtools
- **Data normalization**: Relaciones complejas (tasks, deps, resources)
- **Undo/redo**: Command pattern

---

## Notas Adicionales

### Sobre el Nombre
Consideré otros nombres pero Autumn es perfecto:
- **Primavera** → Spring → **Autumn** (continuación natural)
- Evoca profesionalismo y madurez
- Dominio probablemente disponible
- Fácil de recordar y pronunciar

### Sobre el Alcance
Este es un proyecto ambicioso (8-12 semanas). Requiere:
- Algoritmos complejos correctamente implementados
- UI/UX cuidadosa para manejar complejidad
- Testing exhaustivo (datos críticos de proyectos)
- Documentación clara

Pero es **totalmente factible** si:
- Me enfoco en features core primero
- Acepto que v1 no tendrá todo
- Itero basándome en uso real

### Estrategia de Implementación
1. **Algoritmos primero**: Asegurar que CPM funciona antes de UI bonita
2. **Data model sólido**: Cambiar schema después es costoso
3. **Testing constante**: Algoritmos con bugs = proyecto inútil
4. **Usar en proyectos reales**: Dog-fooding desde Semana 6

**Este proyecto puede ser la herramienta de PM gratuita que la comunidad necesita.**
