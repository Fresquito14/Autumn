import { useState } from 'react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { KeyRound, AlertCircle, Sparkles } from 'lucide-react'
import { useOrganization } from '@/hooks/useOrganization'
import { toast } from 'sonner'

interface JoinOrganizationDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactNode
}

export function JoinOrganizationDialog({
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  trigger,
}: JoinOrganizationDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? setControlledOpen! : setInternalOpen

  const [code, setCode] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const { joinOrganizationByCode, isLoading } = useOrganization()

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)

    const cleanCode = code.trim().toUpperCase()
    if (!cleanCode) {
      setLocalError('Por favor introduce el código de la organización')
      return
    }

    try {
      await joinOrganizationByCode(cleanCode)
      toast.success('¡Te has unido a la organización con éxito!', {
        description: 'Ya tienes acceso a los proyectos y al cronograma de la organización.',
      })
      setCode('')
      setOpen(false)
    } catch (err: any) {
      setLocalError(err?.message || 'Código de organización no válido o inexistente')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-2 p-3 rounded-full bg-primary/10 text-primary w-fit">
            <KeyRound className="h-6 w-6" />
          </div>
          <DialogTitle className="text-xl font-bold">
            Unirse a una Organización
          </DialogTitle>
          <DialogDescription className="text-xs">
            Introduce el código único proporcionado por el gestor de la organización (ej: <span className="font-mono font-semibold">ORG-7492</span>).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleJoin} className="space-y-4 py-2">
          {localError && (
            <div className="p-3 bg-destructive/10 text-destructive text-xs rounded-lg flex items-start gap-2 border border-destructive/20 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{localError}</span>
            </div>
          )}

          <div className="space-y-1.5 text-left">
            <Label htmlFor="org-code-input" className="text-xs font-semibold">
              Código de Organización
            </Label>
            <div className="relative">
              <Input
                id="org-code-input"
                type="text"
                required
                placeholder="ORG-XXXX"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="font-mono text-center uppercase tracking-widest text-base font-bold h-11"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              Al unirte podrás colaborar en los proyectos compartidos y crear tus propios cronogramas.
            </p>
          </div>

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !code.trim()}
              className="gap-1.5 text-xs font-semibold"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {isLoading ? 'Uniéndose...' : 'Unirse a la Organización'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
