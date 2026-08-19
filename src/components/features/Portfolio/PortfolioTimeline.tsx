import { useState, useEffect, useMemo, useRef } from 'react'
import { Calendar, PartyPopper, ArrowRight, BarChart3, ChevronDown, ChevronUp } from 'lucide-react'
import { db } from '@/lib/storage/db'
import { supabase } from '@/lib/supabase/client'
import { supabaseSyncService } from '@/lib/supabase/db_service'
import type { Project, Task, Milestone } from '@/types'
import { Button } from '@/components/ui/button'
import { calculateTaskProgress } from '@/lib/utils/progress'
import { 
  format, 
  addDays, 
  differenceInDays, 
  startOfMonth, 
  endOfMonth, 
  addMonths, 
  subMonths, 
  startOfWeek, 
  endOfWeek, 
  addWeeks, 
  getWeek 
} from 'date-fns'
import { es } from 'date-fns/locale'

interface PortfolioTimelineProps {
  onOpenProject: (project: Project) => void
}

const PHASE_COLORS = [
  {
    bg: 'hsla(217, 91%, 60%, 0.12)', // Blue
    border: 'hsl(217, 91%, 60%)',
    text: 'hsl(217, 91%, 60%)',
    progressBg: 'hsl(217, 91%, 60%)'
  },
  {
    bg: 'hsla(142, 71%, 45%, 0.12)', // Emerald
    border: 'hsl(142, 71%, 45%)',
    text: 'hsl(142, 71%, 45%)',
    progressBg: 'hsl(142, 71%, 45%)'
  },
  {
    bg: 'hsla(38, 92%, 50%, 0.12)', // Amber
    border: 'hsl(38, 92%, 50%)',
    text: 'hsl(38, 92%, 50%)',
    progressBg: 'hsl(38, 92%, 50%)'
  },
  {
    bg: 'hsla(262, 83%, 58%, 0.12)', // Purple
    border: 'hsl(262, 83%, 58%)',
    text: 'hsl(262, 83%, 58%)',
    progressBg: 'hsl(262, 83%, 58%)'
  },
  {
    bg: 'hsla(340, 82%, 52%, 0.12)', // Rose
    border: 'hsl(340, 82%, 52%)',
    text: 'hsl(340, 82%, 52%)',
    progressBg: 'hsl(340, 82%, 52%)'
  },
  {
    bg: 'hsla(239, 84%, 67%, 0.12)', // Indigo
    border: 'hsl(239, 84%, 67%)',
    text: 'hsl(239, 84%, 67%)',
    progressBg: 'hsl(239, 84%, 67%)'
  }
]

