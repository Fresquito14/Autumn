import { useState, useEffect, useMemo } from 'react'
import {
  Palmtree,
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  CalendarDays,
  UserCheck,
  PartyPopper,
} from 'lucide-react'
import { format, differenceInCalendarDays, isAfter, isBefore, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useResources } from '@/hooks/useResources'
import { useGlobalHolidays } from '@/hooks/useGlobalHolidays'
import { useAuth } from '@/hooks/useAuth'
import type { DateRange, Resource } from '@/types'

export function MyVacationsManagement() {
  const { user } = useAuth()
  const { resources, loadAllResources, updateResource } = useResources()
  const { holidays, loadAllHolidays } = useGlobalHolidays()

  const [selectedResourceId, setSelectedResourceId] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [absenceType, setAbsenceType] = useState<'vacation' | 'leave' | 'other'>('vacation')
  const [reason, setReason] = useState<string>('')
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    loadAllResources()
    loadAllHolidays()
  }, [loadAllResources, loadAllHolidays])

  // Automatically match the current logged-in user to their resource
  useEffect(() => {
    if (resources.length > 0 && !selectedResourceId) {
      if (user?.email) {
        const matched = resources.find(r => r.email?.toLowerCase() === user.email?.toLowerCase())
        if (matched) {
          setSelectedResourceId(matched.id)
          return
        }
      }
      // Fallback: pick the first resource
      setSelectedResourceId(resources[0].id)
    }
  }, [resources, user, selectedResourceId])

  const currentResource = useMemo<Resource | undefined>(() => {
    return resources.find(r => r.id === selectedResourceId)
  }, [resources, selectedResourceId])

  // Normalized vacation list from current resource
  const vacationsList = useMemo<DateRange[]>(() => {
    if (!currentResource?.calendar?.vacations) return []
    return currentResource.calendar.vacations
      .map((v, idx) => ({
        ...v,
        id: v.id || `vacation-${idx}-${new Date(v.start).getTime()}`,
        start: new Date(v.start),
        end: new Date(v.end),
      }))
      .sort((a, b) => b.start.getTime() - a.start.getTime())
  }, [currentResource])

  // Vacation statistics
  const stats = useMemo(() => {
    const today = startOfDay(new Date())
    let totalDays = 0
    let upcomingDays = 0

    vacationsList.forEach(v => {
      const days = Math.max(1, differenceInCalendarDays(v.end, v.start) + 1)
      totalDays += days
      if (isAfter(v.end, today)) {
        upcomingDays += days
      }
    })

    return { totalDays, upcomingDays, count: vacationsList.length }
  }, [vacationsList])

  const handleAddVacation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentResource) return
    setError(null)
    setSuccessMsg(null)

    if (!startDate || !endDate) {
      setError('Por favor, selecciona fecha de inicio y fecha de fin.')
      return
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (isBefore(end, start)) {
      setError('La fecha de fin no puede ser anterior a la fecha de inicio.')
      return
    }

    const newVacation: DateRange = {
      id: crypto.randomUUID(),
      start,
      end,
      type: absenceType,
      reason: reason.trim() || undefined,
    }

    try {
      const existingVacations = currentResource.calendar?.vacations || []
      const updatedVacations = [...existingVacations, newVacation]

      await updateResource(currentResource.id, {
        calendar: {
          ...currentResource.calendar,
          vacations: updatedVacations,
        },
      })

      setSuccessMsg('Período de ausencia registrado correctamente.')
      setStartDate('')
      setEndDate('')
      setReason('')
      setIsAdding(false)
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err) {
      setError((err as Error).message || 'Error al registrar la ausencia.')
    }
  }

  const handleDeleteVacation = async (vacationId: string, vacationStart: Date) => {
    if (!currentResource) return
    if (!confirm('¿Deseas eliminar este período de ausencia?')) return

    try {
      const existingVacations = currentResource.calendar?.vacations || []
      const filtered = existingVacations.filter(v => {
        if (v.id && v.id === vacationId) return false
        // Fallback by date
        return new Date(v.start).getTime() !== new Date(vacationStart).getTime()
      })

      await updateResource(currentResource.id, {
        calendar: {
          ...currentResource.calendar,
          vacations: filtered,
        },
      })
    } catch (err) {
      console.error('Error al eliminar vacaciones:', err)
      alert('No se pudo eliminar la vacación.')
    }
  }

  const getAbsenceBadge = (type?: 'vacation' | 'leave' | 'other') => {
    switch (type) {
      case 'leave':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-xs">Asunto Propio</Badge>
      case 'other':
        return <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 text-xs">Baja / Otro</Badge>
      default:
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs">Vacaciones</Badge>
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-8">
      {/* Header banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-card rounded-xl border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Palmtree className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Mis Vacaciones y Ausencias</h1>
            <p className="text-xs text-muted-foreground">
              Gestiona tus períodos no laborables para no recibir asignaciones en esas fechas
            </p>
          </div>
        </div>

        {/* Resource selector (if multiple resources exist or manager) */}
        {resources.length > 1 && (
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-muted-foreground shrink-0" />
            <select
              value={selectedResourceId}
              onChange={(e) => setSelectedResourceId(e.target.value)}
              className="h-9 px-3 text-xs rounded-lg border bg-background text-foreground shadow-xs focus:ring-1 focus:ring-primary"
            >
              {resources.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.email ? `(${r.email})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="p-4 flex flex-col justify-between">
          <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-emerald-500" />
            Días Totales
          </span>
          <div className="text-2xl font-bold mt-2 text-foreground">
            {stats.totalDays} <span className="text-xs font-normal text-muted-foreground">días</span>
          </div>
        </Card>

        <Card className="p-4 flex flex-col justify-between">
          <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <CalendarIcon className="h-4 w-4 text-sky-500" />
            Próximos Días
          </span>
          <div className="text-2xl font-bold mt-2 text-foreground">
            {stats.upcomingDays} <span className="text-xs font-normal text-muted-foreground">días</span>
          </div>
        </Card>

        <Card className="col-span-2 sm:col-span-1 p-4 flex flex-col justify-between">
          <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <Palmtree className="h-4 w-4 text-amber-500" />
            Períodos
          </span>
          <div className="text-2xl font-bold mt-2 text-foreground">
            {stats.count} <span className="text-xs font-normal text-muted-foreground">registros</span>
          </div>
        </Card>
      </div>

      {/* Success / Error notification */}
      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Add Absence Section */}
      <Card>
        <CardHeader className="p-4 pb-3 border-b flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">
              {isAdding ? 'Registrar Período de Ausencia' : 'Planificar Nueva Ausencia'}
            </CardTitle>
            <CardDescription className="text-xs">
              Indica los días que estarás ausente para sincronizar el calendario del equipo
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant={isAdding ? 'outline' : 'default'}
            onClick={() => {
              setIsAdding(!isAdding)
              setError(null)
            }}
            className="min-h-[44px] min-w-[44px] text-xs font-semibold gap-1.5"
          >
            <Plus className="h-4 w-4" />
            {isAdding ? 'Cerrar' : 'Añadir Ausencia'}
          </Button>
        </CardHeader>

        {isAdding && (
          <CardContent className="p-4 bg-muted/20">
            <form onSubmit={handleAddVacation} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs">Tipo de Ausencia</Label>
                  <select
                    value={absenceType}
                    onChange={(e) => setAbsenceType(e.target.value as 'vacation' | 'leave' | 'other')}
                    className="h-10 px-3 text-xs rounded-lg border bg-background text-foreground shadow-xs"
                  >
                    <option value="vacation">🏖️ Vacaciones</option>
                    <option value="leave">📋 Asunto Propio / Permiso</option>
                    <option value="other">🩺 Baja Médica / Otra Ausencia</option>
                  </select>
                </div>

                <div className="grid gap-1.5">
                  <Label className="text-xs">Fecha Inicio</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-10 text-xs"
                    required
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label className="text-xs">Fecha Fin</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-10 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs">Motivo o Notas (Opcional)</Label>
                <Input
                  placeholder="Ej: Viaje familiar, renovación carnet, etc."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="h-10 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAdding(false)}
                  className="min-h-[44px] text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="min-h-[44px] text-xs font-semibold px-4"
                >
                  Guardar Ausencia
                </Button>
              </div>
            </form>
          </CardContent>
        )}
      </Card>

      {/* List of vacations */}
      <Card>
        <CardHeader className="p-4 pb-2 border-b">
          <CardTitle className="text-sm font-semibold">Períodos Registrados</CardTitle>
          <CardDescription className="text-xs">
            Histórico y próximas ausencias de {currentResource?.name || 'tu recurso'}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {vacationsList.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Palmtree className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-xs">No tienes períodos de vacaciones o ausencias registrados.</p>
              <p className="text-[11px] mt-1 text-muted-foreground/70">
                Pulsa en "Añadir Ausencia" para registrar tus días no laborables.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {vacationsList.map((v) => {
                const days = Math.max(1, differenceInCalendarDays(v.end, v.start) + 1)
                const isUpcoming = isAfter(v.end, startOfDay(new Date()))

                return (
                  <div
                    key={v.id}
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        {v.type === 'leave' ? (
                          <CalendarDays className="h-5 w-5 text-amber-500" />
                        ) : v.type === 'other' ? (
                          <AlertCircle className="h-5 w-5 text-purple-500" />
                        ) : (
                          <Palmtree className="h-5 w-5 text-emerald-500" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-foreground">
                            {format(v.start, "d 'de' MMMM", { locale: es })} – {format(v.end, "d 'de' MMMM yyyy", { locale: es })}
                          </span>
                          {getAbsenceBadge(v.type)}
                          {isUpcoming && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium">
                              Próxima
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                          <span>{days} {days === 1 ? 'día' : 'días'}</span>
                          {v.reason && <span className="truncate max-w-[200px] sm:max-w-xs italic">"{v.reason}"</span>}
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteVacation(v.id!, v.start)}
                      className="min-h-[44px] min-w-[44px] p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                      title="Eliminar período"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Official Company Holidays (Informational) */}
      <Card>
        <CardHeader className="p-4 pb-2 border-b">
          <div className="flex items-center gap-2">
            <PartyPopper className="h-4 w-4 text-primary shrink-0" />
            <CardTitle className="text-sm font-semibold">Festivos Oficiales de la Empresa</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Días no laborables globales ya contemplados automáticamente en el calendario
          </CardDescription>
        </CardHeader>

        <CardContent className="p-3">
          {holidays.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center">
              No hay festivos globales configurados.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {holidays.map(h => (
                <div key={h.id} className="p-2 rounded-md border bg-muted/20 flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground truncate pr-2">{h.name}</span>
                  <span className="text-muted-foreground font-mono text-[11px] shrink-0">
                    {format(new Date(h.date), 'dd/MM/yyyy')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
