import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Zap } from 'lucide-react'
import type { Task } from '@/types'
import { cn } from '@/lib/utils'
import { useCriticalPath } from '@/hooks/useCriticalPath'
import { useViewMode } from '@/hooks/useViewMode'
import { useTasks } from '@/hooks/useTasks'
import { calculateTaskProgress } from '@/lib/utils/progress'

interface GanttTaskBarProps {
  task: Task
  plannedLeft: number
  plannedWidth: number
  actualLeft: number
  actualWidth: number
  rowHeight: number
}

export function GanttTaskBar({
  task,
  plannedLeft,
  plannedWidth,
  actualLeft,
  actualWidth,
  rowHeight
}: GanttTaskBarProps) {
  const { isTaskCritical, getTaskCPM } = useCriticalPath()
  const { viewMode } = useViewMode()
  const { tasks } = useTasks()
  const isCritical = isTaskCritical(task.id)
  const taskCPM = getTaskCPM(task.id)

  const barHeight = rowHeight * 0.6
  const barTop = (rowHeight - barHeight) / 2

  // Adjust tasks for progress calculation in actual mode
  const adjustedTasks = viewMode === 'actual'
    ? tasks.map(t => {
        if (t.actualDuration !== undefined && t.actualDuration !== null) {
          return { ...t, duration: t.actualDuration }
        }
        return t
      })
    : tasks

  // Calculate task progress
  const progress = calculateTaskProgress(task, adjustedTasks)

  // Determine if task has actual progress
  const hasActualDuration = task.actualDuration !== undefined && task.actualDuration !== null

  return (
    <>
      {/* Planned Task Bar - always positioned at planned location */}
      <div
        className="absolute group cursor-pointer z-10"
        style={{
          left: `${plannedLeft}px`,
          width: `${plannedWidth}px`,
          minWidth: '20px',
          top: `${barTop}px`,
          height: `${barHeight}px`,
        }}
      >
        <div
          className={cn(
            'h-full rounded-md shadow-sm transition-all flex',
            viewMode === 'actual' && 'opacity-40',
            // Border color: green if 100% complete, critical if incomplete and critical, otherwise default
            progress === 100
              ? 'border-2 border-autumn-progress/20'
              : isCritical
              ? 'border-2 border-autumn-critical/20'
              : 'border border-primary-foreground/10'
          )}
        >
          {/* Completed portion (green) */}
          {progress > 0 && (
            <div
              className="h-full transition-colors flex items-center flex-shrink-0"
              style={{
                width: `${progress}%`,
                backgroundColor: 'hsl(153 98% 10%)',
                borderTopLeftRadius: '0.375rem',
                borderBottomLeftRadius: '0.375rem',
                borderTopRightRadius: progress === 100 ? '0.375rem' : '0',
                borderBottomRightRadius: progress === 100 ? '0.375rem' : '0'
              }}
            >
              {/* Task Name in completed portion - only if wide enough and in plan mode */}
              {viewMode === 'plan' && (plannedWidth * progress / 100) > 100 && (
                <div className="px-2 flex items-center gap-1 w-full">
                  {isCritical && progress < 100 && <Zap className="h-3 w-3" style={{ fill: 'white', color: 'white' }} />}
                  <span className="text-xs font-medium truncate" style={{ color: 'white' }}>
                    {task.name}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Remaining portion - only show if not 100% complete */}
          {progress < 100 && (
            <div
              className="h-full transition-colors flex items-center flex-grow"
              style={{
                backgroundColor: isCritical ? 'hsl(9 55% 14%)' : 'hsl(38 92% 50%)',
                borderTopLeftRadius: progress === 0 ? '0.375rem' : '0',
                borderBottomLeftRadius: progress === 0 ? '0.375rem' : '0',
                borderTopRightRadius: '0.375rem',
                borderBottomRightRadius: '0.375rem'
              }}
            >
              {/* Task Name in remaining portion - only if completed portion is too small or progress is 0 */}
              {viewMode === 'plan' && plannedWidth > 100 && (progress === 0 || (plannedWidth * progress / 100) <= 100) && (
                <div className="px-2 flex items-center gap-1 w-full">
                  {isCritical && <Zap className="h-3 w-3" style={{ fill: 'white', color: 'white' }} />}
                  <span className="text-xs font-medium truncate" style={{ color: 'white' }}>
                    {task.name}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tooltip - only on planned bar */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
          <div className="bg-popover text-popover-foreground px-3 py-2 rounded-md shadow-lg border text-sm whitespace-nowrap">
            <div className="font-semibold flex items-center gap-1">
              {isCritical && progress < 100 && <Zap className="h-3 w-3 text-autumn-critical fill-autumn-critical" />}
              {task.wbsCode} - {task.name}
              {isCritical && progress < 100 && <span className="text-autumn-critical ml-1">(CRÍTICO)</span>}
            </div>
            <div className="text-muted-foreground text-xs mt-1">
              {format(task.startDate, 'dd MMM', { locale: es })} - {format(task.endDate, 'dd MMM yyyy', { locale: es })}
            </div>
            <div className="text-muted-foreground text-xs">
              Duración planificada: {task.duration} {task.duration === 1 ? 'día' : 'días'}
            </div>
            {progress > 0 && (
              <div className="text-autumn-progress text-xs font-medium">
                Progreso: {progress}%
              </div>
            )}
            {hasActualDuration && task.actualDuration !== undefined && (
              <>
                <div className="text-muted-foreground text-xs">
                  Duración real: {task.actualDuration} {task.actualDuration === 1 ? 'día' : 'días'}
                </div>
                <div className={cn(
                  "text-xs font-medium",
                  task.actualDuration > task.duration ? "text-autumn-critical" : "text-autumn-progress"
                )}>
                  Variación: {task.actualDuration > task.duration ? '+' : ''}{task.actualDuration - task.duration} {Math.abs(task.actualDuration - task.duration) === 1 ? 'día' : 'días'}
                </div>
              </>
            )}
            {taskCPM && (
              <div className="text-muted-foreground text-xs">
                Holgura: {taskCPM.totalFloat} {taskCPM.totalFloat === 1 ? 'día' : 'días'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actual/Real Task Bar - only shown in actual mode */}
      {viewMode === 'actual' && (
        <div
          className="absolute group cursor-pointer z-10"
          style={{
            left: `${actualLeft}px`,
            width: `${actualWidth}px`,
            minWidth: '20px',
            top: `${barTop}px`,
            height: `${barHeight}px`,
          }}
        >
          <div
            className={cn(
              'h-full rounded-md shadow-sm transition-all flex',
              // Border color: green if 100% complete, critical if incomplete and critical, otherwise default
              progress === 100
                ? 'border-2 border-autumn-progress/20'
                : isCritical
                ? 'border-2 border-autumn-critical/20'
                : 'border border-primary-foreground/10'
            )}
          >
            {/* Completed portion (green) */}
            {progress > 0 && (
              <div
                className="h-full transition-colors flex items-center flex-shrink-0"
                style={{
                  width: `${progress}%`,
                  backgroundColor: 'hsl(153 98% 10%)',
                  borderTopLeftRadius: '0.375rem',
                  borderBottomLeftRadius: '0.375rem',
                  borderTopRightRadius: progress === 100 ? '0.375rem' : '0',
                  borderBottomRightRadius: progress === 100 ? '0.375rem' : '0'
                }}
              >
                {/* Task Name in completed portion - only if wide enough */}
                {(actualWidth * progress / 100) > 100 && (
                  <div className="px-2 flex items-center gap-1 w-full">
                    {isCritical && progress < 100 && <Zap className="h-3 w-3" style={{ fill: 'white', color: 'white' }} />}
                    <span className="text-xs font-medium truncate" style={{ color: 'white' }}>
                      {task.name}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Remaining portion - only show if not 100% complete */}
            {progress < 100 && (
              <div
                className="h-full transition-colors flex items-center flex-grow"
                style={{
                  backgroundColor: isCritical ? 'hsl(9 55% 14%)' : 'hsl(38 92% 50%)',
                  borderTopLeftRadius: progress === 0 ? '0.375rem' : '0',
                  borderBottomLeftRadius: progress === 0 ? '0.375rem' : '0',
                  borderTopRightRadius: '0.375rem',
                  borderBottomRightRadius: '0.375rem'
                }}
              >
                {/* Task Name in remaining portion - only if completed portion is too small or progress is 0 */}
                {actualWidth > 100 && (progress === 0 || (actualWidth * progress / 100) <= 100) && (
                  <div className="px-2 flex items-center gap-1 w-full">
                    {isCritical && <Zap className="h-3 w-3" style={{ fill: 'white', color: 'white' }} />}
                    <span className="text-xs font-medium truncate" style={{ color: 'white' }}>
                      {task.name}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tooltip - only on actual bar */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
            <div className="bg-popover text-popover-foreground px-3 py-2 rounded-md shadow-lg border text-sm whitespace-nowrap">
              <div className="font-semibold flex items-center gap-1">
                {isCritical && progress < 100 && <Zap className="h-3 w-3 text-autumn-critical fill-autumn-critical" />}
                {task.wbsCode} - {task.name}
                {isCritical && progress < 100 && <span className="text-autumn-critical ml-1">(CRÍTICO)</span>}
              </div>
              <div className="text-muted-foreground text-xs mt-1">
                {format(task.startDate, 'dd MMM', { locale: es })} - {format(task.endDate, 'dd MMM yyyy', { locale: es })}
              </div>
              <div className="text-muted-foreground text-xs">
                Duración planificada: {task.duration} {task.duration === 1 ? 'día' : 'días'}
              </div>
              {progress > 0 && (
                <div className="text-autumn-progress text-xs font-medium">
                  Progreso: {progress}%
                </div>
              )}
              {hasActualDuration && task.actualDuration !== undefined && (
                <>
                  <div className="text-muted-foreground text-xs">
                    Duración real: {task.actualDuration} {task.actualDuration === 1 ? 'día' : 'días'}
                  </div>
                  <div className={cn(
                    "text-xs font-medium",
                    task.actualDuration > task.duration ? "text-autumn-critical" : "text-autumn-progress"
                  )}>
                    Variación: {task.actualDuration > task.duration ? '+' : ''}{task.actualDuration - task.duration} {Math.abs(task.actualDuration - task.duration) === 1 ? 'día' : 'días'}
                  </div>
                </>
              )}
              {taskCPM && (
                <div className="text-muted-foreground text-xs">
                  Holgura: {taskCPM.totalFloat} {taskCPM.totalFloat === 1 ? 'día' : 'días'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
