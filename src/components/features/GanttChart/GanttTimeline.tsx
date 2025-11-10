import { generateTimelineScale } from '@/lib/calculations/dates'

interface GanttTimelineProps {
  startDate: Date
  endDate: Date
  width: number
}

export function GanttTimeline({ startDate, endDate, width }: GanttTimelineProps) {
  const weeks = generateTimelineScale(startDate, endDate, 'week')

  return (
    <div className="border-b bg-muted/30 sticky top-0 z-10">
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

      {/* Day grid (visual reference) */}
      <div className="h-4 flex">
        {Array.from({ length: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) }).map((_, i) => (
          <div
            key={i}
            className="border-r last:border-r-0 border-muted"
            style={{ width: `${100 / weeks.reduce((sum, w) => sum + (w.width / 100) * weeks.length, 0)}%` }}
          />
        ))}
      </div>
    </div>
  )
}
