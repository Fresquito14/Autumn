import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Task } from '@/types'
import { cn } from '@/lib/utils'

interface GanttTaskBarProps {
  task: Task
  left: number
  width: number
  rowHeight: number
}

export function GanttTaskBar({ task, left, width, rowHeight }: GanttTaskBarProps) {
  const barHeight = rowHeight * 0.6
  const barTop = (rowHeight - barHeight) / 2

  return (
    <div
      className="absolute group cursor-pointer"
      style={{
        left: `${left}px`,
        width: `${width}px`,
        top: `${barTop}px`,
        height: `${barHeight}px`,
      }}
    >
      {/* Task Bar */}
      <div
        className={cn(
          'h-full rounded-md shadow-sm transition-all',
          'bg-primary hover:bg-primary/90',
          'border border-primary-foreground/10'
        )}
      >
        {/* Task Name (if bar is wide enough) */}
        {width > 100 && (
          <div className="px-2 h-full flex items-center">
            <span className="text-xs font-medium text-primary-foreground truncate">
              {task.name}
            </span>
          </div>
        )}
      </div>

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
        <div className="bg-popover text-popover-foreground px-3 py-2 rounded-md shadow-lg border text-sm whitespace-nowrap">
          <div className="font-semibold">{task.wbsCode} - {task.name}</div>
          <div className="text-muted-foreground text-xs mt-1">
            {format(task.startDate, 'dd MMM', { locale: es })} - {format(task.endDate, 'dd MMM yyyy', { locale: es })}
          </div>
          <div className="text-muted-foreground text-xs">
            Duración: {task.duration} {task.duration === 1 ? 'día' : 'días'}
          </div>
        </div>
      </div>
    </div>
  )
}
