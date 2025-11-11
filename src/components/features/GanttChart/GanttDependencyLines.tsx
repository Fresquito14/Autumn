import { useCriticalPath } from '@/hooks/useCriticalPath'
import { useTasks } from '@/hooks/useTasks'
import { calculateTaskProgress } from '@/lib/utils/progress'
import type { Dependency, Task } from '@/types'

interface GanttDependencyLinesProps {
  dependencies: Dependency[]
  tasks: Task[]
  timelineStart: Date
  timelineEnd: Date
  containerWidth: number
  rowHeight: number
  getTaskPosition: (taskId: string) => { left: number; width: number; top: number } | null
}

export function GanttDependencyLines({
  dependencies,
  tasks,
  timelineStart,
  timelineEnd,
  containerWidth,
  rowHeight,
  getTaskPosition,
}: GanttDependencyLinesProps) {
  const { isTaskCritical } = useCriticalPath()

  if (dependencies.length === 0) return null

  // Calculate total height needed for SVG
  const totalHeight = tasks.length * rowHeight

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none"
      style={{
        width: containerWidth,
        height: totalHeight,
        zIndex: 1,
      }}
    >
      <defs>
        {/* Circle marker for normal dependencies */}
        <marker
          id="endpoint"
          markerWidth="6"
          markerHeight="6"
          refX="3"
          refY="3"
          markerUnits="strokeWidth"
        >
          <circle
            cx="3"
            cy="3"
            r="2"
            fill="hsl(var(--muted-foreground))"
            opacity="0.6"
          />
        </marker>

        {/* Circle marker for critical path dependencies */}
        <marker
          id="endpoint-critical"
          markerWidth="7"
          markerHeight="7"
          refX="3.5"
          refY="3.5"
          markerUnits="strokeWidth"
        >
          <circle
            cx="3.5"
            cy="3.5"
            r="2.5"
            fill="hsl(var(--autumn-critical))"
            opacity="0.9"
          />
        </marker>

        {/* Animated gradient for critical path flow */}
        <linearGradient id="criticalGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(var(--autumn-critical))" stopOpacity="0.4">
            <animate
              attributeName="stop-opacity"
              values="0.4;0.9;0.4"
              dur="2s"
              repeatCount="indefinite"
            />
          </stop>
          <stop offset="50%" stopColor="hsl(var(--autumn-critical))" stopOpacity="0.9">
            <animate
              attributeName="stop-opacity"
              values="0.9;0.4;0.9"
              dur="2s"
              repeatCount="indefinite"
            />
          </stop>
          <stop offset="100%" stopColor="hsl(var(--autumn-critical))" stopOpacity="0.4">
            <animate
              attributeName="stop-opacity"
              values="0.4;0.9;0.4"
              dur="2s"
              repeatCount="indefinite"
            />
          </stop>
        </linearGradient>
      </defs>

      {dependencies.map((dep) => {
        const predecessorPos = getTaskPosition(dep.predecessorId)
        const successorPos = getTaskPosition(dep.successorId)

        if (!predecessorPos || !successorPos) return null

        // Find predecessor and successor tasks
        const predecessorTask = tasks.find(t => t.id === dep.predecessorId)
        const successorTask = tasks.find(t => t.id === dep.successorId)

        if (!predecessorTask || !successorTask) return null

        // Calculate progress for both tasks
        const predecessorProgress = calculateTaskProgress(predecessorTask, tasks)
        const successorProgress = calculateTaskProgress(successorTask, tasks)

        // Check if both tasks in this dependency are critical AND not 100% complete
        const isPredecessorCritical = isTaskCritical(dep.predecessorId) && predecessorProgress < 100
        const isSuccessorCritical = isTaskCritical(dep.successorId) && successorProgress < 100
        const isCriticalDependency = isPredecessorCritical && isSuccessorCritical

        // Start point: right edge of predecessor bar, middle height
        const startX = predecessorPos.left + predecessorPos.width
        const startY = predecessorPos.top + rowHeight / 2

        // End point: left edge of successor bar, middle height
        const endX = successorPos.left
        const endY = successorPos.top + rowHeight / 2

        // Calculate path with smooth curves
        // For Finish-to-Start (FS) dependency: horizontal → vertical → horizontal
        const midX = startX + (endX - startX) / 2
        const cornerRadius = 8 // Radius for smooth corners

        // Create path with quadratic bezier curves for smooth corners
        const path = `
          M ${startX} ${startY}
          L ${midX - cornerRadius} ${startY}
          Q ${midX} ${startY} ${midX} ${startY + (endY > startY ? cornerRadius : -cornerRadius)}
          L ${midX} ${endY - (endY > startY ? cornerRadius : -cornerRadius)}
          Q ${midX} ${endY} ${midX + cornerRadius} ${endY}
          L ${endX} ${endY}
        `

        return (
          <g key={dep.id}>
            {/* Main dependency line */}
            <path
              d={path}
              stroke={isCriticalDependency ? "url(#criticalGradient)" : "hsl(var(--muted-foreground))"}
              strokeWidth={isCriticalDependency ? "3" : "2"}
              fill="none"
              opacity={isCriticalDependency ? "1" : "0.6"}
              markerEnd={isCriticalDependency ? "url(#endpoint-critical)" : "url(#endpoint)"}
              strokeDasharray={isCriticalDependency ? "8 4" : "none"}
            >
              {/* Animate the stroke dash offset for flow effect on critical paths */}
              {isCriticalDependency && (
                <animate
                  attributeName="stroke-dashoffset"
                  values="12;0"
                  dur="1s"
                  repeatCount="indefinite"
                />
              )}
            </path>
          </g>
        )
      })}
    </svg>
  )
}
