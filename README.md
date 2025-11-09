# 🍂 Autumn - Gestión de Proyectos

Una aplicación React profesional para planificación y seguimiento de proyectos con diagramas de Gantt. Inspirada en Primavera pero moderna, accesible y gratuita.

## 🚀 Estado del Proyecto

**Fase 1: Fundación** ✅ Completada

- ✅ Setup proyecto (Vite + React + TypeScript + Tailwind)
- ✅ Configuración de shadcn/ui
- ✅ Implementación completa del data model
- ✅ Configuración de Dexie para IndexedDB
- ✅ Configuración de Zustand stores
- ✅ Tests unitarios del data model

## 🛠️ Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: Zustand
- **Database**: Dexie.js (IndexedDB)
- **Date Management**: date-fns
- **Drag & Drop**: @dnd-kit/core
- **Forms**: React Hook Form + Zod
- **Testing**: Vitest + Testing Library

## 📦 Instalación

```bash
# Instalar dependencias
npm install

# Modo desarrollo
npm run dev

# Build para producción
npm run build

# Ejecutar tests
npm test

# Tests con UI
npm run test:ui

# Preview de producción
npm run preview
```

## 🏗️ Arquitectura del Proyecto

### Estructura de Directorios

```
src/
├── components/
│   └── ui/              # Componentes de shadcn/ui
├── hooks/               # Zustand stores
│   ├── useProject.ts
│   ├── useTasks.ts
│   ├── useResources.ts
│   └── useDependencies.ts
├── lib/
│   ├── storage/         # Dexie database
│   │   ├── db.ts
│   │   └── migrations.ts
│   └── utils.ts         # Utilidades (cn, etc.)
├── tests/               # Tests unitarios
│   ├── dependencies.test.ts
│   ├── wbs.test.ts
│   └── setup.ts
└── types/               # TypeScript types
    ├── calendar.ts
    ├── project.ts
    ├── task.ts
    ├── dependency.ts
    ├── resource.ts
    ├── tracking.ts
    └── index.ts
```

### Data Model

El proyecto implementa un modelo de datos completo para gestión de proyectos:

- **Project**: Configuración del proyecto, calendario, días laborables
- **Task**: Tareas con WBS jerárquico, dependencias, recursos asignados
- **Milestone**: Hitos del proyecto con offsets de tareas
- **Dependency**: Dependencias entre tareas (Finish-to-Start)
- **Resource**: Recursos/trabajadores con calendarios y vacaciones
- **Tracking**: Imputación de tiempo y baselines (Fase 2)

### Stores (Zustand)

Cuatro stores principales con operaciones CRUD completas:

- **useProject**: Gestión de proyectos
- **useTasks**: Gestión de tareas y WBS
- **useResources**: Gestión de recursos
- **useDependencies**: Gestión de dependencias con validación de ciclos

### Base de Datos (Dexie/IndexedDB)

Schema optimizado con índices para queries eficientes:
- Índices compuestos para búsquedas por proyecto
- Transacciones para operaciones complejas
- Helper functions para operaciones comunes

## 🧪 Testing

Tests implementados para lógica crítica:

- ✅ Validación de dependencias circulares
- ✅ Generación y sorting de códigos WBS
- ✅ Cálculo de niveles jerárquicos

```bash
# Ejecutar todos los tests
npm test

# Tests en modo watch
npm test -- --watch

# Tests con UI
npm run test:ui
```

## 📝 Próximos Pasos

### Fase 2: Visualización Básica

- [ ] WBSTree con jerarquía visual
- [ ] CRUD básico de tareas con UI
- [ ] GanttChart con barras estáticas
- [ ] Timeline con grid temporal
- [ ] Algoritmo simple de schedule

### Fase 3: El Cerebro - Algoritmos

- [ ] Algoritmo de Critical Path Method (CPM)
- [ ] Cálculo de ES, EF, LS, LF, Float/Slack
- [ ] Validación de dependencias
- [ ] Recálculo automático de schedule

## 📄 Licencia

MIT

## 👨‍💻 Autor

Desarrollado como proyecto de aprendizaje y portfolio.

---

Para más detalles sobre el proyecto, consulta [docs/PROJECT.md](docs/PROJECT.md)
