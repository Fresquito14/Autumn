import React from 'react'
import { CheckCircle2, Loader2, AlertCircle, AlertTriangle, RefreshCw, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AutosaveStatus } from '@/hooks/useAutosave'

interface AutosaveStatusIndicatorProps {
  status: AutosaveStatus
  lastSavedAt?: Date | null
  isReadOnly?: boolean
  onRetry?: () => void
}

export function AutosaveStatusIndicator({
  status,
  lastSavedAt,
  isReadOnly,
  onRetry,
}: AutosaveStatusIndicatorProps) {
  const [formattedTime, setFormattedTime] = React.useState<string>('')

  React.useEffect(() => {
    if (lastSavedAt) {
      const hours = lastSavedAt.getHours().toString().padStart(2, '0')
      const minutes = lastSavedAt.getMinutes().toString().padStart(2, '0')
      const seconds = lastSavedAt.getSeconds().toString().padStart(2, '0')
      setFormattedTime(`${hours}:${minutes}:${seconds}`)
    }
  }, [lastSavedAt])

  if (isReadOnly) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
        <Eye className="h-3.5 w-3.5" />
        <span>Modo Lectura (En Vivo)</span>
      </div>
    )
  }

  if (status === 'idle') return null

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-300',
        status === 'saved' &&
          'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30',
        status === 'saving' &&
          'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30',
        status === 'network-error' &&
          'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30 animate-pulse',
        status === 'concurrency-conflict' &&
          'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30'
      )}
    >
      {status === 'saving' && (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Guardando...</span>
        </>
      )}

      {status === 'saved' && (
        <>
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Sincronizado {formattedTime ? `a las ${formattedTime}` : ''}</span>
        </>
      )}

      {status === 'network-error' && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Sin conexión (Guardado local)</span>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="underline text-[11px] hover:text-foreground inline-flex items-center gap-0.5"
            >
              <RefreshCw className="h-3 w-3" /> Reintentar
            </button>
          )}
        </div>
      )}

      {status === 'concurrency-conflict' && (
        <div className="flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
          <span>Conflicto de versión detectado</span>
        </div>
      )}
    </div>
  )
}
