import { useState } from 'react'
import { Clock, Plus } from 'lucide-react'
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
import { useResourceAssignments } from '@/hooks/useResourceAssignments'
import { useTasks } from '@/hooks/useTasks'
import type { Task } from '@/types'
import { toast } from 'sonner'

interface LogHoursDialogProps {
  task: Task
  resourceId: string
  trigger?: React.ReactNode
  onHoursLogged?: () => void
}

export function LogHoursDialog({
  task,
  resourceId,
  trigger,
  onHoursLogged,
}: LogHoursDialogProps) {
  const [open, setOpen] = useState(false)
  const [hoursToAdd, setHoursToAdd] = useState<number>(1)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { assignments, updateAssignment, createAssignment } = useResourceAssignments()
  const { updateTask } = useTasks()

  const currentAssignment = assignments.find(
    (a) => a.taskId === task.id && a.resourceId === resourceId
  )

  const currentActualHours = currentAssignment?.actualHours || 0
  const plannedHours = currentAssignment?.plannedHours || 0

  const handleQuickAdd = (amount: number) => {
    setHoursToAdd((prev) => Math.max(0.5, Math.round((prev + amount) * 10) / 10))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (hoursToAdd <= 0) {
      toast.error('Introduce una cantidad de horas mayor a cero.')
      return
    }

    setIsSubmitting(true)
    try {
      const newTotalHours = Math.round((currentActualHours + hoursToAdd) * 100) / 100

      if (currentAssignment) {
        await updateAssignment(currentAssignment.id, {
          actualHours: newTotalHours,
        })
      } else {
        await createAssignment(
          {
            taskId: task.id,
            resourceId,
            plannedHours: 0,
            actualHours: newTotalHours,
          },
          new Date(task.startDate),
          new Date(task.endDate),
          [1, 2, 3, 4, 5]
        )
      }

      // If task hasn't started yet, set actualStartDate to today
      if (!task.actualStartDate) {
        await updateTask(task.id, {
          actualStartDate: new Date(),
        })
      }

      toast.success(`+${hoursToAdd}h imputadas con éxito a "${task.name}"`)
      setOpen(false)
      setHoursToAdd(1)
      onHoursLogged?.()
    } catch (err) {
      console.error('Error logging hours:', err)
      toast.error('Error al imputar horas en la tarea')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Imputar Horas
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-mono text-xs">
            <span>{task.wbsCode}</span>
          </div>
          <DialogTitle className="text-base font-semibold">
            Imputar Horas a la Tarea
          </DialogTitle>
          <DialogDescription className="text-xs">
            {task.name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Current hours balance banner */}
          <div className="rounded-md bg-muted/60 p-3 flex items-center justify-between text-xs">
            <div>
              <span className="text-muted-foreground block">Imputadas hasta hoy:</span>
              <span className="font-semibold text-sm text-foreground">
                {currentActualHours}h
              </span>
            </div>
            {plannedHours > 0 && (
              <div className="text-right">
                <span className="text-muted-foreground block">Planificadas:</span>
                <span className="font-medium text-muted-foreground">
                  {plannedHours}h
                </span>
              </div>
            )}
          </div>

          {/* Quick hour increment buttons */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Incremento rápido</Label>
            <div className="flex flex-wrap gap-1.5">
              {[0.5, 1, 2, 4, 8].map((amt) => (
                <Button
                  key={amt}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-2.5"
                  onClick={() => handleQuickAdd(amt)}
                >
                  +{amt}h
                </Button>
              ))}
            </div>
          </div>

          {/* Input field */}
          <div className="space-y-1.5">
            <Label htmlFor="hours-to-add" className="text-xs">
              Horas a sumar en esta imputación
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="hours-to-add"
                type="number"
                step="0.25"
                min="0.25"
                max="24"
                value={hoursToAdd}
                onChange={(e) => setHoursToAdd(parseFloat(e.target.value) || 0)}
                className="h-9 text-sm"
                required
              />
              <span className="text-xs text-muted-foreground">horas</span>
            </div>
          </div>

          {/* Result preview */}
          <p className="text-[11px] text-muted-foreground">
            Nuevo acumulado real resultante:{' '}
            <strong className="text-foreground">
              {Math.round((currentActualHours + (hoursToAdd || 0)) * 100) / 100}h
            </strong>
          </p>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || hoursToAdd <= 0}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              {isSubmitting ? 'Guardando...' : `Sumar +${hoursToAdd}h`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
