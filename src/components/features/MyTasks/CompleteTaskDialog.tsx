import { useState, useMemo } from 'react'
import {
  CheckCircle2,
  Calendar,
  AlertTriangle,
  Sparkles,
} from 'lucide-react'
import { format, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { addBusinessDays, calculateBusinessDays, isWorkingDay } from '@/lib/calculations/dates'
import type { Task } from '@/types'
import { cn } from '@/lib/utils'

interface CompleteTaskDialogProps {
  task: Task
  projectName: string
  workingDays?: number[]
  onConfirm: (data: {
    actualDuration: number
    actualStartDate: Date
    actualEndDate: Date
    percentComplete: number
    notes?: string
  }) => Promise<void>
  trigger?: React.ReactNode
}

export function CompleteTaskDialog({
  task,
  projectName,
  workingDays = [1, 2, 3, 4, 5],
  onConfirm,
  trigger,
}: CompleteTaskDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Initial planned start
  const plannedStartDate = useMemo(() => new Date(task.startDate), [task.startDate])
  const plannedEndDate = useMemo(() => new Date(task.endDate), [task.endDate])
  const plannedDuration = task.duration || 1

  // Start delay state in working days (0 = on time, +X = late, -X = early)
  const [startDelayDays, setStartDelayDays] = useState<number>(() => {
    if (task.actualStartDate) {
      const actualStart = new Date(task.actualStartDate)
      const diff = calculateBusinessDays(plannedStartDate, actualStart, workingDays) - 1
      return diff
    }
    return 0
  })

  // Actual duration worked in business days
  const [actualDuration, setActualDuration] = useState<number>(
    task.actualDuration || plannedDuration
  )

  // Optional completion notes
  const [notes, setNotes] = useState<string>(task.notes || '')

  // Calculate actualStartDate based on plannedStartDate + startDelayDays
  const calculatedActualStartDate = useMemo(() => {
    if (startDelayDays === 0) {
      return plannedStartDate
    } else if (startDelayDays > 0) {
      return addBusinessDays(plannedStartDate, startDelayDays, workingDays)
    } else {
      // Started earlier
      let cur = new Date(plannedStartDate)
      let daysToGo = Math.abs(startDelayDays)
      while (daysToGo > 0) {
        cur = addDays(cur, -1)
        if (isWorkingDay(cur, workingDays)) {
          daysToGo--
        }
      }
      return cur
    }
  }, [plannedStartDate, startDelayDays, workingDays])

  // Calculate actualEndDate based on actualStartDate + actualDuration
  const calculatedActualEndDate = useMemo(() => {
    const dur = Math.max(1, actualDuration)
    return addBusinessDays(calculatedActualStartDate, dur - 1, workingDays)
  }, [calculatedActualStartDate, actualDuration, workingDays])

  // Variances
  const durationVariance = actualDuration - plannedDuration
  const totalScheduleVariance = startDelayDays + durationVariance

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await onConfirm({
        actualDuration: Math.max(1, actualDuration),
        actualStartDate: calculatedActualStartDate,
        actualEndDate: calculatedActualEndDate,
        percentComplete: 100,
        notes: notes.trim() || undefined,
      })
      setOpen(false)
    } catch (err) {
      console.error('Error completing task:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const defaultTrigger = (
    <Button
      size="sm"
      className="gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
    >
      <CheckCircle2 className="h-3.5 w-3.5" />
      Completar
    </Button>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>

      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              <DialogTitle className="text-base font-bold">
                Completar Tarea
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Registra los datos reales de ejecución para calcular el estado real y desvíos del proyecto.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 text-xs">
            {/* Task Planned Summary Card */}
            <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground truncate max-w-[280px]">
                  {task.wbsCode} - {task.name}
                </span>
                <span className="text-[11px] text-muted-foreground">{projectName}</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground text-[11px]">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-primary" />
                  <span>
                    Planificado: {format(plannedStartDate, 'dd MMM', { locale: es })} -{' '}
                    {format(plannedEndDate, 'dd MMM yyyy', { locale: es })}
                  </span>
                </div>
                <span>•</span>
                <span>Duración: {plannedDuration}d</span>
              </div>
            </div>

            {/* Field 1: Start Delay */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="startDelay" className="text-xs font-medium text-foreground">
                  Retraso en el Inicio (días laborables)
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  {startDelayDays === 0
                    ? 'Inició puntual en la fecha planificada'
                    : startDelayDays > 0
                    ? `Inició +${startDelayDays} días tarde`
                    : `Inició ${Math.abs(startDelayDays)} días antes`}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Input
                    id="startDelay"
                    type="number"
                    value={startDelayDays}
                    onChange={(e) => setStartDelayDays(parseInt(e.target.value, 10) || 0)}
                    placeholder="0"
                    className="h-8 text-xs font-medium"
                  />
                </div>
                <div className="flex items-center px-2.5 rounded-md border bg-muted/20 text-[11px] text-foreground font-medium">
                  Inicio real: {format(calculatedActualStartDate, 'dd MMM yyyy', { locale: es })}
                </div>
              </div>
            </div>

            {/* Field 2: Actual Duration */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="actualDuration" className="text-xs font-medium text-foreground">
                  Duración Real Trabajada (días laborables)
                </Label>
                <span
                  className={cn(
                    'text-[11px] font-semibold',
                    durationVariance > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : durationVariance < 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-muted-foreground'
                  )}
                >
                  {durationVariance > 0
                    ? `+${durationVariance}d de sobrecoste temporal`
                    : durationVariance < 0
                    ? `${durationVariance}d de ahorro de tiempo`
                    : 'Duración exacta al plan'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Input
                    id="actualDuration"
                    type="number"
                    min="1"
                    value={actualDuration}
                    onChange={(e) => setActualDuration(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="h-8 text-xs font-medium"
                    required
                  />
                </div>
                <div className="flex items-center px-2.5 rounded-md border bg-muted/20 text-[11px] text-foreground font-medium">
                  Fin real: {format(calculatedActualEndDate, 'dd MMM yyyy', { locale: es })}
                </div>
              </div>
            </div>

            {/* Schedule Impact & Deviation Banner */}
            <div
              className={cn(
                'p-2.5 rounded-lg border flex items-center justify-between gap-2',
                totalScheduleVariance > 0
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
                  : totalScheduleVariance < 0
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                  : 'bg-muted/40 border-border text-muted-foreground'
              )}
            >
              <div className="flex items-center gap-2">
                {totalScheduleVariance > 0 ? (
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                ) : (
                  <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
                )}
                <div>
                  <span className="font-semibold text-xs">
                    Impacto en el Cronograma del Proyecto:
                  </span>
                  <p className="text-[11px] opacity-90">
                    {totalScheduleVariance > 0
                      ? `Esta tarea acumula un retraso total de +${totalScheduleVariance} días.`
                      : totalScheduleVariance < 0
                      ? `Esta tarea se completó con un adelanto de ${Math.abs(totalScheduleVariance)} días.`
                      : 'Esta tarea se completó en la fecha exacta planificada.'}
                  </p>
                </div>
              </div>
              <span className="text-sm font-bold shrink-0">
                {totalScheduleVariance > 0
                  ? `+${totalScheduleVariance}d`
                  : `${totalScheduleVariance}d`}
              </span>
            </div>

            {/* Optional Notes */}
            <div className="space-y-1">
              <Label htmlFor="completeNotes" className="text-xs text-muted-foreground">
                Observaciones de Cierre (Opcional)
              </Label>
              <textarea
                id="completeNotes"
                placeholder="Añade cualquier nota sobre la entrega o lecciones aprendidas..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>
          </div>

          <DialogFooter className="border-t pt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isSubmitting ? 'Guardando...' : 'Confirmar y Completar Tarea'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
