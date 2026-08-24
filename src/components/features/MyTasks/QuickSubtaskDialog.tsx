import { useState } from 'react'
import { GitFork, Plus, Trash2 } from 'lucide-react'
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
import { useTasks } from '@/hooks/useTasks'
import { useProject } from '@/hooks/useProject'
import { generateWbsCode, getWbsLevel } from '@/domain/calculations/wbs'
import { addBusinessDays } from '@/lib/calculations/dates'
import type { Task, ChecklistItem } from '@/types'
import { toast } from 'sonner'

interface QuickSubtaskDialogProps {
  parentTask: Task
  resourceId: string
  trigger?: React.ReactNode
  onSubtaskCreated?: (newTask: Task) => void
}

export function QuickSubtaskDialog({
  parentTask,
  resourceId,
  trigger,
  onSubtaskCreated,
}: QuickSubtaskDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState<number>(1)
  const [checklistItems, setChecklistItems] = useState<string[]>([])
  const [newChecklistText, setNewChecklistText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { tasks, createTask } = useTasks()
  const { currentProject } = useProject()

  const handleAddChecklistItem = () => {
    if (!newChecklistText.trim()) return
    setChecklistItems((prev) => [...prev, newChecklistText.trim()])
    setNewChecklistText('')
  }

  const handleRemoveChecklistItem = (index: number) => {
    setChecklistItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('El nombre de la subtarea es obligatorio')
      return
    }

    setIsSubmitting(true)
    try {
      // Find siblings of the same parent within the project
      const siblings = tasks.filter(
        (t) => t.parentId === parentTask.id && t.projectId === parentTask.projectId
      )

      const wbsCode = generateWbsCode(parentTask.wbsCode, siblings.length)
      const level = getWbsLevel(wbsCode)

      const workingDays = currentProject?.config?.workingDays || [1, 2, 3, 4, 5]
      const startDate = new Date(parentTask.startDate)
      const endDate = addBusinessDays(startDate, Math.max(1, duration) - 1, workingDays)

      const checklist: ChecklistItem[] = checklistItems.map((text) => ({
        id: crypto.randomUUID(),
        text,
        completed: false,
      }))

      const created = await createTask({
        projectId: parentTask.projectId,
        name: name.trim(),
        description: description.trim() || undefined,
        wbsCode,
        parentId: parentTask.id,
        level,
        duration: Math.max(1, duration),
        startDate,
        endDate,
        assignedTo: [resourceId],
        checklist,
      })

      toast.success(`Subtarea "${name}" creada con código WBS ${wbsCode}`)
      setOpen(false)
      setName('')
      setDescription('')
      setDuration(1)
      setChecklistItems([])
      if (created) {
        onSubtaskCreated?.(created)
      }
    } catch (err) {
      console.error('Error creating subtask:', err)
      toast.error('Error al crear la subtarea')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5">
            <GitFork className="h-3.5 w-3.5" />
            + Subtarea
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-mono text-xs">
            <span>{parentTask.wbsCode}</span>
            <span>•</span>
            <span>Tarea Padre</span>
          </div>
          <DialogTitle className="text-base font-semibold">
            Añadir Nueva Subtarea Hija
          </DialogTitle>
          <DialogDescription className="text-xs">
            Se desglosará de &ldquo;{parentTask.name}&rdquo; y quedará asignada a ti automáticamente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Subtask name */}
          <div className="space-y-1.5">
            <Label htmlFor="subtask-name" className="text-xs font-medium">
              Nombre de la subtarea *
            </Label>
            <Input
              id="subtask-name"
              placeholder="Ej. Implementar componentes UI, Redactar informe..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 text-sm"
              required
              autoFocus
            />
          </div>

          {/* Duration */}
          <div className="space-y-1.5">
            <Label htmlFor="subtask-duration" className="text-xs font-medium">
              Duración estimada (días laborables)
            </Label>
            <Input
              id="subtask-duration"
              type="number"
              min="1"
              max="365"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value, 10) || 1)}
              className="h-9 text-sm"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="subtask-desc" className="text-xs font-medium text-muted-foreground">
              Descripción o notas (opcional)
            </Label>
            <textarea
              id="subtask-desc"
              placeholder="Detalles sobre lo que hay que entregar..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="flex min-h-[50px] w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          </div>

          {/* Checklist initialization */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Checklist inicial (opcional)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Añadir punto a revisar..."
                value={newChecklistText}
                onChange={(e) => setNewChecklistText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddChecklistItem()
                  }
                }}
                className="h-8 text-xs flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs"
                onClick={handleAddChecklistItem}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>

            {checklistItems.length > 0 && (
              <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                {checklistItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs bg-muted/40 rounded px-2.5 py-1"
                  >
                    <span className="truncate flex-1">{item}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveChecklistItem(idx)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

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
            <Button type="submit" size="sm" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? 'Creando...' : 'Crear Subtarea'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
