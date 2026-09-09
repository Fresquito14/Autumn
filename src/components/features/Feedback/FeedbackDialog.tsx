import React, { useState, useEffect, useCallback } from 'react'
import {
  Lightbulb,
  Sparkles,
  Bug,
  Rocket,
  MessageSquare,
  Loader2,
  Clock,
  ThumbsUp,
  Calendar,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FolderGit2,
  ShieldCheck,
  Inbox,
  PlusCircle,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { useProject } from '@/hooks/useProject'
import { useDevice } from '@/hooks/useDevice'
import { useOrganization } from '@/hooks/useOrganization'
import { feedbackService } from '@/infrastructure/supabase/feedbackService'
import { AdminFeedbackDialog } from './AdminFeedbackDialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { FeedbackCategory, FeedbackItem, FeedbackStatus } from '@/types'

interface FeedbackDialogProps {
  /** Clases CSS adicionales para el botón disparador */
  triggerClassName?: string
}

const STATUS_CONFIG: Record<
  FeedbackStatus,
  { label: string; icon: React.ComponentType<{ className?: string }>; colorClass: string }
> = {
  nuevo: {
    label: 'Nuevo',
    icon: Clock,
    colorClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
  },
  aceptado: {
    label: 'Aceptado',
    icon: ThumbsUp,
    colorClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  },
  planificado: {
    label: 'Planificado',
    icon: Calendar,
    colorClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30',
  },
  completado: {
    label: 'Completado',
    icon: CheckCircle2,
    colorClass: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30',
  },
  desestimado: {
    label: 'Desestimado',
    icon: XCircle,
    colorClass: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30',
  },
}

const CATEGORY_CONFIG: Record<
  FeedbackCategory,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  suggestion: { label: 'Idea', icon: Sparkles },
  improvement: { label: 'Mejora', icon: Rocket },
  bug: { label: 'Problema', icon: Bug },
  other: { label: 'Otro', icon: MessageSquare },
}

