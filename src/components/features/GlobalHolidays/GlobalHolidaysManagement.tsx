import { useEffect, useState } from 'react'
import { PartyPopper, Plus, Edit, Trash2, Calendar as CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useGlobalHolidays } from '@/hooks/useGlobalHolidays'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { GlobalHoliday } from '@/types'

export function GlobalHolidaysManagement() {
  const { holidays, loadAllHolidays, createHoliday, updateHoliday, deleteHoliday } = useGlobalHolidays()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingHoliday, setEditingHoliday] = useState<GlobalHoliday | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)

  useEffect(() => {
    loadAllHolidays()
  }, [loadAllHolidays])

  const resetForm = () => {
    setName('')
    setDate('')
    setDescription('')
    setTags('')
    setIsRecurring(false)
    setEditingHoliday(null)
  }

  const handleOpenDialog = (holiday?: GlobalHoliday) => {
    if (holiday) {
      setEditingHoliday(holiday)
      setName(holiday.name)
      setDate(format(holiday.date, 'yyyy-MM-dd'))
      setDescription(holiday.description || '')
      setTags(holiday.appliesTo?.join(', ') || '')
      setIsRecurring(holiday.isRecurring || false)
    } else {
      resetForm()
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    resetForm()
  }

  const handleSubmit = async () => {
    if (!name || !date) return

    const holidayData = {
      name,
      date: new Date(date),
      description: description || undefined,
      appliesTo: tags ? tags.split(',').map(t => t.trim()).filter(t => t.length > 0) : undefined,
      isRecurring,
    }

    try {
      if (editingHoliday) {
        await updateHoliday(editingHoliday.id, holidayData)
      } else {
        await createHoliday(holidayData)
      }
      handleCloseDialog()
    } catch (error) {
      console.error('Error saving holiday:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar este festivo global? Los proyectos que lo usen dejarán de tenerlo.')) {
      await deleteHoliday(id)
    }
  }

  // Group holidays by year
  const holidaysByYear = holidays.reduce((acc, holiday) => {
    const year = holiday.date.getFullYear()
    if (!acc[year]) acc[year] = []
    acc[year].push(holiday)
    return acc
  }, {} as Record<number, GlobalHoliday[]>)

  // Sort years descending
  const sortedYears = Object.keys(holidaysByYear)
    .map(Number)
    .sort((a, b) => b - a)

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <PartyPopper className="h-8 w-8" />
            Festivos Globales
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestiona los festivos compartidos entre todos los proyectos
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Festivo
        </Button>
      </div>

      {holidays.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-muted/20">
          <PartyPopper className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No hay festivos globales</h3>
          <p className="text-muted-foreground mb-4">
            Añade festivos que se aplicarán a todos los proyectos
          </p>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Crear Primer Festivo
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedYears.map(year => (
            <div key={year} className="space-y-3">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                {year}
              </h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {holidaysByYear[year]
                  .sort((a, b) => a.date.getTime() - b.date.getTime())
                  .map(holiday => (
                    <div
                      key={holiday.id}
                      className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="font-medium flex items-center gap-2">
                            {holiday.name}
                            {holiday.isRecurring && (
                              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                Recurrente
                              </span>
                            )}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {format(holiday.date, 'dd MMMM yyyy', { locale: es })}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(holiday)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(holiday.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>

                      {holiday.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {holiday.description}
                        </p>
                      )}

                      {holiday.appliesTo && holiday.appliesTo.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {holiday.appliesTo.map(tag => (
                            <span
                              key={tag}
                              className="text-xs bg-secondary px-2 py-0.5 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingHoliday ? 'Editar Festivo' : 'Nuevo Festivo Global'}
            </DialogTitle>
            <DialogDescription>
              {editingHoliday
                ? 'Modifica los detalles del festivo'
                : 'Los festivos globales se aplicarán a todos los proyectos que los usen'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Ej: Navidad"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="date">
                Fecha <span className="text-destructive">*</span>
              </Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Descripción (opcional)</Label>
              <Input
                id="description"
                placeholder="Descripción del festivo"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tags">Aplica a recursos con tags (opcional)</Label>
              <Input
                id="tags"
                placeholder="Ej: España, Madrid (separados por comas)"
                value={tags}
                onChange={e => setTags(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Deja vacío para aplicar a todos los recursos
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="recurring"
                checked={isRecurring}
                onChange={e => setIsRecurring(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="recurring" className="cursor-pointer">
                Festivo recurrente (se repite cada año)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!name || !date}>
              {editingHoliday ? 'Guardar Cambios' : 'Crear Festivo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
