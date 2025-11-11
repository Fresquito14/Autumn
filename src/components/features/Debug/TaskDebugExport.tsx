import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTasks } from '@/hooks/useTasks'
import { useCriticalPath } from '@/hooks/useCriticalPath'
import { useDependencies } from '@/hooks/useDependencies'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'

export function TaskDebugExport() {
  const { tasks } = useTasks()
  const { dependencies } = useDependencies()
  const { tasksWithCPM } = useCriticalPath()

  const exportToTable = () => {
    // Header
    let table = 'WBS\tNombre\tDuración Plan\tInicio Plan\tFin Plan\tDuración Real\tInicio Real\tFin Real\tES\tEF\tLS\tLF\tHolgura\tCrítico\tPredecesoras\n'

    // Sort tasks by WBS code
    const sortedTasks = [...tasks].sort((a, b) => a.wbsCode.localeCompare(b.wbsCode, undefined, { numeric: true }))

    sortedTasks.forEach(task => {
      const taskCPM = tasksWithCPM.find(t => t.id === task.id)

      // Get predecessors
      const preds = dependencies
        .filter(dep => dep.successorId === task.id)
        .map(dep => {
          const predTask = tasks.find(t => t.id === dep.predecessorId)
          return predTask ? predTask.wbsCode : '?'
        })
        .join(', ')

      const row = [
        task.wbsCode,
        task.name,
        task.duration,
        format(task.startDate, 'dd/MM/yyyy', { locale: es }),
        format(task.endDate, 'dd/MM/yyyy', { locale: es }),
        task.actualDuration ?? '-',
        task.actualStartDate ? format(task.actualStartDate, 'dd/MM/yyyy', { locale: es }) : '-',
        task.actualEndDate ? format(task.actualEndDate, 'dd/MM/yyyy', { locale: es }) : '-',
        taskCPM?.earlyStart ?? '-',
        taskCPM?.earlyFinish ?? '-',
        taskCPM?.lateStart ?? '-',
        taskCPM?.lateFinish ?? '-',
        taskCPM?.totalFloat ?? '-',
        taskCPM?.isCritical ? 'SÍ' : 'NO',
        preds || '-'
      ].join('\t')

      table += row + '\n'
    })

    // Copy to clipboard
    navigator.clipboard.writeText(table).then(() => {
      toast.success('Datos copiados al portapapeles', {
        description: 'Puedes pegarlos en Excel, Google Sheets o aquí en el chat'
      })
    }).catch(() => {
      toast.error('Error al copiar al portapapeles')
    })
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={exportToTable}
      className="gap-2"
    >
      <Copy className="h-4 w-4" />
      Copiar Debug Info
    </Button>
  )
}
