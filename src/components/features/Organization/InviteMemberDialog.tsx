import { useState, useEffect } from 'react'
import { UserPlus, Mail, Check, Copy, Trash2, Building2, Users } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useOrganization } from '@/hooks/useOrganization'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { OrganizationRole } from '@/domain/models'

interface PendingInvite {
  id: string
  email: string
  role: OrganizationRole
  created_at: string
}

export function InviteMemberDialog() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<OrganizationRole>('member')
  const [isLoading, setIsLoading] = useState(false)
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [copiedLink, setCopiedLink] = useState(false)

  const { currentOrganization } = useOrganization()
  const { user } = useAuth()

  // Load pending invites when dialog opens
  const loadPendingInvites = async () => {
    if (!currentOrganization) return
    try {
      const { data, error } = await supabase
        .from('organization_invitations')
        .select('id, email, role, created_at')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setPendingInvites(data)
      }
    } catch (err) {
      console.warn('Could not load pending invites:', err)
    }
  }

  useEffect(() => {
    if (open && currentOrganization) {
      loadPendingInvites()
    }
  }, [open, currentOrganization])

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !currentOrganization) return

    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      toast.error('Por favor introduce un correo electrónico válido')
      return
    }

    setIsLoading(true)
    try {
      // 1. Insert into organization_invitations
      const { error: inviteError } = await supabase
        .from('organization_invitations')
        .upsert(
          {
            organization_id: currentOrganization.id,
            email: cleanEmail,
            role,
            invited_by: user?.id || null,
            created_at: new Date().toISOString(),
          },
          { onConflict: 'organization_id,email' }
        )

      if (inviteError) throw inviteError

      // 2. Add to allowed_users whitelist so user is allowed to sign up
      await supabase
        .from('allowed_users')
        .upsert({ email: cleanEmail }, { onConflict: 'email' })

      toast.success(`Invitación enviada a ${cleanEmail}`, {
        description: `Asignado rol de ${role === 'manager' ? 'Gestor (Edición)' : 'Visualizador (Solo lectura)'}`,
      })

      setEmail('')
      loadPendingInvites()
    } catch (err: any) {
      console.error('Error sending invitation:', err)
      toast.error('Error al enviar la invitación: ' + (err.message || 'Error desconocido'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteInvite = async (id: string, inviteEmail: string) => {
    try {
      const { error } = await supabase
        .from('organization_invitations')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast.success(`Invitación cancelada para ${inviteEmail}`)
      setPendingInvites((prev) => prev.filter((i) => i.id !== id))
    } catch (err: any) {
      toast.error('Error al cancelar la invitación')
    }
  }

  const handleCopyInviteLink = () => {
    if (!currentOrganization) return
    const inviteUrl = `${window.location.origin}?invite=${currentOrganization.id}`
    navigator.clipboard.writeText(inviteUrl)
    setCopiedLink(true)
    toast.success('Enlace de invitación copiado al portapapeles')
    setTimeout(() => setCopiedLink(false), 2500)
  }

  if (!currentOrganization) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 rounded-full text-primary hover:text-primary hover:bg-primary/10"
          title={`Invitar a miembros a ${currentOrganization.name}`}
        >
          <UserPlus className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Invitar a {currentOrganization.name}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Añade miembros para compartir proyectos y colaborar en tiempo real.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Invite Form */}
        <form onSubmit={handleSendInvite} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email" className="text-xs font-semibold">
              Correo electrónico del invitado
            </Label>
            <div className="relative">
              <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="invite-email"
                type="email"
                placeholder="companero@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9 text-sm"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-role" className="text-xs font-semibold">
              Rol en la Organización
            </Label>
            <Select value={role} onValueChange={(val) => setRole(val as OrganizationRole)}>
              <SelectTrigger id="invite-role" className="text-sm">
                <SelectValue placeholder="Selecciona un rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">
                  <div className="space-y-0.5">
                    <span className="font-medium">Visualizador (Solo Lectura)</span>
                    <p className="text-xs text-muted-foreground">
                      Puede ver todos los proyectos y cronogramas, pero no modificarlos.
                    </p>
                  </div>
                </SelectItem>
                <SelectItem value="manager">
                  <div className="space-y-0.5">
                    <span className="font-medium">Gestor de Proyectos (Editor)</span>
                    <p className="text-xs text-muted-foreground">
                      Puede crear nuevos proyectos y gestionar los que le pertenezcan.
                    </p>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            disabled={isLoading || !email}
            className="w-full bg-primary text-primary-foreground font-semibold"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            {isLoading ? 'Enviando invitación...' : 'Enviar Invitación'}
          </Button>
        </form>

        {/* Quick link copy */}
        <div className="pt-2 border-t flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            O comparte el enlace directo de registro
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyInviteLink}
            className="h-8 text-xs font-medium"
          >
            {copiedLink ? (
              <>
                <Check className="h-3.5 w-3.5 mr-1.5 text-green-600" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                Copiar Enlace
              </>
            )}
          </Button>
        </div>

        {/* Pending Invites List */}
        {pendingInvites.length > 0 && (
          <div className="pt-3 border-t space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Invitaciones pendientes ({pendingInvites.length})
            </h4>
            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
              {pendingInvites.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border text-xs"
                >
                  <div className="space-y-0.5 truncate mr-2">
                    <div className="font-medium truncate">{inv.email}</div>
                    <div className="text-[11px] text-muted-foreground capitalize">
                      Rol: {inv.role === 'manager' ? 'Gestor' : 'Visualizador'}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteInvite(inv.id, inv.email)}
                    title="Cancelar invitación"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
