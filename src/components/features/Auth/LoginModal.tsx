import { useState } from 'react'
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
import { LogIn, Mail, Lock, AlertCircle, UserPlus } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { PasswordStrengthMeter } from './PasswordStrengthMeter'
import { ResetPasswordDialog } from './ResetPasswordDialog'
import { toast } from 'sonner'

interface LoginModalProps {
  trigger?: React.ReactNode
}

export function LoginModal({ trigger }: LoginModalProps) {
  const [open, setOpen] = useState(false)
  const [isResetOpen, setIsResetOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [localError, setLocalError] = useState<string | null>(null)

  const { loginWithEmail, signupWithEmail, loginWithGoogle, isLoading, error: authError, clearError } = useAuth()

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    clearError()

    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail) {
      setLocalError('Por favor introduce tu correo electrónico')
      return
    }

    if (!password) {
      setLocalError('Por favor introduce tu contraseña')
      return
    }

    try {
      if (authMode === 'signin') {
        await loginWithEmail(cleanEmail, password)
        toast.success('¡Bienvenido de nuevo a Autumn!')
      } else {
        if (password.length < 6) {
          setLocalError('La contraseña debe tener al menos 6 caracteres')
          return
        }
        await signupWithEmail(cleanEmail, password)
        toast.success('¡Cuenta creada y sesión iniciada con éxito!')
      }
      setOpen(false)
    } catch (err: any) {
      const msg = err?.message || ''
      if (msg.toLowerCase().includes('invalid login credentials')) {
        setLocalError('Contraseña incorrecta o usuario no registrado.')
      } else if (msg.toLowerCase().includes('already registered')) {
        setLocalError('Ya existe una cuenta con este correo. Por favor inicia sesión.')
        setAuthMode('signin')
      } else {
        setLocalError(msg || 'Error de autenticación')
      }
    }
  }

  const handleGoogleClick = async () => {
    setLocalError(null)
    clearError()
    try {
      await loginWithGoogle()
    } catch {
      setLocalError('No se pudo conectar con Google OAuth.')
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" size="sm" className="gap-1.5 h-8 font-semibold text-xs border-primary/30">
              <LogIn className="h-3.5 w-3.5" />
              <span>Iniciar Sesión</span>
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center">
            <DialogTitle className="text-xl font-bold">
              {authMode === 'signin' ? 'Iniciar Sesión en Autumn' : 'Crear Cuenta en Autumn'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {authMode === 'signin'
                ? 'Accede a tus proyectos en la nube y organizaciones corporativas.'
                : 'Crea tu cuenta para guardar cronogramas en la nube y colaborar con tu equipo.'}
            </DialogDescription>
          </DialogHeader>

          {/* Mode Selector Tabs */}
          <div className="grid grid-cols-2 p-1 bg-muted rounded-lg text-xs font-semibold my-1">
            <button
              type="button"
              onClick={() => {
                setAuthMode('signin')
                setLocalError(null)
              }}
              className={`py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                authMode === 'signin'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LogIn className="h-3.5 w-3.5" />
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('signup')
                setLocalError(null)
              }}
              className={`py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                authMode === 'signup'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Crear Cuenta
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-3.5 py-1">
            {(localError || authError) && (
              <div className="p-3 bg-destructive/10 text-destructive text-xs rounded-lg flex items-start gap-2 border border-destructive/20 animate-in fade-in">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{localError || authError}</span>
              </div>
            )}

            <div className="space-y-1.5 text-left">
              <Label className="text-xs font-semibold">Correo Electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nombre@empresa.com"
                  className="pl-9 text-sm"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">
                  {authMode === 'signin' ? 'Contraseña' : 'Crea tu Contraseña'}
                </Label>
                {authMode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      setIsResetOpen(true)
                    }}
                    className="text-[11px] text-primary hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9 text-sm"
                />
              </div>
              {authMode === 'signup' && <PasswordStrengthMeter password={password} />}
            </div>

            <Button type="submit" className="w-full font-semibold" disabled={isLoading}>
              {isLoading
                ? 'Verificando...'
                : authMode === 'signin'
                ? 'Iniciar Sesión'
                : 'Crear Cuenta y Entrar'}
            </Button>

            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-muted"></div>
              </div>
              <div className="relative flex justify-center text-[11px] uppercase">
                <span className="bg-card px-2 text-muted-foreground">O continúa con</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 text-xs font-medium"
              onClick={handleGoogleClick}
              disabled={isLoading}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continuar con Google</span>
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <ResetPasswordDialog
        open={isResetOpen}
        onOpenChange={setIsResetOpen}
        initialEmail={email}
      />
    </>
  )
}
