import { useState } from 'react'
import { Copy } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useTasks } from '@/hooks/useTasks'
import { useDependencies } from '@/hooks/useDependencies'
import { useProject } from '@/hooks/useProject'
import { copyTaskBlock, getDescendantTasks } from '@/lib/utils/task-copy'
import { dbHelpers } from '@/lib/storage/db'
import type { Task } from '@/types'

interface CopyTaskBlockDialogProps {
  task: Task
  trigger?: React.ReactNode
}

export function CopyTaskBlockDialog({ task, trigger }: CopyTaskBlockDialogProps) {
  const [open, setOpen] = useState(false)
  const [targetParentId, setTargetParentId] = useState<string | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(false)
  const { tasks, createTask } = useTasks()
  const { dependencies, createDependency } = useDependencies()
  const { currentProject } = useProject()

  // Get descendant count for display
  const descendants = getDescendantTasks(task.id, tasks)
  const totalTasks = 1 + descendants.length

  // Get potential parent tasks (cannot copy into itself or its descendants)
  const blockTaskIds = new Set([task.id, ...descendants.map(d => d.id)])
  const potentialParents = tasks.filter(t => !blockTaskIds.has(t.id))

  const handleCopy = async () => {
    if (!currentProject) return

    setIsLoading(true)
    try {
      // Generate the new tasks and dependencies
      const { tasks: newTasks, dependencies: newDependencies } = await copyTaskBlock(
        task.id,
        targetParentId,
        tasks,
        dependencies,
        currentProject.id
      )

      console.log(`📋 Copiando bloque de ${totalTasks} tareas`)
      console.log(`   - Nuevas tareas: ${newTasks.length}`)
      console.log(`   - Nuevas dependencias: ${newDependencies.length}`)

      // Create all tasks in database
      for (const newTask of newTasks) {
        await dbHelpers.createTask(newTask)
      }

      // Create all dependencies in database
      for (const newDep of newDependencies) {
        await dbHelpers.createDependency(newDep)
      }

      // Reload tasks and dependencies to show the changes
      if (currentProject) {
        const updatedTasks = await dbHelpers.getProjectTasks(currentProject.id)
        updatedTasks.sort((a, b) => a.wbsCode.localeCompare(b.wbsCode, undefined, { numeric: true }))

        // Trigger recalculation via state updates (useAutoRecalculate will handle it)
        // The tasks will be reloaded automatically by the store
      }

      alert(`✅ Bloque copiado: ${totalTasks} tareas y ${newDependencies.length} dependencias`)
      setOpen(false)
      setTargetParentId(undefined)

      // Force reload to show changes
      window.location.reload()
    } catch (error) {
      console.error('Error copying task block:', error)
      alert('❌ Error al copiar el bloque de tareas: ' + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const defaultTrigger = (
    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Copiar bloque de tareas">
      <Copy className="h-3 w-3" />
    </Button>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Copiar Bloque de Tareas
          </DialogTitle>
          <DialogDescription>
            {task.wbsCode} - {task.name}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Info about the block */}
          <div className="bg-muted p-3 rounded-md text-sm">
            <p className="font-medium mb-1">Bloque a copiar:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Tarea principal: {task.wbsCode} - {task.name}</li>
              {descendants.length > 0 && (
                <li>{descendants.length} {descendants.length === 1 ? 'subtarea' : 'subtareas'}</li>
              )}
              <li>Total: {totalTasks} {totalTasks === 1 ? 'tarea' : 'tareas'}</li>
            </ul>
          </div>

          {/* Parent selection */}
          <div className="grid gap-2">
            <Label htmlFor="parent-select">
              Tarea Padre Destino
            </Label>
            <Select
              value={targetParentId || 'none'}
              onValueChange={(value) => setTargetParentId(value === 'none' ? undefined : value)}
            >
              <SelectTrigger id="parent-select">
                <SelectValue placeholder="Seleccionar tarea padre..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  (Nivel superior - sin padre)
                </SelectItem>
                {potentialParents.map((parent) => (
                  <SelectItem key={parent.id} value={parent.id}>
                    {parent.wbsCode} - {parent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              El bloque se copiará como hijo de la tarea seleccionada.
              Las dependencias internas y externas se preservarán.
            </p>
          </div>

          {/* Warning about dates */}
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 p-3 rounded-md text-sm">
            <p className="text-yellow-800 dark:text-yellow-200">
              ℹ️ Las fechas se recalcularán automáticamente según las dependencias.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setOpen(false)
              setTargetParentId(undefined)
            }}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleCopy}
            disabled={isLoading}
          >
            {isLoading ? 'Copiando...' : 'Copiar Bloque'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
