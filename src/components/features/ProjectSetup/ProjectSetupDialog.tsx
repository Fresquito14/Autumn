import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Calendar, Plus, Trash2, PartyPopper } from 'lucide-react'
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
import { useGlobalHolidays } from '@/hooks/useGlobalHolidays'
import type { ProjectConfig, Holiday } from '@/types'

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
  const { holidays: globalHolidays, loadAllHolidays } = useGlobalHolidays()
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProjectFormData>({
    defaultValues: {
      name: '',
      description: '',
      startDate: new Date().toISOString().split('T')[0],
      hoursPerDay: 8,
      workingDays: [1, 2, 3, 4, 5], // Mon-Fri
    }
  })

  // Load global holidays when dialog opens
  useEffect(() => {
    if (open) {
      loadAllHolidays()
    }
  }, [open, loadAllHolidays])

  // Holiday management state
  const [useGlobalHolidays, setUseGlobalHolidays] = useState(true)
  const [excludedGlobalHolidayIds, setExcludedGlobalHolidayIds] = useState<string[]>([])
  const [projectSpecificHolidays, setProjectSpecificHolidays] = useState<Holiday[]>([])
  const [holidayName, setHolidayName] = useState('')
  const [holidayDate, setHolidayDate] = useState('')
  const [holidayDescription, setHolidayDescription] = useState('')
  const [holidayTags, setHolidayTags] = useState('')

  const handleToggleGlobalHoliday = (holidayId: string) => {
    if (excludedGlobalHolidayIds.includes(holidayId)) {
      setExcludedGlobalHolidayIds(excludedGlobalHolidayIds.filter(id => id !== holidayId))
    } else {
      setExcludedGlobalHolidayIds([...excludedGlobalHolidayIds, holidayId])
    }
  }

  const handleAddProjectHoliday = () => {
    if (!holidayName || !holidayDate) return

    const newHoliday: Holiday = {
      id: crypto.randomUUID(),
      name: holidayName,
      date: new Date(holidayDate),
      description: holidayDescription || undefined,
      appliesTo: holidayTags ? holidayTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) : undefined
    }

    setProjectSpecificHolidays([...projectSpecificHolidays, newHoliday])
    setHolidayName('')
    setHolidayDate('')
    setHolidayDescription('')
    setHolidayTags('')
  }

  const handleRemoveProjectHoliday = (id: string) => {
    setProjectSpecificHolidays(projectSpecificHolidays.filter(h => h.id !== id))
  }

  const onSubmit = async (data: ProjectFormData) => {
    // Convert workingDays from strings to numbers (HTML checkboxes return strings)
    const workingDays = Array.isArray(data.workingDays)
      ? data.workingDays.map(day => typeof day === 'string' ? parseInt(day, 10) : day)
      : [1, 2, 3, 4, 5]

    const config: ProjectConfig = {
      workingDays,
      hoursPerDay: data.hoursPerDay,
      useGlobalHolidays,
      excludedGlobalHolidayIds,
      projectSpecificHolidays,
      skipHolidaysInScheduling: true,
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
      setUseGlobalHolidays(true)
      setExcludedGlobalHolidayIds([])
      setProjectSpecificHolidays([])
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
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

            {/* Holidays Section */}
            <div className="grid gap-3 pt-2 border-t">
              <Label className="flex items-center gap-2 text-base">
                <PartyPopper className="h-4 w-4" />
                Días Festivos
              </Label>

              {/* Use Global Holidays Checkbox */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="useGlobalHolidays"
                  checked={useGlobalHolidays}
                  onChange={(e) => setUseGlobalHolidays(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="useGlobalHolidays" className="cursor-pointer">
                  Usar festivos globales
                </Label>
              </div>

              {/* Global Holidays List */}
              {useGlobalHolidays && globalHolidays.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-2">
                    Desmarca los festivos que NO aplican a este proyecto:
                  </p>
                  {globalHolidays
                    .sort((a, b) => a.date.getTime() - b.date.getTime())
                    .map((holiday) => {
                      const isExcluded = excludedGlobalHolidayIds.includes(holiday.id)
                      return (
                        <div
                          key={holiday.id}
                          className={`flex items-start gap-2 p-2 rounded-md text-sm transition-colors ${
                            isExcluded ? 'bg-muted/50 opacity-50' : 'bg-secondary'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={!isExcluded}
                            onChange={() => handleToggleGlobalHoliday(holiday.id)}
                            className="h-4 w-4 mt-0.5"
                          />
                          <div className="flex-1">
                            <div className="font-medium">{holiday.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {format(holiday.date, 'dd MMM yyyy', { locale: es })}
                              {holiday.description && ` • ${holiday.description}`}
                            </div>
                            {holiday.appliesTo && holiday.appliesTo.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Aplica a: {holiday.appliesTo.join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}

              {useGlobalHolidays && globalHolidays.length === 0 && (
                <p className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg">
                  No hay festivos globales definidos. Ve a la sección "Festivos" para crear algunos.
                </p>
              )}

              {/* Project-Specific Holidays */}
              <div className="grid gap-2 pt-2">
                <Label className="text-sm">Festivos específicos de este proyecto (opcional)</Label>

                {/* Add Holiday Form */}
                <div className="grid gap-2 p-3 bg-muted/50 rounded-lg">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="holidayName" className="text-xs">Nombre *</Label>
                      <Input
                        id="holidayName"
                        placeholder="Ej: Feria local"
                        value={holidayName}
                        onChange={(e) => setHolidayName(e.target.value)}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label htmlFor="holidayDate" className="text-xs">Fecha *</Label>
                      <Input
                        id="holidayDate"
                        type="date"
                        value={holidayDate}
                        onChange={(e) => setHolidayDate(e.target.value)}
                        className="h-8"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="holidayDescription" className="text-xs">Descripción (opcional)</Label>
                    <Input
                      id="holidayDescription"
                      placeholder="Descripción del festivo"
                      value={holidayDescription}
                      onChange={(e) => setHolidayDescription(e.target.value)}
                      className="h-8"
                    />
                  </div>

                  <div>
                    <Label htmlFor="holidayTags" className="text-xs">Aplica a recursos con tags (opcional)</Label>
                    <Input
                      id="holidayTags"
                      placeholder="Ej: España, Madrid (separados por comas)"
                      value={holidayTags}
                      onChange={(e) => setHolidayTags(e.target.value)}
                      className="h-8"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Deja vacío para aplicar a todos los recursos
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddProjectHoliday}
                    disabled={!holidayName || !holidayDate}
                    className="w-full"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Añadir Festivo del Proyecto
                  </Button>
                </div>

                {/* Project Holidays List */}
                {projectSpecificHolidays.length > 0 && (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {projectSpecificHolidays.map((holiday) => (
                      <div
                        key={holiday.id}
                        className="flex items-start justify-between p-2 bg-secondary rounded-md text-sm"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{holiday.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(holiday.date, 'dd MMM yyyy', { locale: es })}
                            {holiday.description && ` • ${holiday.description}`}
                          </div>
                          {holiday.appliesTo && holiday.appliesTo.length > 0 && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Aplica a: {holiday.appliesTo.join(', ')}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveProjectHoliday(holiday.id)}
                          className="text-destructive hover:text-destructive/80"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
