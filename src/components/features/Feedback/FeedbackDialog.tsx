import React, { useState } from 'react'
import { Lightbulb, Sparkles, Bug, Rocket, MessageSquare, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { useProject } from '@/hooks/useProject'
import { useDevice } from '@/hooks/useDevice'
import { feedbackService } from '@/infrastructure/supabase/feedbackService'
import { toast } from 'sonner'
import type { FeedbackCategory } from '@/types'

interface FeedbackDialogProps {
  /** Clases CSS adicionales para el botón disparador */
  triggerClassName?: string
}

export function FeedbackDialog({ triggerClassName }: FeedbackDialogProps) {
  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [category, setCategory] = useState<FeedbackCategory>('suggestion')
  const [userEmail, setUserEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { user } = useAuth()
  const { currentProject } = useProject()
  const { isMobile, isTablet, isDesktop } = useDevice()

  const categories: { id: FeedbackCategory; label: string; icon: React.ReactNode; desc: string }[] = [
    {
      id: 'suggestion',
      label: 'Idea',
      icon: <Sparkles className="h-3.5 w-3.5 text-amber-500" />,
      desc: 'Nueva funcionalidad o propuesta de valor',
    },
    {
      id: 'improvement',
      label: 'Mejora',
      icon: <Rocket className="h-3.5 w-3.5 text-blue-500" />,
      desc: 'Optimizar algo existente en Autumn',
    },
    {
      id: 'bug',
      label: 'Problema',
      icon: <Bug className="h-3.5 w-3.5 text-rose-500" />,
      desc: 'Reportar un error o comportamiento inesperado',
    },
    {
      id: 'other',
      label: 'Otro',
      icon: <MessageSquare className="h-3.5 w-3.5 text-slate-500" />,
      desc: 'Cualquier otro comentario o sugerencia',
    },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!comment.trim()) {
      toast.error('Por favor escribe tu comentario o sugerencia.')
      return
    }

    if (comment.trim().length < 8) {
      toast.error('Por favor proporciona un poco más de detalle (mínimo 8 caracteres).')
      return
    }

    setIsSubmitting(true)

    const deviceType = isMobile ? 'smartphone' : isTablet ? 'tablet' : isDesktop ? 'desktop' : 'unknown'
    const deviceInfo = `${deviceType} (${navigator.userAgent.slice(0, 80)})`

    try {
      const res = await feedbackService.submitFeedback({
        comment: comment.trim(),
        category,
        projectId: currentProject?.id || null,
        projectName: currentProject?.name || null,
        deviceInfo,
        userEmail: user?.email || (userEmail.trim() ? userEmail.trim() : null),
      })

      if (res.success) {
        toast.success('¡Muchas gracias por tu feedback!', {
          description: 'Tu sugerencia se ha registrado y será revisada para el desarrollo de Autumn.',
        })
        setComment('')
        setUserEmail('')
        setCategory('suggestion')
        setOpen(false)
      } else {
        toast.error('No se pudo enviar el feedback', {
          description: res.error || 'Por favor inténtalo de nuevo.',
        })
      }
    } catch {
      toast.error('Error inesperado al enviar feedback.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={
            triggerClassName ||
            'h-8 w-8 p-0 text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-colors'
          }
          title="Dejar una sugerencia o idea de mejora"
        >
          <Lightbulb className="h-4 w-4" />
          <span className="sr-only">Feedback</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-500 mb-1">
            <div className="p-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
              <Lightbulb className="h-4 w-4" />
            </div>
            <DialogTitle className="text-base font-semibold">¿Tienes una idea o sugerencia?</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Queremos que Autumn sea la mejor herramienta para ti. Comparte tus propuestas o avísanos de cualquier incidencia.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Selector de Categoría */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">¿De qué se trata?</Label>
            <div className="grid grid-cols-2 gap-2">
              {categories.map(c => {
                const isSelected = category === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-md text-xs font-medium border text-left transition-all ${
                      isSelected
                        ? 'border-amber-500/50 bg-amber-500/10 text-foreground ring-1 ring-amber-500/30 font-semibold'
                        : 'border-border bg-card/60 text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    }`}
                  >
                    {c.icon}
                    <div className="truncate">
                      <div>{c.label}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Campo de Comentario */}
          <div className="space-y-1.5">
            <Label htmlFor="feedback-comment" className="text-xs font-medium text-foreground">
              Tu comentario o sugerencia
            </Label>
            <textarea
              id="feedback-comment"
              rows={4}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Explícanos brevemente tu sugerencia o qué podemos hacer para mejorar tu experiencia..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground/60 resize-none"
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          {/* Email opcional para usuarios anónimos o no autenticados */}
          {!user && (
            <div className="space-y-1.5">
              <Label htmlFor="feedback-email" className="text-xs font-medium text-foreground">
                Email de contacto <span className="text-muted-foreground text-[10px]">(opcional)</span>
              </Label>
              <Input
                id="feedback-email"
                type="email"
                placeholder="tu@email.com"
                value={userEmail}
                onChange={e => setUserEmail(e.target.value)}
                className="h-8 text-xs"
                disabled={isSubmitting}
              />
            </div>
          )}

          {/* Context badge si hay un proyecto abierto */}
          {currentProject && (
            <div className="text-[11px] text-muted-foreground/80 bg-muted/40 px-2.5 py-1.5 rounded-md flex items-center justify-between border border-border/40">
              <span className="truncate">
                Adjuntando contexto de proyecto: <strong>{currentProject.name}</strong>
              </span>
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
              className="h-8 text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !comment.trim()}
              className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Lightbulb className="h-3.5 w-3.5" />
                  Enviar sugerencia
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
