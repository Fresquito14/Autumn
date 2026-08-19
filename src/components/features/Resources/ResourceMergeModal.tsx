import { useState, useEffect } from 'react'
import { ArrowRight, Users, AlertTriangle, CheckCircle2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { mergeOrReassignResource } from '@/lib/storage/resource_merge'
import type { Resource } from '@/types'
import { toast } from 'sonner'

interface ResourceMergeModalProps {
  isOpen: boolean
  onClose: () => void
  initialSourceResourceId?: string
  resources: Resource[]
  onSuccess: () => void
}

export function ResourceMergeModal({
  isOpen,
  onClose,
  initialSourceResourceId,
  resources,
  onSuccess,
}: ResourceMergeModalProps) {
  const [sourceId, setSourceId] = useState<string>('')
  const [targetId, setTargetId] = useState<string>('')
  const [deleteSource, setDeleteSource] = useState<boolean>(true)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  useEffect(() => {
    if (initialSourceResourceId) {
      setSourceId(initialSourceResourceId)
    } else if (resources.length > 0 && !sourceId) {
      setSourceId(resources[0].id)
    }
  }, [initialSourceResourceId, resources, isOpen])

  const sourceResource = resources.find(r => r.id === sourceId)
  const targetResource = resources.find(r => r.id === targetId)

  const handleMerge = async () => {
    if (!sourceId || !targetId) {
      toast.error('Debes seleccionar un recurso origen y un recurso destino.')
      return
    }

    if (sourceId === targetId) {
      toast.error('El recurso origen y destino deben ser diferentes.')
      return
    }

    try {
      setIsSubmitting(true)
      const result = await mergeOrReassignResource(sourceId, targetId, deleteSource)

      toast.success(
        `¡Unificación completada! Se transfirieron ${result.updatedAssignmentsCount} asignaciones y ${result.migratedTasksCount} tareas a ${targetResource?.name}.`
      )

      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error al unificar recursos:', err)
      toast.error((err as Error).message || 'Error al unificar los recursos')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Users className="h-5 w-5 text-primary" />
            Unificar / Reemplazar Recurso
          </DialogTitle>
          <DialogDescription>
            Transfiere todas las tareas, horas planificadas y cargas de trabajo de un recurso a otro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Source Resource */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase">
              1. Recurso Origen (A sustituir / unificar)
            </Label>
            <select
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={sourceId}
              onChange={e => setSourceId(e.target.value)}
            >
              <option value="" disabled>Selecciona recurso origen...</option>
              {resources.map(r => (
                <option key={r.id} value={r.id} disabled={r.id === targetId}>
                  {r.name} {r.email ? `(${r.email})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Direction Arrow */}
          <div className="flex justify-center my-1">
            <div className="p-2 rounded-full bg-muted/60 text-muted-foreground">
              <ArrowRight className="h-4 w-4 rotate-90 sm:rotate-90" />
            </div>
          </div>

          {/* Target Resource */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase">
              2. Recurso Destino (Que asumirá el trabajo)
            </Label>
            <select
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={targetId}
              onChange={e => setTargetId(e.target.value)}
            >
              <option value="">Selecciona recurso destino...</option>
              {resources.map(r => (
                <option key={r.id} value={r.id} disabled={r.id === sourceId}>
                  {r.name} {r.email ? `(${r.email})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Delete Checkbox */}
          <div className="flex items-center gap-2 pt-2 border-t text-sm">
            <input
              type="checkbox"
              id="deleteSource"
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              checked={deleteSource}
              onChange={e => setDeleteSource(e.target.checked)}
            />
            <label htmlFor="deleteSource" className="cursor-pointer select-none">
              Eliminar el recurso origen (<span className="font-medium">{sourceResource?.name || 'Origen'}</span>) tras la migración
            </label>
          </div>

          {/* Explanation Alert */}
          {sourceResource && targetResource && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-lg text-amber-800 dark:text-amber-300 text-xs flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                Todas las tareas asignadas a <strong>{sourceResource.name}</strong> serán transferidas a <strong>{targetResource.name}</strong>. Si ambos estaban asignados a la misma tarea, sus horas planificadas y distribución semanal se sumarán.
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>

          <Button
            onClick={handleMerge}
            disabled={!sourceId || !targetId || sourceId === targetId || isSubmitting}
            className="bg-primary hover:bg-primary/90 gap-1.5"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isSubmitting ? 'Migrando...' : 'Confirmar Unificación'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
