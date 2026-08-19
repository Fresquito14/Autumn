import { useState, useEffect } from 'react'
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UserCheck, AlertTriangle, ArrowRightLeft, ShieldAlert } from 'lucide-react'
import { useOrganization, type OrganizationMemberItem } from '@/hooks/useOrganization'
import { useProject } from '@/hooks/useProject'
import { useAuth } from '@/hooks/useAuth'
import type { Project } from '@/types'
import { toast } from 'sonner'

interface TransferProjectDialogProps {
  project: Project
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactNode
}

export function TransferProjectDialog({
  project,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  trigger,
}: TransferProjectDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? setControlledOpen! : setInternalOpen

  const [members, setMembers] = useState<OrganizationMemberItem[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [isLoadingMembers, setIsLoadingMembers] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { getOrganizationMembers, currentOrganization } = useOrganization()
  const { transferProjectOwnership } = useProject()
  const { user } = useAuth()

  useEffect(() => {
    if (open && project.organizationId) {
      loadMembers()
    }
  }, [open, project.organizationId])

  const loadMembers = async () => {
    if (!project.organizationId) return
    setIsLoadingMembers(true)
    setError(null)
    try {
      const orgMembers = await getOrganizationMembers(project.organizationId)
      // Exclude current owner from selectable targets
      const candidateMembers = orgMembers.filter((m) => m.userId !== project.userId)
      setMembers(candidateMembers)
      if (candidateMembers.length > 0) {
        setSelectedUserId(candidateMembers[0].userId)
      }
    } catch {
      setError('No se pudieron cargar los miembros de la organización')
    } finally {
      setIsLoadingMembers(false)
    }
  }

  const handleTransfer = async () => {
    if (!selectedUserId) return
    setError(null)
    setIsSubmitting(true)

    try {
      await transferProjectOwnership(project.id, selectedUserId)
      const newOwner = members.find((m) => m.userId === selectedUserId)
      toast.success('Proyecto traspasado con éxito', {
        description: `La propiedad del proyecto ha sido transferida a ${newOwner?.email || 'el nuevo gestor'}.`,
      })
      setOpen(false)
    } catch (err: any) {
      setError(err?.message || 'Error al transferir la propiedad del proyecto')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isOwner = user?.id && project.userId === user.id

  if (!isOwner || !project.organizationId) {
    return null
  }

  const selectedMember = members.find((m) => m.userId === selectedUserId)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-2 p-3 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 w-fit">
            <ArrowRightLeft className="h-6 w-6" />
          </div>
          <DialogTitle className="text-xl font-bold">
            Traspasar Propiedad del Proyecto
          </DialogTitle>
          <DialogDescription className="text-xs">
            Transfiere el control y los permisos de edición de <strong>"{project.name}"</strong> a otro gestor de {currentOrganization?.name || 'la organización'}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive text-xs rounded-lg flex items-start gap-2 border border-destructive/20">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {isLoadingMembers ? (
            <p className="text-center text-xs text-muted-foreground py-4">
              Cargando miembros de la organización...
            </p>
          ) : members.length === 0 ? (
            <div className="p-3.5 bg-muted rounded-lg text-center space-y-1">
              <p className="text-xs font-semibold text-foreground">
                No hay otros miembros en la organización
              </p>
              <p className="text-[11px] text-muted-foreground">
                Comparte el código de la organización para que otros gestores se unan antes de traspasar el proyecto.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5 text-left">
                <Label className="text-xs font-semibold">
                  Nuevo Responsable del Proyecto
                </Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue placeholder="Seleccionar miembro..." />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((member) => (
                      <SelectItem key={member.userId} value={member.userId} className="text-xs">
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-3.5 w-3.5 text-primary" />
                          <span>{member.email}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            ({member.role})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Warning Notice */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs space-y-1.5 text-amber-700 dark:text-amber-300">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Importante sobre la transferencia</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Al traspasar este proyecto, <strong>{selectedMember?.email || 'el nuevo gestor'}</strong> será el único con permisos de modificación (Gantt, WBS, hitos). Tu cuenta pasará a tener permisos de <strong>Solo Lectura</strong> sobre este proyecto.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
            className="text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleTransfer}
            disabled={isSubmitting || members.length === 0 || !selectedUserId}
            className="gap-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            {isSubmitting ? 'Traspasando...' : 'Confirmar Traspaso'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
