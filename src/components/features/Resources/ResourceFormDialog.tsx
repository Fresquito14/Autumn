import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Calendar } from 'lucide-react'
import type { Resource, DateRange } from '@/types'
import { useResources } from '@/hooks/useResources'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface ResourceFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  resource?: Resource // If provided, edit mode
}

export function ResourceFormDialog({
  open,
  onOpenChange,
  resource
}: ResourceFormDialogProps) {
  const { createResource, updateResource } = useResources()

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    maxHoursPerWeek: 40,
    costPerHour: 0,
    tags: [] as string[],
    vacations: [] as DateRange[]
  })

  const [tagInput, setTagInput] = useState('')
  const [vacationStart, setVacationStart] = useState('')
  const [vacationEnd, setVacationEnd] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Initialize form when resource changes
  useEffect(() => {
    if (resource) {
      setFormData({
        name: resource.name,
        email: resource.email || '',
        maxHoursPerWeek: resource.maxHoursPerWeek,
        costPerHour: resource.costPerHour || 0,
        tags: resource.tags || [],
        vacations: resource.calendar?.vacations || []
      })
    } else {
      setFormData({
        name: '',
        email: '',
        maxHoursPerWeek: 40,
        costPerHour: 0,
        tags: [],
        vacations: []
      })
    }
    setTagInput('')
    setVacationStart('')
    setVacationEnd('')
  }, [resource, open])

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim()
    if (trimmedTag && !formData.tags.includes(trimmedTag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, trimmedTag]
      }))
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const handleAddVacation = () => {
    if (!vacationStart || !vacationEnd) return

    const start = new Date(vacationStart)
    const end = new Date(vacationEnd)

    if (start > end) {
      alert('La fecha de inicio debe ser anterior a la fecha de fin')
      return
    }

    setFormData(prev => ({
      ...prev,
      vacations: [...prev.vacations, { start, end }]
    }))
    setVacationStart('')
    setVacationEnd('')
  }

  const handleRemoveVacation = (index: number) => {
    setFormData(prev => ({
      ...prev,
      vacations: prev.vacations.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      return
    }

    setIsSubmitting(true)

    try {
      if (resource) {
        // Edit mode
        await updateResource(resource.id, {
          name: formData.name,
          email: formData.email || undefined,
          maxHoursPerWeek: formData.maxHoursPerWeek,
          costPerHour: formData.costPerHour || undefined,
          tags: formData.tags,
          calendar: { vacations: formData.vacations }
        })
      } else {
        // Create mode
        await createResource({
          name: formData.name,
          email: formData.email || undefined,
          maxHoursPerWeek: formData.maxHoursPerWeek,
          costPerHour: formData.costPerHour || undefined,
          tags: formData.tags,
          calendar: { vacations: formData.vacations }
        })
      }

      onOpenChange(false)
    } catch (error) {
      console.error('Error saving resource:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {resource ? 'Editar Recurso' : 'Nuevo Recurso'}
          </DialogTitle>
          <DialogDescription>
            {resource
              ? 'Modifica los datos del recurso'
              : 'Crea un nuevo recurso para asignar a tareas'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Nombre <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Nombre del recurso"
              required
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="email@ejemplo.com"
            />
          </div>

          {/* Max Hours Per Week */}
          <div className="space-y-2">
            <Label htmlFor="maxHours">
              Horas máximas por semana <span className="text-red-500">*</span>
            </Label>
            <Input
              id="maxHours"
              type="number"
              min="1"
              max="168"
              value={formData.maxHoursPerWeek}
              onChange={e => setFormData(prev => ({
                ...prev,
                maxHoursPerWeek: parseInt(e.target.value) || 40
              }))}
              required
            />
          </div>

          {/* Cost Per Hour */}
          <div className="space-y-2">
            <Label htmlFor="cost">Coste por hora (€)</Label>
            <Input
              id="cost"
              type="number"
              min="0"
              step="0.01"
              value={formData.costPerHour}
              onChange={e => setFormData(prev => ({
                ...prev,
                costPerHour: parseFloat(e.target.value) || 0
              }))}
              placeholder="0.00"
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">Etiquetas / Habilidades</Label>
            <div className="flex gap-2">
              <Input
                id="tags"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddTag()
                  }
                }}
                placeholder="React, Frontend, Senior..."
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleAddTag}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Tag list */}
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.tags.map(tag => (
                  <div
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-secondary text-secondary-foreground rounded-md text-xs"
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Vacations */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Vacaciones
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="vacationStart" className="text-xs">Desde</Label>
                <Input
                  id="vacationStart"
                  type="date"
                  value={vacationStart}
                  onChange={e => setVacationStart(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="vacationEnd" className="text-xs">Hasta</Label>
                <Input
                  id="vacationEnd"
                  type="date"
                  value={vacationEnd}
                  onChange={e => setVacationEnd(e.target.value)}
                />
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddVacation}
              className="w-full"
              disabled={!vacationStart || !vacationEnd}
            >
              <Plus className="h-4 w-4 mr-2" />
              Añadir vacaciones
            </Button>

            {/* Vacation list */}
            {formData.vacations.length > 0 && (
              <div className="space-y-2 mt-2">
                {formData.vacations.map((vacation, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-secondary rounded-md text-sm"
                  >
                    <span>
                      {format(vacation.start, 'dd MMM', { locale: es })} - {format(vacation.end, 'dd MMM yyyy', { locale: es })}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveVacation(index)}
                      className="hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : resource ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
