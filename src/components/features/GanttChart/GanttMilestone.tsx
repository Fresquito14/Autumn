import { format } from 'date-fns'
import type { Milestone } from '@/types'

interface GanttMilestoneProps {
  milestone: Milestone
  left: number
  totalHeight: number
  rowHeight: number
}

export function GanttMilestone({ milestone, left, totalHeight, rowHeight }: GanttMilestoneProps) {
  const diamondSize = 12 // Size of the diamond marker

  return (
    <div
      className="absolute pointer-events-auto"
      style={{
        left: `${left}px`,
        top: 0,
        height: totalHeight,
        zIndex: 3, // Above task bars but below dependency lines
      }}
    >
      {/* Vertical dashed line */}
      <div
        className="absolute top-0 bottom-0 border-l-2 border-dashed border-primary/40"
        style={{
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      />

      {/* Diamond marker at the top */}
      <div
        className="absolute top-2 left-1/2 -translate-x-1/2"
        title={`${milestone.name}\n${format(milestone.date, 'dd/MM/yyyy')}${milestone.description ? `\n${milestone.description}` : ''}`}
      >
        <svg
          width={diamondSize}
          height={diamondSize}
          viewBox="0 0 12 12"
          className="drop-shadow-md"
        >
          <path
            d="M 6 0 L 12 6 L 6 12 L 0 6 Z"
            fill="hsl(var(--primary))"
            stroke="hsl(var(--background))"
            strokeWidth="1.5"
          />
        </svg>
      </div>

      {/* Milestone name label */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap shadow-md"
        style={{
          marginTop: `${diamondSize + 8}px`,
        }}
      >
        {milestone.name}
      </div>
    </div>
  )
}
