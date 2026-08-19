import { useState, useEffect, useRef, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { CheckCircle2, Link2 } from 'lucide-react'
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
import { useDependencies } from '@/hooks/useDependencies'
import { useProject } from '@/hooks/useProject'
import { addBusinessDays } from '@/lib/calculations/dates'
import { TaskChecklist } from './TaskChecklist'
import type { Task, ChecklistItem } from '@/types'

interface ActualProgressFormData {
  actualDuration: number
}

interface ActualProgressDialogProps {
  task: Task
  trigger?: React.ReactNode
}

export function ActualProgressDialog({ task, trigger }: ActualProgressDialogProps) {
  const [open, setOpen] = useState(false)
  const taskIdRef = useRef(task.id)
  const { tasks, updateTask, getTask } = useTasks()
  const { dependencies, updateDependency } = useDependencies()
  const { currentProject } = useProject()

  // Get fresh task data from store
  const currentTask = getTask(task.id) || task

  const incomingDependencies = dependencies.filter(d => d.successorId === currentTask.id)
  const [dependencyLags, setDependencyLags] = useState<Record<string, { lag: number; actualLag?: number }>>({})

  const [actualDuration, setActualDuration] = useState<number>(
    currentTask.actualDuration || currentTask.duration
  )

  const { handleSubmit, reset, setValue } = useForm<ActualProgressFormData>({
    defaultValues: {
      actualDuration: currentTask.actualDuration || currentTask.duration,
    }
  })

  // Close dialog if task ID changes
  useEffect(() => {
    if (task.id !== taskIdRef.current) {
      setOpen(false)
      taskIdRef.current = task.id
    }
  }, [task.id])

  // Update form default value when currentTask or dependencies change
  useEffect(() => {
    const actDur = currentTask.actualDuration || currentTask.duration
    setValue('actualDuration', actDur)
    setActualDuration(actDur)

    const incoming = dependencies.filter(d => d.successorId === currentTask.id)
    const initialLags: Record<string, { lag: number; actualLag?: number }> = {}
    incoming.forEach(dep => {
      initialLags[dep.id] = {
        lag: dep.lag || 0,
        actualLag: dep.actualLag,
      }
    })
    setDependencyLags(initialLags)
  }, [currentTask.actualDuration, currentTask.duration, currentTask.id, dependencies, setValue])

  // Check if task is a leaf task (no children)
  const isLeafTask = !tasks.some(t => t.parentId === currentTask.id)

  // Checklist handlers
  const handleAddChecklistItem = async (text: string) => {
    const freshTask = getTask(task.id)
    if (!freshTask) return

    const newItem: ChecklistItem = {
      id: `checklist-${Date.now()}-${Math.random()}`,
      text,
      completed: false
    }
    const updatedChecklist = [...(freshTask.checklist || []), newItem]
    await updateTask(task.id, { checklist: updatedChecklist })
  }

  const handleToggleChecklistItem = async (itemId: string) => {
    const freshTask = getTask(task.id)
    if (!freshTask) return

    const updatedChecklist = (freshTask.checklist || []).map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    )
    await updateTask(task.id, { checklist: updatedChecklist })
  }

  const handleDeleteChecklistItem = async (itemId: string) => {
    const freshTask = getTask(task.id)
    if (!freshTask) return

    const updatedChecklist = (freshTask.checklist || []).filter(item => item.id !== itemId)
    await updateTask(task.id, { checklist: updatedChecklist })
  }

  const handleUpdateChecklistItem = async (itemId: string, text: string) => {
    const freshTask = getTask(task.id)
    if (!freshTask) return

    const updatedChecklist = (freshTask.checklist || []).map(item =>
      item.id === itemId ? { ...item, text } : item
    )
    await updateTask(task.id, { checklist: updatedChecklist })
  }

  const handleAllChecklistCompleted = () => {
    const durationInput = document.getElementById('actualDuration')
    if (durationInput) {
      setTimeout(() => {
        durationInput.focus()
      }, 100)
    }
  }

  const onSubmit = async (data: ActualProgressFormData) => {
    try {
      const workingDays = currentProject?.config?.workingDays || [1, 2, 3, 4, 5]
      const finalDuration = actualDuration || data.actualDuration

      // Update incoming dependencies if actualLag was changed
      if (incomingDependencies.length > 0) {
        for (const dep of incomingDependencies) {
          const lagState = dependencyLags[dep.id]
          if (lagState && (lagState.lag !== dep.lag || lagState.actualLag !== dep.actualLag)) {
            await updateDependency(dep.id, {
              lag: lagState.lag,
              actualLag: lagState.actualLag,
            })
          }
        }
      }

      // Determine actualStartDate
      let actualStartDate: Date

      if (incomingDependencies.length === 0) {
        actualStartDate = currentTask.actualStartDate || currentTask.startDate
      } else {
        let earliestActualStart: Date | null = null

        incomingDependencies.forEach(dep => {
          const predecessor = tasks.find(t => t.id === dep.predecessorId)
          if (!predecessor) return

          const predecessorEnd = predecessor.actualEndDate || predecessor.endDate
          const lagToUse = dependencyLags[dep.id]?.actualLag !== undefined
            ? dependencyLags[dep.id]?.actualLag!
            : (dependencyLags[dep.id]?.lag ?? dep.lag ?? 0)

          const predCalculatedStart = addBusinessDays(new Date(predecessorEnd), lagToUse + 1, workingDays)
          if (!earliestActualStart || predCalculatedStart.getTime() > earliestActualStart.getTime()) {
            earliestActualStart = predCalculatedStart
          }
        })

        actualStartDate = earliestActualStart || currentTask.actualStartDate || currentTask.startDate
      }

      // Calculate actualEndDate from actualStartDate + actualDuration
      const actualEndDate = addBusinessDays(actualStartDate, finalDuration - 1, workingDays)

      await updateTask(task.id, {
        actualDuration: finalDuration,
        actualStartDate,
        actualEndDate,
      })

      setOpen(false)
      reset()
    } catch (error) {
      console.error('Error updating actual progress:', error)
      alert('❌ Error al actualizar el avance real')
    }
  }

  const handleClear = async () => {
    try {
      await updateTask(task.id, {
        actualDuration: undefined,
        actualStartDate: undefined,
        actualEndDate: undefined,
      })

      setOpen(false)
      reset()
    } catch (error) {
      console.error('Error clearing actual progress:', error)
    }
  }

  const defaultTrigger = (
    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Registrar avance real">
      <CheckCircle2 className="h-3 w-3" />
    </Button>
  )

  const executionVariance = actualDuration - currentTask.duration

  // Stable onOpenChange handler
  const handleOpenChange = useCallback((newOpen: boolean) => {
    setOpen(newOpen)
  }, [])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Seguimiento y Retraso Real de Inicio
            </DialogTitle>
            <DialogDescription>
              {task.wbsCode} - {task.name}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Checklist - only for leaf tasks */}
            {isLeafTask && (
              <TaskChecklist
                checklist={currentTask.checklist || []}
                onAddItem={handleAddChecklistItem}
                onToggleItem={handleToggleChecklistItem}
                onDeleteItem={handleDeleteChecklistItem}
                onUpdateItem={handleUpdateChecklistItem}
                onAllCompleted={handleAllChecklistCompleted}
                hasActualDuration={currentTask.actualDuration !== undefined && currentTask.actualDuration !== null}
              />
            )}

            {/* Incoming Predecessor Dependencies Lag inputs */}
            {incomingDependencies.length > 0 && (
              <div className="border rounded-xl p-3 bg-muted/20 space-y-2.5">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-semibold text-xs text-foreground">
                    Retraso Real de Inicio respecto a Predecesoras
                  </span>
                </div>

                {incomingDependencies.map(dep => {
                  const pred = tasks.find(t => t.id === dep.predecessorId)
                  const lagState = dependencyLags[dep.id] || { lag: dep.lag || 0, actualLag: dep.actualLag }

                  return (
                    <div key={dep.id} className="p-2.5 rounded-lg border bg-card space-y-2">
                      <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                        <span>Predecesora: {pred ? `${pred.wbsCode} - ${pred.name}` : ''}</span>
                        <span className="text-[10px] text-muted-foreground">FS</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="grid gap-1">
                          <Label className="text-[11px] text-muted-foreground">Retraso Plan (días)</Label>
                          <Input
                            type="number"
                            min="0"
                            value={lagState.lag}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0
                              setDependencyLags(prev => ({
                                ...prev,
                                [dep.id]: { ...prev[dep.id], lag: val }
                              }))
                            }}
                          />
                        </div>

                        <div className="grid gap-1">
                          <Label className="text-[11px] text-primary font-semibold">Retraso Real Inicio (días)</Label>
                          <Input
                            type="number"
                            placeholder="Opcional"
                            value={lagState.actualLag !== undefined ? lagState.actualLag : ''}
                            onChange={(e) => {
                              const raw = e.target.value
                              const val = raw === '' ? undefined : parseInt(raw, 10)
                              setDependencyLags(prev => ({
                                ...prev,
                                [dep.id]: { ...prev[dep.id], actualLag: val }
                              }))
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Planned vs Real Duration inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium">Duración Planificada</Label>
                <div className="text-sm font-semibold bg-muted p-2 rounded-md border text-muted-foreground flex items-center h-10">
                  {currentTask.duration} días laborables
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="actualDuration" className="text-xs font-medium">
                  Duración Real (días) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="actualDuration"
                  type="number"
                  min="1"
                  value={actualDuration}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 1
                    setActualDuration(val)
                    setValue('actualDuration', val)
                  }}
                  required
                />
              </div>
            </div>

            {/* Execution Variance Banner */}
            <div className="p-3 rounded-md text-xs border bg-card flex items-center justify-between">
              <span className="font-semibold text-foreground/80">Desvío de Duración:</span>
              <span
                className={
                  executionVariance === 0
                    ? 'text-muted-foreground font-medium'
                    : executionVariance > 0
                    ? 'text-rose-600 dark:text-rose-400 font-bold'
                    : 'text-emerald-600 dark:text-emerald-400 font-bold'
                }
              >
                {executionVariance === 0
                  ? '✅ En plazo exacto (0 días)'
                  : executionVariance > 0
                  ? `⚠️ +${executionVariance} ${executionVariance === 1 ? 'día' : 'días'} de duración extra`
                  : `✨ ${executionVariance} ${Math.abs(executionVariance) === 1 ? 'día' : 'días'} menos de lo previsto`}
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            {currentTask.actualDuration !== undefined && (
              <Button
                type="button"
                variant="outline"
                onClick={handleClear}
              >
                Desmarcar Avance
              </Button>
            )}
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
            <Button type="submit">
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
