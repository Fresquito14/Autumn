import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSchedule } from '@/hooks/useSchedule'
import { toast } from 'sonner'

export function RecalculateAllButton() {
  const { recalculateSchedule } = useSchedule()

  const handleRecalculate = async () => {
    const confirmed = confirm(
      '🔄 Esto recalculará TODAS las fechas de tareas basándose en:\n\n' +
      '• La duración definida por el usuario (input)\n' +
      '• Las dependencias entre tareas\n' +
      '• Los días laborables del proyecto\n\n' +
      'Las duraciones NO cambiarán, solo las fechas.\n\n' +
      '¿Continuar?'
    )

    if (!confirmed) return

    try {
      await recalculateSchedule()
      toast.success('✅ Fechas recalculadas', {
        description: 'Todas las fechas ahora respetan duraciones y dependencias'
      })
    } catch (error) {
      console.error('Error recalculating:', error)
      toast.error('Error al recalcular fechas')
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRecalculate}
      className="gap-2"
      title="Recalcula todas las fechas desde duraciones y dependencias"
    >
      <RefreshCw className="h-4 w-4" />
      Recalcular Todo
    </Button>
  )
}
