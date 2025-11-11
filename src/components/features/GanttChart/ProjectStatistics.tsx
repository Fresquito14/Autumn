import { Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useProjectStatistics } from '@/hooks/useProjectStatistics'
import { cn } from '@/lib/utils'

export function ProjectStatistics() {
  const stats = useProjectStatistics()

  if (stats.status === 'no-data') {
    return (
      <div className="flex items-center gap-4 px-4 py-2 border-b bg-muted/20">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>No hay datos de progreso real registrados</span>
        </div>
      </div>
    )
  }

  const getStatusColor = () => {
    switch (stats.status) {
      case 'ahead':
        return 'text-autumn-progress'
      case 'behind':
        return 'text-autumn-critical'
      case 'on-track':
        return 'text-autumn-accent'
      default:
        return 'text-muted-foreground'
    }
  }

  const getStatusIcon = () => {
    switch (stats.status) {
      case 'ahead':
        return <TrendingDown className="h-4 w-4" />
      case 'behind':
        return <TrendingUp className="h-4 w-4" />
      case 'on-track':
        return <Minus className="h-4 w-4" />
      default:
        return null
    }
  }

  const getStatusText = () => {
    const absDiff = Math.abs(stats.difference)
    switch (stats.status) {
      case 'ahead':
        return `${absDiff} días adelantado`
      case 'behind':
        return `${absDiff} días retrasado`
      case 'on-track':
        return 'En plazo'
      default:
        return ''
    }
  }

  return (
    <div className="flex items-center gap-6 px-4 py-2 border-b bg-muted/20">
      {/* Planned Duration */}
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">Planificado</span>
          <span className="text-sm font-medium">{stats.plannedDuration} días</span>
        </div>
      </div>

      {/* Actual Duration */}
      {stats.actualDuration > 0 && (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Real</span>
            <span className="text-sm font-medium">{stats.actualDuration} días</span>
          </div>
        </div>
      )}

      {/* Status */}
      <div className={cn('flex items-center gap-2', getStatusColor())}>
        {getStatusIcon()}
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">Estado</span>
          <span className="text-sm font-medium">{getStatusText()}</span>
        </div>
      </div>
    </div>
  )
}
