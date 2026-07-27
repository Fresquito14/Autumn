import { generateTimelineScale, calculateTimelineDimensions } from '@/lib/calculations/dates'
import { addDays, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { ZoomLevel } from '@/hooks/useViewMode'

interface GanttTimelineProps {
  startDate: Date
  endDate: Date
  width: number
  zoomLevel: ZoomLevel
}

export function GanttTimeline({ startDate, endDate, width, zoomLevel }: GanttTimelineProps) {
  const scaleGranularity = zoomLevel === 'month' ? 'month' : 'week'
  const scaleItems = generateTimelineScale(startDate, endDate, scaleGranularity)

  // Use centralized function for consistent calculation
  const { totalDays, dayWidth, normalizedStart } = calculateTimelineDimensions(startDate, endDate, width)

  // Generate day information using normalized dates
  const days = Array.from({ length: totalDays }, (_, i) => {
    const date = addDays(normalizedStart, i)
    const dayOfWeek = date.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 // Sunday = 0, Saturday = 6
    return { date, dayOfWeek, isWeekend }
  })

  // Format day text dynamically based on column width
  const getDayLabel = (date: Date) => {
    if (dayWidth >= 45) {
      // E.g., "L 15"
      return `${format(date, 'EEEEE', { locale: es })} ${format(date, 'd')}`
    } else if (dayWidth >= 16) {
      // E.g., "L"
      return format(date, 'EEEEE', { locale: es })
    }
    return ''
  }

  return (
    <div className="border-b bg-muted/30 sticky top-0 z-10" style={{ width: `${width}px` }}>
      {/* Top scale (Weeks or Months) */}
      <div className="flex h-10 border-b">
        {scaleItems.map((item, index) => (
          <div
            key={index}
            className="border-r last:border-r-0 flex items-center justify-center text-xs font-semibold text-muted-foreground"
            style={{ width: `${item.width}%` }}
          >
            {item.label}
          </div>
        ))}
      </div>

      {/* Day grid (with labels if space allows) */}
      <div className="h-5 flex">
        {days.map((day, i) => (
          <div
            key={i}
            className={cn(
              "border-r last:border-r-0 border-muted flex items-center justify-center text-[9px] font-medium text-muted-foreground select-none",
              day.isWeekend && "bg-muted-foreground/10 text-destructive/70"
            )}
            style={{ width: `${dayWidth}px` }}
            title={day.date.toLocaleDateString()}
          >
            {getDayLabel(day.date)}
          </div>
        ))}
      </div>
    </div>
  )
}
