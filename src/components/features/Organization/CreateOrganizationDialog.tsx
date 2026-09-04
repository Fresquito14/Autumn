import { useState, useEffect } from 'react'
import { Building2, Sparkles, Plus, ArrowRight, KeyRound, AlertCircle, Users } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface CreateOrganizationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isMandatoryOnboarding?: boolean
  initialCode?: string | null
}

export function CreateOrganizationDialog({
  open,
  onOpenChange,
  isMandatoryOnboarding = false,
  initialCode = null,
}: CreateOrganizationDialogProps) {
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [orgName, setOrgName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const { createOrganization, joinOrganizationByCode } = useOrganization()

  // Pre-fill code and switch tab if initialCode is supplied via URL
  useEffect(() => {
    if (initialCode) {
      setJoinCode(initialCode.toUpperCase().trim())
      setMode('join')
    }
  }, [initialCode])

  const clearUrlInviteParam = () => {
    if (typeof window !== 'undefined' && (window.location.search.includes('code=') || window.location.search.includes('invite='))) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    const trimmed = orgName.trim()
    if (!trimmed) {
      setErrorMsg('Por favor introduce el nombre de la organización.')
      return
    }

    setIsLoading(true)
    try {
      const newOrg = await createOrganization(trimmed)
      toast.success(`Organización "${newOrg.name}" creada con éxito`, {
        description: 'Ahora eres el Gestor de tu propio espacio corporativo.',
      })
      setOrgName('')
      clearUrlInviteParam()
      onOpenChange(false)
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al crear la organización')
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    const cleanCode = joinCode.trim().toUpperCase()
    if (!cleanCode) {
      setErrorMsg('Por favor introduce el código de organización (ej. ORG-7492).')
      return
    }

    setIsLoading(true)
    try {
      await joinOrganizationByCode(cleanCode)
      toast.success('¡Te has unido a la organización con éxito!', {
        description: 'Ya tienes acceso a los proyectos y al cronograma compartido.',
      })
      setJoinCode('')
      clearUrlInviteParam()
      onOpenChange(false)
    } catch (err: any) {
      setErrorMsg(err?.message || 'Código de organización no válido o inexistente')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        // Prevent closing if it's mandatory onboarding and user has no organization yet
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
              {mode === 'create' ? <Building2 className="h-5 w-5" /> : <KeyRound className="h-5 w-5" />}
            </div>
            <div>
              <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary mb-0.5">
                <Sparkles className="h-3 w-3" />
                {isMandatoryOnboarding ? 'Bienvenido a Autumn' : 'Espacio de Trabajo'}
              </div>
              <DialogTitle className="text-xl font-bold">
                {isMandatoryOnboarding
                  ? (mode === 'create' ? 'Configura tu Espacio de Trabajo' : 'Unirse al Espacio de Trabajo')
                  : (mode === 'create' ? 'Crear Organización' : 'Unirse a Organización')}
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-xs leading-relaxed pt-1">
            {isMandatoryOnboarding
              ? 'Para comenzar a trabajar en la nube necesitas un espacio corporativo. Puedes fundar tu propia empresa o unirte a un equipo existente.'
              : 'Gestiona la pertenencia a tus organizaciones y colabora en proyectos.'}
          </DialogDescription>
        </DialogHeader>

        {/* 2-Option Tab Selector for Onboarding */}
        <div className="grid grid-cols-2 p-1 bg-muted rounded-xl text-xs font-semibold my-1">
          <button
            type="button"
            onClick={() => {
              setMode('create')
              setErrorMsg(null)
            }}
            className={cn(
              'py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer',
              mode === 'create'
                ? 'bg-card text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Building2 className="h-3.5 w-3.5" />
            Crear Espacio
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('join')
              setErrorMsg(null)
            }}
            className={cn(
              'py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer',
              mode === 'join'
                ? 'bg-card text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <KeyRound className="h-3.5 w-3.5" />
            Unirme con Código
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-destructive/10 text-destructive text-xs rounded-lg flex items-start gap-2 border border-destructive/20 animate-in fade-in">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {mode === 'create' ? (
          <form onSubmit={handleCreate} className="space-y-4 py-2">
            <div className="space-y-1.5 text-left">
              <Label htmlFor="org-name" className="text-xs font-semibold">
                Nombre de la Empresa u Organización
              </Label>
              <Input
                id="org-name"
                type="text"
                placeholder="Ej. Fresh Analytics Inc."
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="text-sm"
                required
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                Serás el Administrador del espacio y podrás crear proyectos e invitar a otros compañeros.
              </p>
            </div>

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
                    Crear y Comenzar
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={handleJoin} className="space-y-4 py-2">
            <div className="space-y-1.5 text-left">
              <Label htmlFor="org-code" className="text-xs font-semibold">
                Código de Organización
              </Label>
              <Input
                id="org-code"
                type="text"
                placeholder="ORG-XXXX"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="font-mono text-center uppercase tracking-widest text-base font-bold h-11"
                required
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground text-center">
                Pídele el código de unión al Administrador de tu empresa (ej: <span className="font-mono font-semibold">ORG-7492</span>).
              </p>
            </div>

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
                disabled={isLoading || !joinCode.trim()}
                className="w-full bg-primary text-primary-foreground font-semibold"
              >
                {isLoading ? (
                  'Validando código...'
                ) : (
                  <>
                    <Users className="h-4 w-4 mr-1.5" />
                    Unirme al Equipo
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
