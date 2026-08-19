import { useState } from 'react'
import { Building2, Sparkles, Plus, ArrowRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useOrganization } from '@/hooks/useOrganization'
import { toast } from 'sonner'

interface CreateOrganizationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isMandatoryOnboarding?: boolean
}

export function CreateOrganizationDialog({
  open,
  onOpenChange,
  isMandatoryOnboarding = false,
}: CreateOrganizationDialogProps) {
  const [orgName, setOrgName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { createOrganization } = useOrganization()

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = orgName.trim()
    if (!trimmed) {
      toast.error('Por favor introduce el nombre de la organización')
      return
    }

    setIsLoading(true)
    try {
      const newOrg = await createOrganization(trimmed)
      toast.success(`Organización "${newOrg.name}" creada con éxito`, {
        description: 'Ahora eres el Gestor de tu propio espacio corporativo.',
      })
      setOrgName('')
      onOpenChange(false)
    } catch (err: any) {
      toast.error('Error al crear la organización: ' + (err.message || 'Error desconocido'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        // Prevent closing if it's mandatory onboarding and name is not created yet
        if (isMandatoryOnboarding && !val) return
        onOpenChange(val)
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => {
          if (isMandatoryOnboarding) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          if (isMandatoryOnboarding) e.preventDefault()
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary mb-0.5">
                <Sparkles className="h-3 w-3" />
                {isMandatoryOnboarding ? 'Bienvenido a Autumn Premium' : 'Nuevo Espacio de Trabajo'}
              </div>
              <DialogTitle className="text-xl font-bold">
                {isMandatoryOnboarding ? 'Crea tu Organización' : 'Crear Organización'}
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-xs leading-relaxed pt-1">
            {isMandatoryOnboarding
              ? 'Como usuario Premium, configura tu organización corporativa donde podrás crear tus propios proyectos, gestionar cronogramas e invitar a colaboradores.'
              : 'Crea un nuevo espacio de trabajo corporativo donde podrás gestionar proyectos con tu equipo.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreate} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="org-name" className="text-xs font-semibold">
              Nombre de la Empresa u Organización
            </Label>
            <Input
              id="org-name"
              type="text"
              placeholder="Ej. Estudio de Arquitectura Guijarro"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="text-sm"
              required
              autoFocus
            />
          </div>

          {isMandatoryOnboarding && (
            <div className="rounded-lg bg-muted/60 p-3 text-[11px] text-muted-foreground border">
              ℹ️ Si ya has sido invitado a otras organizaciones (como <em>Fresh Analytics Inc.</em>), podrás alternar entre ellas en cualquier momento desde el menú superior.
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            {!isMandatoryOnboarding && (
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
            )}
            <Button
              type="submit"
              disabled={isLoading || !orgName.trim()}
              className="w-full bg-primary text-primary-foreground font-semibold"
            >
              {isLoading ? (
                'Creando...'
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Crear y Continuar
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
