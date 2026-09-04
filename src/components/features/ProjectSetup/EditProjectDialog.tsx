import { useState, useEffect } from 'react'
import { Settings, RefreshCw, Calendar, Clock, Briefcase } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { updateProjectAndRecalculateSchedule } from '@/lib/calculations/projectSchedule'
import type { Project } from '@/types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface EditProjectDialogProps {
  project: Project | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

const DAYS_OF_WEEK = [
  { id: 1, label: 'L', name: 'Lunes' },
  { id: 2, label: 'M', name: 'Martes' },
  { id: 3, label: 'X', name: 'Miércoles' },
  { id: 4, label: 'J', name: 'Jueves' },
  { id: 5, label: 'V', name: 'Viernes' },
  { id: 6, label: 'S', name: 'Sábado' },
  { id: 0, label: 'D', name: 'Domingo' },
]

export function EditProjectDialog({
  project,
  open,
  onOpenChange,
  onSaved,
}: EditProjectDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDateStr, setStartDateStr] = useState('')
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [isSaving, setIsSaving] = useState(false)

  // Populate form fields when project changes
  useEffect(() => {
    if (project) {
      setName(project.name || '')
      setDescription(project.description || '')
      if (project.startDate) {
        const d = new Date(project.startDate)
        if (!isNaN(d.getTime())) {
          setStartDateStr(d.toISOString().split('T')[0])
        }
      }
      setWorkingDays(project.config?.workingDays || [1, 2, 3, 4, 5])
    }
  }, [project, open])

  if (!project) return null

  const toggleDay = (dayId: number) => {
    if (workingDays.includes(dayId)) {
      if (workingDays.length <= 1) {
        toast.warning('El proyecto debe tener al menos un día laborable a la semana')
        return
      }
      setWorkingDays(workingDays.filter((d) => d !== dayId))
    } else {
      setWorkingDays([...workingDays, dayId])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('El nombre del proyecto es obligatorio')
      return
    }

    try {
      setIsSaving(true)

      const updates = {
        name: name.trim(),
        description: description.trim() || undefined,
        startDate: startDateStr ? new Date(startDateStr) : new Date(),
        workingDays,
      }

      await updateProjectAndRecalculateSchedule(project.id, updates)

      toast.success(`Proyecto "${name.trim()}" actualizado y cronograma recalculado`)
      onOpenChange(false)
      onSaved?.()
    } catch (err: any) {
      console.error('Error al editar proyecto:', err)
      toast.error(`Error al guardar: ${err?.message || 'Fallo de guardado'}`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] md:max-w-[680px] p-6">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="pb-2 border-b">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold">
                  Configuración y Edición del Proyecto
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Modifica los parámetros principales del proyecto. Los cambios en la fecha de arranque o los días laborables actualizarán automáticamente el cronograma y las dependencias.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-5">
            {/* Section 1: General Info */}
            <div className="space-y-3 p-4 rounded-xl bg-muted/20 border border-muted-foreground/10">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Briefcase className="h-4 w-4 text-primary" />
                <span>Información General</span>
              </div>

              {/* Project Name */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-project-name" className="text-xs font-semibold">
                  Nombre del Proyecto <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-project-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Implantación ERP Fase 1 - Migración e Infraestructura"
                  className="h-9 text-xs"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-project-desc" className="text-xs font-semibold">
                  Descripción / Objetivos
                </Label>
                <textarea
                  id="edit-project-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Objetivos, alcance o notas clave del proyecto..."
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground resize-none leading-relaxed"
                />
              </div>
            </div>

            {/* Section 2: Calendar & Scheduling */}
            <div className="space-y-4 p-4 rounded-xl bg-muted/20 border border-muted-foreground/10">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Calendar className="h-4 w-4 text-primary" />
                <span>Calendario y Planificación Temporal</span>
              </div>

              {/* Start Date */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-project-start-date" className="text-xs font-semibold flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Fecha de Inicio del Proyecto</span>
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    Determina el punto de partida del diagrama
                  </span>
                </div>
                <Input
                  id="edit-project-start-date"
                  type="date"
                  value={startDateStr}
                  onChange={(e) => setStartDateStr(e.target.value)}
                  className="h-9 text-xs max-w-xs"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Si se adelanta o retrasa, desplazará en cascada las tareas iniciales sin predecesoras.
                </p>
              </div>

              {/* Working Days of the Week */}
              <div className="space-y-2 pt-1 border-t border-muted-foreground/10">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Días Laborables de la Semana</Label>
                  <Badge variant="secondary" className="text-[10px] font-medium">
                    {workingDays.length} {workingDays.length === 1 ? 'día laborable' : 'días laborables a la semana'}
                  </Badge>
                </div>

                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                  {DAYS_OF_WEEK.map((day) => {
                    const isSelected = workingDays.includes(day.id)
                    return (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => toggleDay(day.id)}
                        title={`${day.name}: haz clic para alternar`}
                        className={cn(
                          'h-11 rounded-lg text-xs font-semibold transition-all border flex flex-col items-center justify-center gap-0.5',
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary shadow-xs ring-1 ring-primary/20'
                            : 'bg-background text-muted-foreground border-input hover:bg-muted hover:text-foreground'
                        )}
                      >
                        <span className="text-xs font-bold leading-none">{day.label}</span>
                        <span className="text-[9px] opacity-75 hidden sm:inline leading-none">{day.name.slice(0, 3)}</span>
                      </button>
                    )
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Los días desmarcados no contarán para el cálculo de duraciones laborales de las tareas.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSaving || !name.trim()}
              className="text-xs font-semibold gap-1.5 px-4"
            >
              {isSaving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              {isSaving ? 'Recalculando cronograma...' : 'Guardar y Recalcular'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
