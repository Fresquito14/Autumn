import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, Lock, KeyRound, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { PasswordStrengthMeter } from './PasswordStrengthMeter'
import { toast } from 'sonner'

interface ResetPasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialEmail?: string
  isRecoveryMode?: boolean
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  initialEmail = '',
  isRecoveryMode = false,
}: ResetPasswordDialogProps) {
  const [email, setEmail] = useState(initialEmail)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  const { resetPasswordForEmail, updatePassword, isLoading } = useAuth()

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail)
    }
  }, [initialEmail])

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const formatErrorMessage = (msg: string) => {
    const lower = msg.toLowerCase()
    if (lower.includes('rate limit') || lower.includes('over_email_send_rate_limit')) {
      return 'Has alcanzado el límite temporal de envío de correos de Supabase (protección anti-spam del servidor). Por favor espera 1 minuto antes de intentarlo de nuevo.'
    }
    if (lower.includes('user not found')) {
      return 'No se ha encontrado ninguna cuenta asociada a este correo.'
    }
    return msg
  }

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setLocalError('Por favor introduce un correo válido')
      return
    }

    try {
      await resetPasswordForEmail(cleanEmail)
      setIsSuccess(true)
      setCooldown(60)
      toast.success('Correo de recuperación enviado', {
        description: `Revisa la bandeja de entrada de ${cleanEmail} para seguir las instrucciones.`,
      })
    } catch (err: any) {
      const formatted = formatErrorMessage(err?.message || '')
      setLocalError(formatted)
      if (err?.message?.toLowerCase().includes('rate limit')) {
        setCooldown(60)
      }
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    if (!newPassword || newPassword.length < 6) {
      setLocalError('La nueva contraseña debe tener al menos 6 caracteres')
      return
    }
    if (newPassword !== confirmPassword) {
      setLocalError('Las contraseñas no coinciden')
      return
    }

    try {
      await updatePassword(newPassword)
      toast.success('¡Contraseña actualizada con éxito!', {
        description: 'Ya puedes acceder a Autumn con tu nueva contraseña.',
      })
      onOpenChange(false)
    } catch (err: any) {
      setLocalError(formatErrorMessage(err?.message || 'Error al actualizar contraseña'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-2 p-3 rounded-full bg-primary/10 text-primary w-fit">
            <KeyRound className="h-6 w-6" />
          </div>
          <DialogTitle className="text-xl font-bold">
            {isRecoveryMode ? 'Establecer Nueva Contraseña' : 'Recuperar Contraseña'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {isRecoveryMode
              ? 'Introduce tu nueva contraseña para proteger tu cuenta de Autumn.'
              : 'Te enviaremos un correo con un enlace seguro para restablecer tu contraseña.'}
          </DialogDescription>
        </DialogHeader>

        {localError && (
          <div className="p-3 bg-destructive/10 text-destructive text-xs rounded-lg flex items-start gap-2 border border-destructive/20 animate-in fade-in">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span>{localError}</span>
            </div>
          </div>
        )}

        {isRecoveryMode ? (
          <form onSubmit={handleUpdatePassword} className="space-y-4 py-1">
            <div className="space-y-1.5 text-left">
              <Label htmlFor="new-password" className="text-xs font-semibold">
                Nueva Contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="new-password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-9 text-sm"
                  autoFocus
                />
              </div>
              <PasswordStrengthMeter password={newPassword} />
            </div>

            <div className="space-y-1.5 text-left">
              <Label htmlFor="confirm-password" className="text-xs font-semibold">
                Confirmar Contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirm-password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-9 text-sm"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading || !newPassword || !confirmPassword}
              className="w-full bg-primary text-primary-foreground font-semibold"
            >
              {isLoading ? 'Guardando...' : 'Guardar Nueva Contraseña'}
            </Button>
          </form>
        ) : isSuccess ? (
          <div className="space-y-4 py-4 text-center">
            <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center gap-2 text-xs font-medium border border-emerald-500/20">
              <CheckCircle2 className="h-4 w-4" />
              <span>Correo enviado a {email}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Haz clic en el enlace que te hemos enviado por correo para restablecer tu contraseña.
            </p>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full text-xs"
            >
              Cerrar
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSendResetEmail} className="space-y-4 py-1">
            <div className="space-y-1.5 text-left">
              <Label htmlFor="reset-email" className="text-xs font-semibold">
                Correo Electrónico
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="reset-email"
                  type="email"
                  required
                  placeholder="nombre@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 text-sm"
                  autoFocus
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading || !email || cooldown > 0}
              className="w-full bg-primary text-primary-foreground font-semibold"
            >
              {isLoading ? (
                'Enviando...'
              ) : cooldown > 0 ? (
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Reintentar en {cooldown}s
                </span>
              ) : (
                'Enviar Correo de Recuperación'
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
