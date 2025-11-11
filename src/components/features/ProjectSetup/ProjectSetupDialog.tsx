import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Calendar, Plus } from 'lucide-react'
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
import type { ProjectConfig } from '@/types'

interface ProjectFormData {
  name: string
  description: string
  startDate: string
  hoursPerDay: number
  workingDays: number[]
}

export function ProjectSetupDialog() {
  const [open, setOpen] = useState(false)
  const { createProject } = useProject()
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProjectFormData>({
    defaultValues: {
      name: '',
      description: '',
      startDate: new Date().toISOString().split('T')[0],
      hoursPerDay: 8,
      workingDays: [1, 2, 3, 4, 5], // Mon-Fri
    }
  })

  const onSubmit = async (data: ProjectFormData) => {
    // Convert workingDays from strings to numbers (HTML checkboxes return strings)
    const workingDays = Array.isArray(data.workingDays)
      ? data.workingDays.map(day => typeof day === 'string' ? parseInt(day, 10) : day)
      : [1, 2, 3, 4, 5]

    const config: ProjectConfig = {
      workingDays,
      hoursPerDay: data.hoursPerDay,
      holidays: [],
      defaultDuration: 1,
    }

    console.log('💾 Guardando proyecto con workingDays:', workingDays, typeof workingDays[0])

    try {
      await createProject({
        name: data.name,
        description: data.description,
        startDate: new Date(data.startDate),
        config,
      })

      setOpen(false)
      reset()
    } catch (error) {
      console.error('Error creating project:', error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Proyecto
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Crear Nuevo Proyecto
            </DialogTitle>
            <DialogDescription>
              Configura los detalles básicos de tu proyecto. Podrás ajustar el calendario y festivos más adelante.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">
                Nombre del Proyecto <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Ej: Construcción del edificio A"
                {...register('name', { required: 'El nombre es requerido' })}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Descripción</Label>
              <Input
                id="description"
                placeholder="Descripción breve del proyecto"
                {...register('description')}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="startDate">
                Fecha de Inicio <span className="text-destructive">*</span>
              </Label>
              <Input
                id="startDate"
                type="date"
                {...register('startDate', { required: 'La fecha de inicio es requerida' })}
              />
              {errors.startDate && (
                <p className="text-sm text-destructive">{errors.startDate.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="hoursPerDay">Horas por Día</Label>
              <Input
                id="hoursPerDay"
                type="number"
                min="1"
                max="24"
                {...register('hoursPerDay', {
                  valueAsNumber: true,
                  min: { value: 1, message: 'Mínimo 1 hora' },
                  max: { value: 24, message: 'Máximo 24 horas' }
                })}
              />
              {errors.hoursPerDay && (
                <p className="text-sm text-destructive">{errors.hoursPerDay.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Jornada laboral estándar (típicamente 8 horas)
              </p>
            </div>

            <div className="grid gap-2">
              <Label>Días Laborables</Label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: 1, label: 'Lun' },
                  { value: 2, label: 'Mar' },
                  { value: 3, label: 'Mié' },
                  { value: 4, label: 'Jue' },
                  { value: 5, label: 'Vie' },
                  { value: 6, label: 'Sáb' },
                  { value: 0, label: 'Dom' },
                ].map((day) => (
                  <label
                    key={day.value}
                    className="flex items-center gap-1 text-sm cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      value={day.value}
                      defaultChecked={day.value >= 1 && day.value <= 5}
                      {...register('workingDays')}
                      className="h-4 w-4"
                    />
                    {day.label}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Selecciona los días de trabajo de la semana
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false)
                reset()
              }}
            >
              Cancelar
            </Button>
            <Button type="submit">Crear Proyecto</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
