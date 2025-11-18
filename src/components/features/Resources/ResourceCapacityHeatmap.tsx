import { useMemo } from 'react'
import { startOfWeek, addWeeks, format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Resource, TaskResourceAssignment } from '@/types'
import { getWeekKey } from '@/lib/calculations/resources'
import { cn } from '@/lib/utils'

interface ResourceCapacityHeatmapProps {
  resources: Resource[]
  assignments: TaskResourceAssignment[]
  startDate: Date
  weekCount?: number // Number of weeks to display
}

interface WeekCapacity {
  weekKey: string
  weekStart: Date
  totalCapacity: number
  allocatedHours: number
  utilizationPercent: number
}

export function ResourceCapacityHeatmap({
  resources,
  assignments,
  startDate,
  weekCount = 12
}: ResourceCapacityHeatmapProps) {
  // Calculate capacity data per resource per week
  const capacityData = useMemo(() => {
    const data: Record<string, Record<string, WeekCapacity>> = {}

    // Generate week keys
    const weeks: string[] = []
    for (let i = 0; i < weekCount; i++) {
      const weekStart = addWeeks(startOfWeek(startDate, { weekStartsOn: 1 }), i)
      const weekKey = getWeekKey(weekStart)
      weeks.push(weekKey)
    }

    // Initialize data structure for each resource
    resources.forEach(resource => {
      data[resource.id] = {}

      weeks.forEach(weekKey => {
        const weekStart = addWeeks(startOfWeek(startDate, { weekStartsOn: 1 }), weeks.indexOf(weekKey))
        data[resource.id][weekKey] = {
          weekKey,
          weekStart,
          totalCapacity: resource.maxHoursPerWeek,
          allocatedHours: 0,
          utilizationPercent: 0
        }
      })
    })

    // Calculate allocated hours from assignments
    assignments.forEach(assignment => {
      assignment.weeklyDistribution.forEach(week => {
        const weekKey = getWeekKey(week.weekStart)

        if (data[assignment.resourceId] && data[assignment.resourceId][weekKey]) {
          data[assignment.resourceId][weekKey].allocatedHours += week.plannedHours
        }
      })
    })

    // Calculate utilization percentages
    Object.keys(data).forEach(resourceId => {
      Object.keys(data[resourceId]).forEach(weekKey => {
        const weekData = data[resourceId][weekKey]
        weekData.utilizationPercent = Math.round(
          (weekData.allocatedHours / weekData.totalCapacity) * 100
        )
      })
    })

    return { data, weeks }
  }, [resources, assignments, startDate, weekCount])

  // Get color class based on utilization
  const getUtilizationColor = (percent: number) => {
    if (percent === 0) return 'bg-muted'
    if (percent <= 50) return 'bg-green-200 dark:bg-green-900'
    if (percent <= 75) return 'bg-yellow-200 dark:bg-yellow-900'
    if (percent <= 100) return 'bg-orange-200 dark:bg-orange-900'
    return 'bg-red-300 dark:bg-red-900' // Over capacity
  }

  const getUtilizationLabel = (percent: number) => {
    if (percent === 0) return 'Sin asignar'
    if (percent <= 50) return 'Baja carga'
    if (percent <= 75) return 'Carga media'
    if (percent <= 100) return 'Alta carga'
    return 'Sobreasignado'
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs">
        <span className="font-medium">Utilización:</span>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-muted border rounded" />
          <span>0%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-200 dark:bg-green-900 border rounded" />
          <span>1-50%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-200 dark:bg-yellow-900 border rounded" />
          <span>51-75%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-orange-200 dark:bg-orange-900 border rounded" />
          <span>76-100%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-300 dark:bg-red-900 border rounded" />
          <span>&gt;100%</span>
        </div>
      </div>

      {/* Heatmap */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Week headers */}
          <div className="flex">
            <div className="w-48 flex-shrink-0 p-2 font-medium border-b">
              Recurso
            </div>
            {capacityData.weeks.map((weekKey, i) => {
              const weekStart = addWeeks(startOfWeek(startDate, { weekStartsOn: 1 }), i)
              return (
                <div
                  key={weekKey}
                  className="w-20 flex-shrink-0 p-2 text-center text-xs font-medium border-b border-l"
                >
                  {format(weekStart, 'dd MMM', { locale: es })}
                </div>
              )
            })}
          </div>

          {/* Resource rows */}
          {resources.map(resource => (
            <div key={resource.id} className="flex border-b hover:bg-muted/50">
              <div className="w-48 flex-shrink-0 p-2 border-r">
                <div className="font-medium text-sm">{resource.name}</div>
                <div className="text-xs text-muted-foreground">
                  {resource.maxHoursPerWeek}h/semana
                </div>
              </div>
              {capacityData.weeks.map(weekKey => {
                const weekData = capacityData.data[resource.id][weekKey]
                return (
                  <div
                    key={weekKey}
                    className={cn(
                      'w-20 flex-shrink-0 p-2 border-l group relative cursor-help',
                      getUtilizationColor(weekData.utilizationPercent)
                    )}
                  >
                    <div className="text-center text-xs font-medium">
                      {weekData.utilizationPercent}%
                    </div>
                    <div className="text-center text-xs text-muted-foreground">
                      {weekData.allocatedHours}h
                    </div>

                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      <div className="bg-popover text-popover-foreground px-3 py-2 rounded-md shadow-lg border text-xs whitespace-nowrap">
                        <div className="font-semibold">{resource.name}</div>
                        <div className="text-muted-foreground">
                          Semana {format(weekData.weekStart, 'dd MMM', { locale: es })}
                        </div>
                        <div className="mt-1 space-y-1">
                          <div>Capacidad: {weekData.totalCapacity}h</div>
                          <div>Asignado: {weekData.allocatedHours}h</div>
                          <div>Utilización: {weekData.utilizationPercent}%</div>
                          <div className={cn(
                            'font-medium',
                            weekData.utilizationPercent > 100 && 'text-red-500'
                          )}>
                            {getUtilizationLabel(weekData.utilizationPercent)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}

          {resources.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              No hay recursos disponibles. Crea recursos para ver el mapa de capacidad.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