export function FeedbackDialog({ triggerClassName }: FeedbackDialogProps) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'new' | 'my-feedbacks'>('new')
  const [comment, setComment] = useState('')
  const [category, setCategory] = useState<FeedbackCategory>('suggestion')
  const [userEmail, setUserEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Estado del panel de seguimiento de aportaciones
  const [myFeedbacks, setMyFeedbacks] = useState<FeedbackItem[]>([])
  const [isLoadingFeedbacks, setIsLoadingFeedbacks] = useState(false)

  // Estado del diálogo de administración (para gestores/admins)
  const [adminDialogOpen, setAdminDialogOpen] = useState(false)

  const { user } = useAuth()
  const { currentProject } = useProject()
  const { isMobile, isTablet, isDesktop } = useDevice()
  const { userRole, hasManagedOrganization } = useOrganization()

  const isManagerOrAdmin = Boolean(
    hasManagedOrganization ||
      userRole === 'admin' ||
      userRole === 'manager' ||
      user?.email === 'vazquez.martin.gil@gmail.com'
  )

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

  const loadMyFeedbacks = useCallback(async () => {
    setIsLoadingFeedbacks(true)
    try {
      const data = await feedbackService.getMyFeedbacks(user?.email)
      setMyFeedbacks(data)
    } catch {
      // ignore non-blocking fetch error
    } finally {
      setIsLoadingFeedbacks(false)
    }
  }, [user?.email])

  useEffect(() => {
    if (open) {
      loadMyFeedbacks()
    }
  }, [open, loadMyFeedbacks])

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

      if (res.success && res.data) {
        toast.success('¡Muchas gracias por tu feedback!', {
          description: 'Tu aportación ha sido registrada. Puedes ver su estado en la pestaña "Mis Aportaciones".',
        })
        const newItem = res.data
        setMyFeedbacks((prev) => [newItem, ...prev.filter((i) => i.id !== newItem.id)])
        setComment('')
        setUserEmail('')
        setCategory('suggestion')
        setActiveTab('my-feedbacks')
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
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={
              triggerClassName ||
              'h-8 px-2.5 gap-1.5 text-xs font-semibold border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 hover:border-amber-500/70 transition-all shadow-xs shrink-0'
            }
            title="Dejar una sugerencia, idea o consultar tus aportaciones"
          >
            <Lightbulb className="h-4 w-4 text-amber-500 fill-amber-500/30 shrink-0" />
            <span className="font-semibold">Feedback</span>
            {myFeedbacks.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
                {myFeedbacks.length}
              </span>
            )}
          </Button>
        </DialogTrigger>

        <DialogContent className="sm:max-w-xl max-h-[88vh] flex flex-col p-5 sm:p-6">
          <DialogHeader className="pb-3 border-b space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600">
                  <Lightbulb className="h-4 w-4" />
                </div>
                <div>
                  <DialogTitle className="text-base font-semibold">Buzón de Feedback & Sugerencias</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Comparte tus ideas o sigue el estado de tus aportaciones y respuestas.
                  </DialogDescription>
                </div>
              </div>

              {/* Botón de acceso para administradores / gestores */}
              {isManagerOrAdmin && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAdminDialogOpen(true)}
                  className="h-7 px-2 text-xs font-semibold gap-1.5 border-amber-500/30 text-amber-700 dark:text-amber-300 bg-amber-500/5 hover:bg-amber-500/15 shrink-0"
                  title="Abrir panel de administración de feedbacks"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
                  <span className="hidden sm:inline">Panel Admin</span>
                </Button>
              )}
            </div>

            {/* Pestañas de navegación */}
            <div className="flex items-center p-1 bg-muted/60 rounded-lg border border-border/60 mt-3">
              <button
                type="button"
                onClick={() => setActiveTab('new')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium rounded-md transition-all',
                  activeTab === 'new'
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <PlusCircle className="h-3.5 w-3.5 text-amber-500" />
                <span>Nueva Sugerencia</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('my-feedbacks')
                  loadMyFeedbacks()
                }}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium rounded-md transition-all',
                  activeTab === 'my-feedbacks'
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <MessageSquare className="h-3.5 w-3.5 text-primary" />
                <span>Mis Aportaciones</span>
                {myFeedbacks.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="h-4 px-1.5 text-[10px] font-bold rounded-full ml-0.5"
                  >
                    {myFeedbacks.length}
                  </Badge>
                )}
              </button>
            </div>
          </DialogHeader>

          {/* TAB 1: NUEVA SUGERENCIA */}
          {activeTab === 'new' && (
            <form onSubmit={handleSubmit} className="space-y-4 pt-3 flex-1 overflow-y-auto pr-1">
              {/* Selector de Categoría */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">¿De qué se trata?</Label>
                <div className="grid grid-cols-2 gap-2">
                  {categories.map((c) => {
                    const isSelected = category === c.id
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCategory(c.id)}
                        className={cn(
                          'flex items-center gap-2 px-2.5 py-2 rounded-md text-xs font-medium border text-left transition-all',
                          isSelected
                            ? 'border-amber-500/50 bg-amber-500/10 text-foreground ring-1 ring-amber-500/30 font-semibold'
                            : 'border-border bg-card/60 text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                        )}
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
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Explícanos brevemente tu sugerencia o qué podemos hacer para mejorar tu experiencia en Autumn..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground/60 resize-none"
                  disabled={isSubmitting}
                  autoFocus
                />
              </div>

              {/* Email opcional para usuarios anónimos o no autenticados */}
              {!user && (
                <div className="space-y-1.5">
                  <Label htmlFor="feedback-email" className="text-xs font-medium text-foreground">
                    Email de contacto <span className="text-muted-foreground text-[10px]">(opcional para recibir avisos)</span>
                  </Label>
                  <Input
                    id="feedback-email"
                    type="email"
                    placeholder="tu@email.com"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="h-8 text-xs"
                    disabled={isSubmitting}
                  />
                </div>
              )}

              {/* Context badge si hay un proyecto abierto */}
              {currentProject && (
                <div className="text-[11px] text-muted-foreground/80 bg-muted/40 px-2.5 py-1.5 rounded-md flex items-center justify-between border border-border/40">
                  <span className="truncate flex items-center gap-1.5">
                    <FolderGit2 className="h-3 w-3 text-muted-foreground" />
                    Adjuntando contexto de proyecto: <strong>{currentProject.name}</strong>
                  </span>
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex justify-end gap-2 pt-3 border-t border-border">
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
          )}

          {/* TAB 2: SEGUIMIENTO DE MIS APORTACIONES */}
          {activeTab === 'my-feedbacks' && (
            <div className="flex flex-col flex-1 overflow-hidden pt-2 space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground pb-1">
                <span>Consulta el estado en tiempo real y las respuestas del Administrador:</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadMyFeedbacks}
                  disabled={isLoadingFeedbacks}
                  className="h-6 px-2 text-[11px] gap-1 hover:bg-muted"
                  title="Actualizar estado de mis feedbacks"
                >
                  <RefreshCw className={cn('h-3 w-3', isLoadingFeedbacks && 'animate-spin')} />
                  <span>Actualizar</span>
                </Button>
              </div>

              {isLoadingFeedbacks && myFeedbacks.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-muted-foreground text-xs gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span>Cargando tus aportaciones...</span>
                </div>
              ) : myFeedbacks.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted-foreground bg-muted/20 rounded-xl border border-dashed p-6 space-y-3">
                  <Inbox className="h-8 w-8 mx-auto text-muted-foreground/50" />
                  <div>
                    <p className="font-semibold text-foreground">Aún no has enviado ninguna sugerencia</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Tus aportaciones, su estado de desarrollo y las respuestas del equipo aparecerán aquí.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab('new')}
                    className="h-7 text-xs gap-1.5"
                  >
                    <PlusCircle className="h-3.5 w-3.5 text-amber-500" />
                    <span>Crear mi primera sugerencia</span>
                  </Button>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {myFeedbacks.map((item) => {
                    const statusInfo = STATUS_CONFIG[item.status] || STATUS_CONFIG.nuevo
                    const categoryInfo = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.suggestion
                    const CategoryIcon = categoryInfo.icon
                    const StatusIcon = statusInfo.icon
                    const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString('es-ES') : ''

                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border border-border bg-card p-3.5 space-y-2.5 shadow-xs transition-all hover:border-border/80"
                      >
                        {/* Cabecera de la aportación */}
                        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="gap-1 py-0 px-2 font-normal text-[11px]">
                              <CategoryIcon className="h-3 w-3 text-amber-500" />
                              {categoryInfo.label}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">{dateStr}</span>
                          </div>

                          {/* Badge de Estado */}
                          <Badge
                            variant="outline"
                            className={cn('gap-1 py-0.5 px-2 text-[11px] font-semibold', statusInfo.colorClass)}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {statusInfo.label}
                          </Badge>
                        </div>

                        {/* Comentario enviado por el usuario */}
                        <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap bg-muted/20 p-2.5 rounded-lg border border-border/40">
                          {item.comment}
                        </div>

                        {/* Respuesta del Administrador */}
                        {item.adminNotes ? (
                          <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                              <MessageSquare className="h-3.5 w-3.5" />
                              <span>Respuesta del Administrador:</span>
                            </div>
                            <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap pl-5">
                              {item.adminNotes}
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80 pl-1">
                            <Clock className="h-3 w-3 text-muted-foreground/60" />
                            <span>En revisión: pronto recibirás una respuesta del administrador aquí.</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo del Buzón de Administración (Managers / Owners) */}
      {isManagerOrAdmin && (
        <AdminFeedbackDialog
          open={adminDialogOpen}
          onOpenChange={setAdminDialogOpen}
          onFeedbackChanged={loadMyFeedbacks}
        />
      )}
    </>
  )
}
