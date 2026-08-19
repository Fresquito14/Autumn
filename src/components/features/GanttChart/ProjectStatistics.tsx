import { Calendar, CalendarCheck, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useProjectStatistics } from '@/hooks/useProjectStatistics'
import { cn } from '@/lib/utils'

export function ProjectStatistics() {
  const stats = useProjectStatistics()

  if (stats.status === 'no-data') {
    return (
      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
          <span>Planificado: <strong className="font-semibold text-foreground">{stats.plannedDuration}d</strong></span>
        </div>
        <span className="text-muted-foreground/40 hidden sm:inline">•</span>
        <span className="italic text-muted-foreground/80 text-[11px]">Sin datos de avance real</span>
      </div>
    )
  }

  const getStatusBadgeStyle = () => {
    switch (stats.status) {
      case 'ahead':
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
      case 'behind':
        return 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
      case 'on-track':
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
      default:
        return 'bg-muted text-muted-foreground border-transparent'
    }
  }

  const getStatusIcon = () => {
    switch (stats.status) {
      case 'ahead':
        return <TrendingDown className="h-3.5 w-3.5 shrink-0" />
      case 'behind':
        return <TrendingUp className="h-3.5 w-3.5 shrink-0" />
      case 'on-track':
        return <Minus className="h-3.5 w-3.5 shrink-0" />
      default:
        return null
    }
  }

  const getStatusText = () => {
    const absDiff = Math.abs(stats.difference)
    switch (stats.status) {
      case 'ahead':
        return `-${absDiff}d adelantado`
      case 'behind':
        return `+${absDiff}d retrasado`
      case 'on-track':
        return 'En plazo'
      default:
        return ''
    }
  }

  return (
    <div className="flex items-center gap-3.5 flex-wrap">
      {/* Planned Duration */}
      <div className="flex items-center gap-1.5 text-xs">
        <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
        <span className="text-muted-foreground">Plan:</span>
        <span className="font-semibold text-foreground">{stats.plannedDuration}d</span>
      </div>

      {/* Actual Duration */}
      {stats.actualDuration > 0 && (
        <div className="flex items-center gap-1.5 text-xs">
          <CalendarCheck className="h-3.5 w-3.5 text-muted-foreground/70" />
          <span className="text-muted-foreground">Real:</span>
          <span className="font-semibold text-foreground">{stats.actualDuration}d</span>
        </div>
      )}

      {/* Status Badge */}
      <div
        className={cn(
          'flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border',
          getStatusBadgeStyle()
        )}
      >
        {getStatusIcon()}
        <span>{getStatusText()}</span>
      </div>
    </div>
  )
}
