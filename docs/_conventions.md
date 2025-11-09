# Convenciones del Vault

> Este archivo define las convenciones y estándares para mantener consistencia en el vault. Claude debe consultar este archivo para entender cómo crear y mantener notas.

## Sistema de Metadatos YAML

Todos los archivos deben incluir un bloque YAML al inicio con la siguiente estructura base:

```yaml
---
title: Título descriptivo
created: YYYY-MM-DD
updated: YYYY-MM-DD
type: [proyecto|idea|diario|template|sistema]
status: [idea|planificación|en-desarrollo|activo|pausado|completado|archivado]
tags: []
---
```

### Metadatos Adicionales por Tipo

**Para proyectos de desarrollo:**
```yaml
tech: [react, typescript, node, etc.]
priority: [alta|media|baja]
estimated-time: X semanas/meses
```

**Para ideas de inversión:**
```yaml
asset-type: [acciones|crypto|fondos|inmobiliario]
risk-level: [bajo|medio|alto]
capital-required: cantidad estimada
timeline: corto/medio/largo plazo
```

## Sistema de Etiquetas

Usar tags jerárquicos con `/` para categorización:

### Proyectos de Desarrollo
- `#proyecto/react` - Proyectos en React
- `#proyecto/fullstack` - Proyectos full stack
- `#desarrollo/productividad` - Apps de productividad
- `#desarrollo/salud` - Apps relacionadas con salud
- `#desarrollo/finanzas` - Apps financieras

### Inversión
- `#inversión/idea` - Ideas de inversión individuales
- `#inversión/diario` - Entradas de diario
- `#inversión/análisis` - Análisis detallados
- `#finanzas/tracking` - Seguimiento de inversiones
- `#finanzas/research` - Investigación de mercado

### Sistema
- `#sistema/template` - Plantillas reutilizables
- `#sistema/convenciones` - Archivos de convenciones
- `#sistema/secciones-comunes` - Secciones transcluibles

## Convenciones de Nomenclatura

### Archivos de Sistema
- Prefijo `_` para archivos de sistema: `_conventions.md`, `_template-*.md`
- Minúsculas con guiones: `_secciones-comunes.md`

### Archivos de Contenido
- Título descriptivo en español con capitalización
- Puede incluir sufijo de tipo: `Nombre Proyecto - Proyecto React.md`
- Espacios permitidos para legibilidad

### Archivos Especiales
- `INDEX.md` - Punto de entrada principal (mayúsculas)

## Uso de Transclusión

### Sintaxis Básica
```markdown
![[nombre-archivo]]           # Transcluir archivo completo
![[nombre-archivo#sección]]   # Transcluir sección específica
![[nombre-archivo#^bloque]]   # Transcluir bloque identificado
```

### Buenas Prácticas
1. **Identificar bloques reutilizables** en `_secciones-comunes.md`:
   ```markdown
   ## Tech Stack React Estándar

   Contenido aquí...

   ^tech-stack-react
   ```

2. **Referenciar en lugar de duplicar**:
   - ✅ Correcto: `![[_secciones-comunes#^tech-stack-react]]`
   - ❌ Incorrecto: Copiar y pegar el mismo contenido

3. **Mantener un solo punto de verdad**:
   - Información común → `_secciones-comunes.md`
   - Información específica → Archivo del proyecto

## Enlaces Internos

### Sintaxis
```markdown
[[Nombre del Archivo]]                    # Link al archivo
[[Nombre del Archivo|Texto alternativo]]  # Link con alias
[[Nombre del Archivo#Sección]]            # Link a sección
```

### Estrategia de Enlaces
- Crear enlaces bidireccionales entre proyectos relacionados
- Enlazar desde INDEX.md a todos los proyectos principales
- Enlazar ideas de inversión relacionadas entre sí

## Estructura de Archivos de Proyecto

### Proyectos React
```markdown
---
[metadatos YAML]
---

# Título del Proyecto

## 📋 Concepto
Descripción breve del proyecto y su propósito.

## 🎯 Motivación
![[_secciones-comunes#^motivacion-personal]]

## 🛠️ Tech Stack
![[_secciones-comunes#^tech-stack-react]]

### Dependencias Específicas
- Librerías adicionales específicas de este proyecto

## 🏗️ Arquitectura
Descripción de la arquitectura específica.

## 📝 Roadmap
- [ ] Fase 1: ...
- [ ] Fase 2: ...

## 🔗 Enlaces Relacionados
- [[Otros Proyectos Relacionados]]
```

### Ideas de Inversión
```markdown
---
[metadatos YAML]
---

# Título de la Idea

## 💡 Tesis de Inversión
Razón fundamental para considerar esta inversión.

## 📊 Análisis
![[_secciones-comunes#^analisis-mercado]]

## ⚠️ Riesgos
Lista de riesgos específicos.

## 📅 Timeline
Cronología esperada.

## 📈 Seguimiento
Actualizaciones y evolución.
```

## Instrucciones para Claude

Cuando trabajes en este vault:

1. **SIEMPRE consulta este archivo** antes de crear o modificar notas
2. **Usa transclusión** en lugar de duplicar contenido
3. **Mantén los metadatos YAML actualizados** en todos los archivos
4. **Utiliza el sistema de tags consistentemente**
5. **Actualiza INDEX.md** cuando agregues nuevos proyectos
6. **Referencia archivos relacionados** con enlaces internos
7. **Mantén `_secciones-comunes.md`** como única fuente de verdad para contenido compartido
8. **Pregunta antes de crear** nuevas convenciones o estructuras

## Mantenimiento

### Actualización de fechas
- `created`: Solo al crear el archivo
- `updated`: Cada vez que se modifica significativamente

### Revisión periódica
- Revisar `status` de proyectos mensualmente
- Actualizar enlaces rotos
- Consolidar contenido duplicado en `_secciones-comunes.md`
