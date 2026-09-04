import { useState } from 'react'
import { Smartphone, Monitor, ArrowRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MobileProjectNoticeProps {
  onGoToTasks: () => void
}

export function MobileProjectNotice({ onGoToTasks }: MobileProjectNoticeProps) {
  const [isDismissed, setIsDismissed] = useState(false)

  if (isDismissed) return null

  return (
    <div className="p-3.5 mb-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs space-y-2 md:hidden">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold">
          <Smartphone className="h-4 w-4 shrink-0" />
          <span>Experiencia Móvil Optimizada</span>
        </div>
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="text-muted-foreground hover:text-foreground p-1"
          aria-label="Cerrar aviso"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="text-muted-foreground text-[11px] leading-relaxed">
        El Diagrama de Gantt y la estructura de dependencias WBS están pensados para pantallas grandes (<span className="inline-flex items-center gap-0.5 font-medium text-foreground"><Monitor className="h-3 w-3" /> Tablet o PC</span>). Para operar desde tu teléfono te recomendamos usar <strong>Mis Tareas</strong>.
      </p>

      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          onClick={onGoToTasks}
          className="h-8 text-xs font-semibold gap-1 bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
        >
          Ir a Mis Tareas
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsDismissed(true)}
          className="h-8 text-xs text-muted-foreground"
        >
          Ver proyecto aquí
        </Button>
      </div>
    </div>
  )
}
