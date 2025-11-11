import { generateTimelineScale } from '@/lib/calculations/dates'
import { addDays } from 'date-fns'
import { cn } from '@/lib/utils'

interface GanttTimelineProps {
  startDate: Date
  endDate: Date
  width: number
}

export function GanttTimeline({ startDate, endDate, width }: GanttTimelineProps) {
  const weeks = generateTimelineScale(startDate, endDate, 'week')

  // Calculate total days
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  const dayWidth = width / totalDays

  // Generate day information
  const days = Array.from({ length: totalDays }, (_, i) => {
    const date = addDays(startDate, i)
    // Normalize to avoid timezone issues
    const normalized = new Date(date)
    normalized.setHours(12, 0, 0, 0)
    const dayOfWeek = normalized.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 // Sunday = 0, Saturday = 6
    return { date: normalized, dayOfWeek, isWeekend }
  })

  return (
    <div className="border-b bg-muted/30 sticky top-0 z-10" style={{ width: `${width}px` }}>
      {/* Weeks */}
      <div className="flex h-10 border-b">
        {weeks.map((week, index) => (
          <div
            key={index}
            className="border-r last:border-r-0 flex items-center justify-center text-xs font-medium"
            style={{ width: `${week.width}%` }}
          >
            {week.label}
          </div>
        ))}
      </div>

      {/* Day grid (visual reference with weekend highlighting) */}
      <div className="h-4 flex">
        {days.map((day, i) => (
          <div
            key={i}
            className={cn(
              "border-r last:border-r-0 border-muted",
              day.isWeekend && "bg-muted-foreground/10"
            )}
            style={{ width: `${dayWidth}px` }}
            title={day.date.toLocaleDateString()}
          />
        ))}
      </div>
    </div>
  )
}
