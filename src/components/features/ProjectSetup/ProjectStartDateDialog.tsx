import { useState } from 'react'
import { Calendar, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
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
import { useProject } from '@/hooks/useProject'
import { useAuth } from '@/hooks/useAuth'
import { updateProjectStartDateAndCascade } from '@/lib/calculations/projectSchedule'
import { toast } from 'sonner'

interface ProjectStartDateDialogProps {
  trigger?: React.ReactNode
}

export function ProjectStartDateDialog({ trigger }: ProjectStartDateDialogProps) {
  const { currentProject } = useProject()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const isReadOnly = Boolean(user && currentProject?.userId && currentProject.userId !== user.id)

  const currentDateString = currentProject?.startDate
    ? new Date(currentProject.startDate).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0]

  const [selectedDate, setSelectedDate] = useState(currentDateString)

  if (!currentProject || isReadOnly) return null

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDate) return

    try {
      setIsUpdating(true)
      const newStartDate = new Date(selectedDate)
      await updateProjectStartDateAndCascade(currentProject.id, newStartDate)
      toast.success('Fecha de inicio actualizada y cronograma recalculado')
      setOpen(false)
    } catch (err) {
      console.error('Error al actualizar fecha de inicio:', err)
      toast.error('Error al actualizar la fecha de inicio')
    } finally {
      setIsUpdating(false)
    }
  }

  const defaultTrigger = (
    <Button
      variant="outline"
      size="sm"
      className="h-8 gap-1.5 text-xs font-semibold border-primary/30 hover:bg-primary/10"
      title="Modificar fecha de inicio del proyecto"
    >
      <Calendar className="h-3.5 w-3.5 text-primary" />
      <span>Inicio: {currentProject.startDate ? format(new Date(currentProject.startDate), 'dd MMM yy', { locale: es }) : 'Modificar'}</span>
    </Button>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <form onSubmit={handleUpdate}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Modificar Inicio del Proyecto
            </DialogTitle>
            <DialogDescription>
              Ajusta la fecha de arranque de <span className="font-semibold text-foreground">"{currentProject.name}"</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="projectStartDate">Nueva Fecha de Inicio del Proyecto</Label>
              <Input
                id="projectStartDate"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                required
              />
            </div>

            <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground space-y-1 border">
              <div className="font-semibold text-foreground flex items-center gap-1">
                <RefreshCw className="h-3.5 w-3.5 text-primary" />
                Recálculo automático en cascada:
              </div>
              <p>
                Todas las tareas iniciales sin dependencias comenzarán en esta fecha, y todos sus sucesores se desplazarán fluidamente manteniendo los días de duración y dependencias.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isUpdating}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? 'Recalculando...' : 'Guardar y Recalcular'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
