import React, { useState, useEffect, useCallback } from 'react'
import {
  ShieldAlert,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ThumbsUp,
  Calendar,
  XCircle,
  MessageSquare,
  Sparkles,
  Bug,
  Rocket,
  Send,
  Loader2,
  RefreshCw,
  FolderGit2,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { feedbackService } from '@/infrastructure/supabase/feedbackService'
import type { FeedbackItem, FeedbackStatus, FeedbackCategory } from '@/types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface AdminFeedbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFeedbackChanged?: () => void
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

export function AdminFeedbackDialog({
  open,
  onOpenChange,
  onFeedbackChanged,
}: AdminFeedbackDialogProps) {
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  const loadFeedbacks = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await feedbackService.getAllFeedbacks()
      setItems(data)
      const initialNotes: Record<string, string> = {}
      data.forEach((i) => {
        initialNotes[i.id] = i.adminNotes || ''
      })
      setEditingNotes(initialNotes)
    } catch {
      toast.error('Error al cargar la lista de feedbacks')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      loadFeedbacks()
    }
  }, [open, loadFeedbacks])

  const handleStatusChange = async (id: string, newStatus: FeedbackStatus) => {
    try {
      const currentNote = editingNotes[id] || ''
      const ok = await feedbackService.updateStatus(id, newStatus, currentNote)
      if (ok) {
        setItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
        )
        toast.success(`Estado actualizado a "${STATUS_CONFIG[newStatus].label}"`)
        onFeedbackChanged?.()
      } else {
        toast.error('No se pudo actualizar el estado')
      }
    } catch {
      toast.error('Error al actualizar estado')
    }
  }

  const handleSaveResponse = async (item: FeedbackItem) => {
    const note = editingNotes[item.id] || ''
    setSavingId(item.id)
    try {
      const ok = await feedbackService.updateStatus(item.id, item.status, note)
      if (ok) {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, adminNotes: note } : i))
        )
        toast.success('Respuesta del Administrador guardada y publicada al usuario')
        onFeedbackChanged?.()
      } else {
        toast.error('No se pudo guardar la respuesta')
      }
    } catch {
      toast.error('Error al guardar respuesta')
    } finally {
      setSavingId(null)
    }
  }

  const filteredItems = items.filter((i) => {
    if (statusFilter !== 'all' && i.status !== statusFilter) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchComment = i.comment.toLowerCase().includes(q)
      const matchUser = (i.userEmail || '').toLowerCase().includes(q)
      const matchNotes = (i.adminNotes || '').toLowerCase().includes(q)
      return matchComment || matchUser || matchNotes
    }
    return true
  })

  const newCount = items.filter((i) => i.status === 'nuevo').length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader className="pb-3 border-b">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  Buzón de Administración de Feedback
                  {newCount > 0 && (
                    <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] px-1.5 py-0">
                      {newCount} {newCount === 1 ? 'nuevo' : 'nuevos'}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Gestiona las sugerencias de los usuarios, cambia su estado y publica respuestas directas.
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadFeedbacks}
              disabled={isLoading}
              className="h-8 text-xs gap-1.5 shrink-0"
              title="Recargar feedbacks"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
              <span className="hidden sm:inline">Refrescar</span>
            </Button>
          </div>

          {/* Filtros y búsqueda */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por comentario, usuario o respuesta..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 text-xs rounded-md border border-input bg-background px-2 py-1 shadow-xs"
              >
                <option value="all">Todos los estados ({items.length})</option>
                <option value="nuevo">Nuevos ({items.filter((i) => i.status === 'nuevo').length})</option>
                <option value="aceptado">Aceptados ({items.filter((i) => i.status === 'aceptado').length})</option>
                <option value="planificado">Planificados ({items.filter((i) => i.status === 'planificado').length})</option>
                <option value="completado">Completados ({items.filter((i) => i.status === 'completado').length})</option>
                <option value="desestimado">Desestimados ({items.filter((i) => i.status === 'desestimado').length})</option>
              </select>
            </div>
          </div>
        </DialogHeader>

        {/* Lista de aportaciones */}
        <div className="flex-1 overflow-y-auto space-y-3 py-4 pr-1">
          {isLoading && items.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground text-xs gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span>Cargando buzón de feedback...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground bg-muted/20 rounded-xl border border-dashed p-6">
              No hay registros de feedback con los filtros seleccionados.
            </div>
          ) : (
            filteredItems.map((item) => {
              const statusInfo = STATUS_CONFIG[item.status] || STATUS_CONFIG.nuevo
              const categoryInfo = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.suggestion
              const CategoryIcon = categoryInfo.icon
              const StatusIcon = statusInfo.icon
              const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString('es-ES') : ''
              const isSavingThis = savingId === item.id

              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs transition-all hover:border-border/80"
                >
                  {/* Encabezado de la aportación */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2.5">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <Badge variant="outline" className="gap-1 py-0 px-2 font-normal text-[11px]">
                        <CategoryIcon className="h-3 w-3 text-amber-500" />
                        {categoryInfo.label}
                      </Badge>
                      <span className="font-semibold text-foreground">
                        {item.userEmail || 'Usuario Anónimo'}
                      </span>
                      {item.projectName && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <FolderGit2 className="h-3 w-3" />
                          {item.projectName}
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground">· {dateStr}</span>
                    </div>

                    {/* Selector de Estado */}
                    <div className="flex items-center gap-2">
                      <Select
                        value={item.status}
                        onValueChange={(val) => handleStatusChange(item.id, val as FeedbackStatus)}
                      >
                        <SelectTrigger className={cn('h-7 text-xs font-semibold px-2 gap-1.5 w-36', statusInfo.colorClass)}>
                          <StatusIcon className="h-3.5 w-3.5 shrink-0" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                            const Icon = cfg.icon
                            return (
                              <SelectItem key={key} value={key} className="text-xs">
                                <div className="flex items-center gap-2">
                                  <Icon className="h-3.5 w-3.5" />
                                  <span>{cfg.label}</span>
                                </div>
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Texto del comentario del usuario */}
                  <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap bg-muted/20 p-2.5 rounded-lg border border-border/40">
                    {item.comment}
                  </p>

                  {/* Sección de Respuesta del Administrador */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5 text-primary" />
                        Respuesta del Administrador (visible para el usuario)
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
                      <textarea
                        rows={2}
                        value={editingNotes[item.id] ?? ''}
                        onChange={(e) =>
                          setEditingNotes((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        placeholder="Escribe la respuesta o explicación que verá el usuario en su panel..."
                        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring resize-none leading-relaxed"
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={isSavingThis}
                        onClick={() => handleSaveResponse(item)}
                        className="h-9 sm:h-8 text-xs font-semibold gap-1.5 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        {isSavingThis ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        <span>Guardar</span>
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