export function PortfolioTimeline({ onOpenProject }: PortfolioTimelineProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [allMilestones, setAllMilestones] = useState<Milestone[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Timeline scale and navigation state
  const [dayWidth, setDayWidth] = useState(15) // Width of a single day in pixels
  const [timelineStart, setTimelineStart] = useState<Date>(() => startOfWeek(subMonths(new Date(), 1), { weekStartsOn: 1 }))
  const [timelineEnd, setTimelineEnd] = useState<Date>(() => endOfWeek(addMonths(new Date(), 3), { weekStartsOn: 1 }))

  const containerRef = useRef<HTMLDivElement>(null)
  
  // Collapsible project subphases state
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(new Set())

  const toggleExpandProject = (projectId: string) => {
    setExpandedProjectIds(prev => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }

  // Load portfolio data from Dexie and sync with cloud, reactively subscribing to updates
  useEffect(() => {
    let isMounted = true

    async function loadData(showLoading = true) {
      if (showLoading) setIsLoading(true)
      try {
        // Try syncing from cloud first so Roadmap has complete task data
        try {
          await supabaseSyncService.fetchAllProjectsFromCloud()
        } catch (cloudErr) {
          console.warn('Cloud sync skipped in PortfolioTimeline:', cloudErr)
        }

        const [projList, taskList, msList] = await Promise.all([
          db.projects.toArray(),
          db.tasks.toArray(),
          db.milestones.toArray()
        ])
        if (isMounted) {
          setProjects(projList)
          setAllTasks(taskList)
          setAllMilestones(msList)
        }
      } catch (err) {
        console.error('Error loading portfolio data:', err)
      } finally {
        if (isMounted && showLoading) {
          setIsLoading(false)
        }
      }
    }

    loadData(true)

    // Supabase Realtime channel subscription for live updates across users
    const channel = supabase
      .channel('portfolio-live-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        () => {
          loadData(false)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => {
          loadData(false)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'milestones' },
        () => {
          loadData(false)
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
  }, [])

  // Process data to calculate date ranges and statistics for each project
  const processedProjects = useMemo(() => {
    return projects.map(project => {
      const projectTasks = allTasks.filter(t => t.projectId === project.id)
      const projectMilestones = allMilestones.filter(m => m.projectId === project.id)

      // Calculate start and end date from tasks, fallback to project config if no tasks exist
      let startDate = new Date(project.startDate)
      let endDate = addDays(startDate, 30)

      if (projectTasks.length > 0) {
        const starts = projectTasks.map(t => new Date(t.startDate).getTime()).filter(t => !isNaN(t))
        const ends = projectTasks.map(t => new Date(t.endDate).getTime()).filter(t => !isNaN(t))
        if (starts.length > 0) startDate = new Date(Math.min(...starts))
        if (ends.length > 0) endDate = new Date(Math.max(...ends))
      }

      // Root tasks represent the project phases
      const rootTasks = projectTasks
        .filter(t => !t.parentId)
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())

      // Average progress of root tasks (overall project progress)
      const progress = rootTasks.length > 0
        ? rootTasks.reduce((sum, t) => sum + calculateTaskProgress(t, projectTasks), 0) / rootTasks.length
        : 0

      return {
        ...project,
        startDate,
        endDate,
        progress,
        phases: rootTasks.map((task, index) => ({
          id: task.id,
          name: task.name,
          startDate: new Date(task.startDate),
          endDate: new Date(task.endDate),
          progress: calculateTaskProgress(task, projectTasks),
          colorIndex: index
        })),
        milestones: projectMilestones
      }
    })
  }, [projects, allTasks, allMilestones])

  // Automatically adjust timeline boundaries to encompass all projects
  useEffect(() => {
    if (processedProjects.length === 0) return

    const allDates = processedProjects.flatMap(p => [p.startDate, p.endDate])
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())))
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())))

    if (!isNaN(minDate.getTime()) && !isNaN(maxDate.getTime())) {
      setTimelineStart(startOfWeek(subMonths(minDate, 1), { weekStartsOn: 1 }))
      setTimelineEnd(endOfWeek(addMonths(maxDate, 2), { weekStartsOn: 1 }))
    }
  }, [projects.length])

  // Calculate timeline headers (months and weeks)
  const { monthHeaders, weekHeaders, timelineWidth } = useMemo(() => {
    const days = differenceInDays(timelineEnd, timelineStart) + 1
    const width = days * dayWidth

    // Generate month headers
    const months: { label: string; width: number; key: string }[] = []
    let currentMonth = startOfMonth(timelineStart)

    while (currentMonth <= timelineEnd) {
      const monthEnd = endOfMonth(currentMonth)
      const visibleStart = currentMonth < timelineStart ? timelineStart : currentMonth
      const visibleEnd = monthEnd > timelineEnd ? timelineEnd : monthEnd
      const monthDays = differenceInDays(visibleEnd, visibleStart) + 1

      if (monthDays > 0) {
        months.push({
          label: format(currentMonth, 'MMMM yyyy', { locale: es }),
          width: monthDays * dayWidth,
          key: format(currentMonth, 'yyyy-MM')
        })
      }

      currentMonth = addMonths(currentMonth, 1)
    }

    // Generate week headers
    const weeks: { label: string; width: number; key: string; date: Date }[] = []
    let currentWeek = startOfWeek(timelineStart, { weekStartsOn: 1 })

    while (currentWeek <= timelineEnd) {
      const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 })
      const visibleStart = currentWeek < timelineStart ? timelineStart : currentWeek
      const visibleEnd = weekEnd > timelineEnd ? timelineEnd : weekEnd
      const weekDays = differenceInDays(visibleEnd, visibleStart) + 1

      if (weekDays > 0) {
        weeks.push({
          label: `S${getWeek(currentWeek, { weekStartsOn: 1, firstWeekContainsDate: 4 })}`,
          width: weekDays * dayWidth,
          key: format(currentWeek, 'yyyy-MM-dd'),
          date: currentWeek
        })
      }

      currentWeek = addWeeks(currentWeek, 1)
    }

    return { monthHeaders: months, weekHeaders: weeks, timelineWidth: width }
  }, [timelineStart, timelineEnd, dayWidth])

  // Calculate current date position
  const todayLeft = useMemo(() => {
    const today = new Date()
    if (today < timelineStart || today > timelineEnd) return null
    return differenceInDays(today, timelineStart) * dayWidth
  }, [timelineStart, timelineEnd, dayWidth])

  // Navigation handlers
  const handleShiftTimeline = (months: number) => {
    setTimelineStart(prev => addMonths(prev, months))
    setTimelineEnd(prev => addMonths(prev, months))
  }

  const handleCenterOnToday = () => {
    const today = new Date()
    setTimelineStart(startOfWeek(subMonths(today, 1), { weekStartsOn: 1 }))
    setTimelineEnd(endOfWeek(addMonths(today, 3), { weekStartsOn: 1 }))

    if (containerRef.current && todayLeft) {
      containerRef.current.scrollLeft = todayLeft - containerRef.current.clientWidth / 2
    }
  }

  if (isLoading && projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        Cargando portfolio de proyectos...
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
        <Calendar className="h-16 w-16 text-muted-foreground opacity-50" />
        <h3 className="text-xl font-semibold">No hay proyectos para mostrar</h3>
        <p className="text-muted-foreground max-w-md">
          Crea tu primer proyecto en la pantalla principal para poder visualizar el roadmap del portfolio.
        </p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            Roadmap del Portfolio
          </h1>
          <p className="text-muted-foreground mt-1">
            Línea temporal consolidada y fases de todos los proyectos en curso
          </p>
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleShiftTimeline(-1)}>
            Anterior
          </Button>
          <Button variant="outline" size="sm" onClick={handleCenterOnToday}>
            Hoy
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleShiftTimeline(1)}>
            Siguiente
          </Button>

          {/* Zoom controls */}
          <div className="border rounded-md flex items-center overflow-hidden ml-2">
            <button
              onClick={() => setDayWidth(Math.max(6, dayWidth - 3))}
              className="px-3 py-1.5 text-xs hover:bg-muted font-mono transition-colors border-r"
              title="Alejar zoom"
            >
              -
            </button>
            <span className="px-2 text-xs text-muted-foreground select-none font-medium">
              Zoom
            </span>
            <button
              onClick={() => setDayWidth(Math.min(40, dayWidth + 3))}
              className="px-3 py-1.5 text-xs hover:bg-muted font-mono transition-colors border-l"
              title="Acercar zoom"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Main Gantt-style Timeline Container */}
      <div className="border rounded-xl bg-card shadow-sm overflow-hidden flex flex-col">
        {/* Scrollable Timeline Area */}
        <div ref={containerRef} className="overflow-x-auto overflow-y-hidden select-none">
          <div style={{ width: `${timelineWidth + 320}px` }} className="flex flex-col">
            
            {/* Timeline Header (Months + Weeks) */}
            <div className="sticky top-0 z-30 bg-card border-b">
              {/* Months line */}
              <div className="flex h-9 items-center border-b bg-muted/30">
                <div className="w-80 flex-shrink-0 border-r bg-background h-full flex items-center px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider sticky left-0 z-40 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)]">
                  Proyectos ({processedProjects.length})
                </div>
                <div className="flex">
                  {monthHeaders.map(month => (
                    <div
                      key={month.key}
                      className="border-r h-full flex items-center justify-center text-xs font-semibold text-foreground/80 capitalize"
                      style={{ width: `${month.width}px` }}
                    >
                      {month.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Weeks line */}
              <div className="flex h-7 items-center bg-muted/10">
                <div className="w-80 flex-shrink-0 border-r bg-background/50 h-full flex items-center px-4 font-medium text-xs text-muted-foreground/60 sticky left-0 z-40">
                  Progreso y Acciones
                </div>
                <div className="flex">
                  {weekHeaders.map(week => (
                    <div
                      key={week.key}
                      className="border-r h-full flex items-center justify-center text-[10px] text-muted-foreground/50 font-medium"
                      style={{ width: `${week.width}px` }}
                    >
                      {week.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Timeline Body */}
            <div className="min-w-max">
              {processedProjects.map(project => {
                const isExpanded = expandedProjectIds.has(project.id)
                const projectTasks = allTasks.filter(t => t.projectId === project.id)

                return (
                  <div key={project.id} className="flex flex-col">
                    {/* Project Row */}
                    <div className="flex border-b hover:bg-muted/10 transition-colors h-16 items-center">
                      {/* Left Column: Project Overview card (Sticky left) */}
                      <div className="w-80 flex-shrink-0 px-4 border-r bg-background flex flex-col justify-center h-full sticky left-0 z-20 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)]">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            {project.phases.length > 0 && (
                              <button
                                onClick={() => toggleExpandProject(project.id)}
                                className="p-1 hover:bg-muted rounded text-muted-foreground transition-colors flex-shrink-0"
                                title={isExpanded ? "Contraer subfases" : "Expandir subfases"}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </button>
                            )}
                            <span className="font-semibold text-sm truncate max-w-[150px]" title={project.name}>
                              {project.name}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-primary h-7 px-2 hover:bg-primary/10 flex items-center gap-1 flex-shrink-0"
                            onClick={() => onOpenProject(project)}
                          >
                            Gantt <ArrowRight className="h-3 w-3" />
                          </Button>
                        </div>
                        {/* Project progress */}
                        <div className="flex items-center gap-2 mt-1 pl-7">
                          <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-autumn-progress h-full transition-all"
                              style={{ width: `${project.progress}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-muted-foreground w-8 text-right">
                            {Math.round(project.progress)}%
                          </span>
                        </div>
                      </div>

                      {/* Right Column: Floating phase segments and milestones */}
                      <div className="flex-grow h-full relative" style={{ width: `${timelineWidth}px` }}>
                        {/* Background Grid Lines */}
                        <div className="absolute inset-0 pointer-events-none flex">
                          {weekHeaders.map(week => (
                            <div
                              key={`grid-${week.key}`}
                              className="h-full border-r border-muted/20 flex-shrink-0"
                              style={{ width: `${week.width}px` }}
                            />
                          ))}
                        </div>

                        {/* Today line */}
                        {todayLeft !== null && (
                          <div
                            className="absolute top-0 bottom-0 border-l-2 border-dashed border-sky-500/40 z-10 pointer-events-none"
                            style={{ left: `${todayLeft}px` }}
                          />
                        )}

                        {/* Project Phase Blocks */}
                        {project.phases.map(phase => {
                          const left = differenceInDays(phase.startDate, timelineStart) * dayWidth
                          const width = (differenceInDays(phase.endDate, phase.startDate) + 1) * dayWidth
                          const color = PHASE_COLORS[phase.colorIndex % PHASE_COLORS.length]

                          // Skip rendering if out of range
                          if (left + width < 0 || left > timelineWidth) return null

                          return (
                            <div
                              key={phase.id}
                              className="absolute rounded border px-2 flex items-center justify-between group cursor-pointer hover:scale-[1.01] hover:brightness-105 overflow-hidden shadow-sm"
                              style={{
                                left: `${left}px`,
                                width: `${Math.max(25, width)}px`,
                                height: '32px',
                                top: '12px',
                                backgroundColor: color.bg,
                                borderColor: color.border,
                                transition: 'left 300ms cubic-bezier(0.4, 0, 0.2, 1), width 300ms cubic-bezier(0.4, 0, 0.2, 1)',
                              }}
                              onClick={() => onOpenProject(project)}
                            >
                              {/* Colored progress bar inside phase block */}
                              <div
                                className="absolute left-0 top-0 bottom-0 opacity-20 pointer-events-none transition-all"
                                style={{
                                  width: `${phase.progress}%`,
                                  backgroundColor: color.progressBg
                                }}
                              />

                              <span
                                className="text-xs font-bold truncate select-none z-10 w-full text-center"
                                style={{ color: color.text }}
                              >
                                {phase.name}
                              </span>

                              {/* Hover Tooltip for Phase */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                <div className="bg-popover text-popover-foreground px-3 py-2 rounded-md shadow-lg border text-xs whitespace-nowrap">
                                  <div className="font-semibold">{phase.name}</div>
                                  <div className="text-muted-foreground mt-0.5">
                                    {format(phase.startDate, 'dd MMM', { locale: es })} - {format(phase.endDate, 'dd MMM yyyy', { locale: es })}
                                  </div>
                                  <div className="text-autumn-progress font-semibold">Progreso: {Math.round(phase.progress)}%</div>
                                </div>
                              </div>
                            </div>
                          )
                        })}

                        {/* Milestones inline markers */}
                        {project.milestones.map(ms => {
                          const left = differenceInDays(new Date(ms.date), timelineStart) * dayWidth

                          // Skip rendering if out of range
                          if (left < 0 || left > timelineWidth) return null

                          return (
                            <div
                              key={ms.id}
                              className="absolute w-4 h-4 bg-autumn-critical border-2 border-popover rotate-45 flex items-center justify-center cursor-pointer group z-10 hover:scale-125"
                              style={{
                                left: `${left - 8}px`, // Center the diamond
                                top: '20px',
                                transition: 'left 300ms cubic-bezier(0.4, 0, 0.2, 1), transform 150ms ease',
                              }}
                              onClick={() => onOpenProject(project)}
                            >
                              {/* Milestone Tooltip */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 -rotate-45 origin-bottom">
                                <div className="bg-popover text-popover-foreground px-3 py-2 rounded-md shadow-lg border text-xs whitespace-nowrap">
                                  <div className="font-semibold flex items-center gap-1">
                                    <PartyPopper className="h-3 w-3 text-autumn-critical" />
                                    {ms.name} (Hito)
                                  </div>
                                  <div className="text-muted-foreground mt-0.5">
                                    Fecha: {format(new Date(ms.date), 'dd MMM yyyy', { locale: es })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Collapsible Subphase Rows (Level 2) */}
                    {isExpanded && project.phases.map(phase => {
                      const subPhases = projectTasks
                        .filter(t => t.parentId === phase.id)
                        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())

                      if (subPhases.length === 0) return null

                      return (
                        <div
                          key={`sub-${phase.id}`}
                          className="flex border-b bg-muted/5 hover:bg-muted/10 transition-colors h-14 items-center"
                        >
                          {/* Left Column: Subphase title card (Sticky) */}
                          <div className="w-80 flex-shrink-0 pl-11 pr-4 border-r bg-background/80 flex flex-col justify-center h-full sticky left-0 z-20 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] border-l-4 border-l-primary/40">
                            <span className="font-medium text-xs text-muted-foreground truncate" title={phase.name}>
                              ↳ Fase: {phase.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground/60 mt-0.5">
                              {subPhases.length} subfase{subPhases.length !== 1 ? 's' : ''}
                            </span>
                          </div>

                          {/* Right Column: Floating subphase blocks */}
                          <div className="flex-grow h-full relative" style={{ width: `${timelineWidth}px` }}>
                            {/* Subgrid Lines */}
                            <div className="absolute inset-0 pointer-events-none flex">
                              {weekHeaders.map(week => (
                                <div
                                  key={`sub-grid-${week.key}`}
                                  className="h-full border-r border-muted/10 flex-shrink-0"
                                  style={{ width: `${week.width}px` }}
                                />
                              ))}
                            </div>

                            {/* Floating subphase segments (level 2 tasks) */}
                            {subPhases.map((sub, _idx) => {
                              const left = differenceInDays(new Date(sub.startDate), timelineStart) * dayWidth
                              const width = (differenceInDays(new Date(sub.endDate), new Date(sub.startDate)) + 1) * dayWidth
                              const color = PHASE_COLORS[phase.colorIndex % PHASE_COLORS.length]

                              if (left + width < 0 || left > timelineWidth) return null

                              const subProgress = calculateTaskProgress(sub, projectTasks)

                              return (
                                <div
                                  key={sub.id}
                                  className="absolute rounded border px-2 flex items-center justify-between group cursor-pointer hover:scale-[1.01] hover:brightness-105 overflow-hidden shadow-xs"
                                  style={{
                                    left: `${left}px`,
                                    width: `${Math.max(25, width)}px`,
                                    height: '26px',
                                    top: '14px',
                                    backgroundColor: color.bg,
                                    borderColor: color.border,
                                    opacity: 0.85,
                                    transition: 'left 300ms cubic-bezier(0.4, 0, 0.2, 1), width 300ms cubic-bezier(0.4, 0, 0.2, 1)',
                                  }}
                                  onClick={() => onOpenProject(project)}
                                >
                                  {/* Inner Progress bar */}
                                  <div
                                    className="absolute left-0 top-0 bottom-0 opacity-15 pointer-events-none transition-all"
                                    style={{
                                      width: `${subProgress}%`,
                                      backgroundColor: color.progressBg
                                    }}
                                  />

                                  <span
                                    className="text-[11px] font-semibold truncate select-none z-10 w-full text-center"
                                    style={{ color: color.text }}
                                  >
                                    {sub.name}
                                  </span>

                                  {/* Subphase Tooltip */}
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                    <div className="bg-popover text-popover-foreground px-3 py-2 rounded-md shadow-lg border text-xs whitespace-nowrap">
                                      <div className="font-semibold">{sub.name}</div>
                                      <div className="text-muted-foreground mt-0.5">
                                        {format(new Date(sub.startDate), 'dd MMM', { locale: es })} - {format(new Date(sub.endDate), 'dd MMM yyyy', { locale: es })}
                                      </div>
                                      <div className="text-autumn-progress font-semibold">Progreso: {Math.round(subProgress)}%</div>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
