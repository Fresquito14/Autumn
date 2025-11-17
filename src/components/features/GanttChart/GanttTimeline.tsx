import { generateTimelineScale, calculateTimelineDimensions } from '@/lib/calculations/dates'
import { addDays } from 'date-fns'
import { cn } from '@/lib/utils'

interface GanttTimelineProps {
  startDate: Date
  endDate: Date
  width: number
}

export function GanttTimeline({ startDate, endDate, width }: GanttTimelineProps) {
  const weeks = generateTimelineScale(startDate, endDate, 'week')

  // Use centralized function for consistent calculation
  const { totalDays, normalizedStart } = calculateTimelineDimensions(startDate, endDate, width)

  // Generate day information using normalized dates
  const days = Array.from({ length: totalDays }, (_, i) => {
    const date = addDays(normalizedStart, i)
    const dayOfWeek = date.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 // Sunday = 0, Saturday = 6
    return { date, dayOfWeek, isWeekend }
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
