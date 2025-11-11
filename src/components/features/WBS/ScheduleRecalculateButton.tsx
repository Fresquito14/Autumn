import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTasks } from '@/hooks/useTasks'
import { useDependencies } from '@/hooks/useDependencies'
import { useProject } from '@/hooks/useProject'
import { cn } from '@/lib/utils'

export function ScheduleRecalculateButton() {
  const { recalculateDatesFromDependencies } = useTasks()
  const { dependencies } = useDependencies()
  const { currentProject } = useProject()
  const [isRecalculating, setIsRecalculating] = useState(false)

  const handleRecalculate = async () => {
    if (!currentProject) return

    setIsRecalculating(true)
    try {
      // Ensure workingDays are numbers, not strings
      const rawWorkingDays = currentProject.config?.workingDays || [1, 2, 3, 4, 5]
      const workingDays = rawWorkingDays.map(day => typeof day === 'string' ? parseInt(day, 10) : day)

      console.log('🔧 Working days antes de conversión:', rawWorkingDays)
      console.log('🔧 Working days después de conversión:', workingDays)

      await recalculateDatesFromDependencies(dependencies, workingDays)
    } catch (err) {
      console.error('Error al recalcular fechas:', err)
      alert('Error al recalcular fechas. Revisa la consola para más detalles.')
    } finally {
      setIsRecalculating(false)
    }
  }

  if (!currentProject || dependencies.length === 0) {
    return null
  }

  return (
    <Button
      onClick={handleRecalculate}
      disabled={isRecalculating}
      variant="outline"
      size="sm"
      title="Recalcula las fechas de inicio y fin de las tareas basándose en las dependencias"
    >
      <RefreshCw className={cn("h-4 w-4 mr-2", isRecalculating && "animate-spin")} />
      {isRecalculating ? 'Recalculando...' : 'Recalcular Fechas'}
    </Button>
  )
}
