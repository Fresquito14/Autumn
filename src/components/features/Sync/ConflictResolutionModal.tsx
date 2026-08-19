import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { AlertTriangle, CloudDownload, CloudUpload, Download } from 'lucide-react'

interface ConflictResolutionModalProps {
  isOpen: boolean
  onResolve: (resolution: 'cloud' | 'overwrite') => Promise<void>
  onExportBackup: () => void
  projectId: string
}

export function ConflictResolutionModal({
  isOpen,
  onResolve,
  onExportBackup,
  projectId,
}: ConflictResolutionModalProps) {
  const [isResolving, setIsResolving] = React.useState(false)

  const handleResolve = async (resolution: 'cloud' | 'overwrite') => {
    setIsResolving(true)
    try {
      await onResolve(resolution)
    } catch (err) {
      console.error(err)
    } finally {
      setIsResolving(false)
    }
  }

  return (
    <Dialog open={isOpen}>
      <DialogContent 
        className="max-w-2xl sm:rounded-lg [&>button]:hidden" // Hide the default Dialog Close button
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-4">
          <div className="flex items-center gap-3 text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200 dark:border-amber-900/50">
            <AlertTriangle className="h-6 w-6 shrink-0" />
            <div>
              <DialogTitle className="text-xl font-bold text-amber-800 dark:text-amber-300">
                Conflicto de Concurrencia Detectado
              </DialogTitle>
              <DialogDescription className="text-amber-700 dark:text-amber-400 mt-1">
                Otro usuario o pestaña del navegador ha guardado cambios más recientes en la nube para este proyecto.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          {/* Opción 1: Cargar de la nube */}
          <Card className="flex flex-col justify-between border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                <CloudDownload className="h-5 w-5" />
                <CardTitle className="text-base">Usar Versión de la Nube</CardTitle>
              </div>
              <CardDescription>
                Descarta tus cambios locales no sincronizados y carga la última versión guardada en el servidor.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <Button
                variant="outline"
                className="w-full border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-900/50 dark:hover:bg-blue-950/20"
                disabled={isResolving}
                onClick={() => handleResolve('cloud')}
              >
                Cargar de la Nube
              </Button>
            </CardContent>
          </Card>

          {/* Opción 2: Sobrescribir en la nube */}
          <Card className="flex flex-col justify-between border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 text-rose-600 mb-2">
                <CloudUpload className="h-5 w-5" />
                <CardTitle className="text-base">Sobrescribir en la Nube</CardTitle>
              </div>
              <CardDescription>
                Fuerza el guardado de tus datos locales sobre la nube. ¡Atención! Se perderán los cambios del otro usuario.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <Button
                variant="destructive"
                className="w-full bg-rose-600 hover:bg-rose-700 text-white"
                disabled={isResolving}
                onClick={() => {
                  if (
                    confirm(
                      '¿Estás seguro de que deseas sobrescribir los cambios en la nube? Esta acción reemplazará los datos del servidor por tus datos locales.'
                    )
                  ) {
                    handleResolve('overwrite')
                  }
                }}
              >
                Sobrescribir Servidor
              </Button>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t pt-4">
          <p className="text-xs text-muted-foreground text-center sm:text-left">
            ID de Proyecto: <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px]">{projectId}</code>
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
            onClick={onExportBackup}
          >
            <Download className="h-3.5 w-3.5" />
            Descargar copia local (.json)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
