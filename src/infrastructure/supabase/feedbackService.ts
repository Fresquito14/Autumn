import { supabase } from './client'
import type { FeedbackItem, CreateFeedbackDTO, FeedbackStatus, FeedbackCategory } from '@/types'

export interface SubmitFeedbackResponse {
  success: boolean
  data?: FeedbackItem
  error?: string
}

const LOCAL_FEEDBACK_KEY = 'autumn_submitted_feedback_ids'

export function saveLocalFeedbackId(id: string) {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(LOCAL_FEEDBACK_KEY)
    const existing: string[] = raw ? JSON.parse(raw) : []
    if (!existing.includes(id)) {
      localStorage.setItem(LOCAL_FEEDBACK_KEY, JSON.stringify([id, ...existing].slice(0, 50)))
    }
  } catch {
    // ignore local storage errors
  }
}

export function getLocalFeedbackIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LOCAL_FEEDBACK_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export interface UserFeedbackDbRow {
  id: string
  user_id: string | null
  user_email: string | null
  comment: string
  category: FeedbackCategory
  status: FeedbackStatus
  project_id: string | null
  project_name: string | null
  device_info: string | null
  admin_notes: string | null
  created_at: string
  updated_at: string
}

function mapDatabaseRowToFeedbackItem(item: UserFeedbackDbRow): FeedbackItem {
  return {
    id: item.id,
    userId: item.user_id,
    userEmail: item.user_email,
    comment: item.comment,
    category: item.category,
    status: item.status,
    projectId: item.project_id,
    projectName: item.project_name,
    deviceInfo: item.device_info,
    adminNotes: item.admin_notes,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  }
}

export const feedbackService = {
  /**
   * Enviar un nuevo comentario o sugerencia de feedback.
   * Funciona tanto para usuarios autenticados como en modo libre anónimo.
   */
  async submitFeedback(dto: CreateFeedbackDTO): Promise<SubmitFeedbackResponse> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return {
        success: false,
        error: 'Sin conexión a internet. Conéctate a la red para enviar tu sugerencia.',
      }
    }

    if (!dto.comment || !dto.comment.trim()) {
      return {
        success: false,
        error: 'El comentario no puede estar vacío.',
      }
    }

    try {
      const { data: authData } = await supabase.auth.getUser()
      const currentUser = authData?.user

      const payload = {
        user_id: currentUser ? currentUser.id : null,
        user_email: currentUser?.email || dto.userEmail || null,
        comment: dto.comment.trim(),
        category: dto.category || 'suggestion',
        status: 'nuevo' as const,
        project_id: dto.projectId || null,
        project_name: dto.projectName || null,
        device_info: dto.deviceInfo || null,
      }

      const { data, error } = await supabase
        .from('user_feedback')
        .insert(payload)
        .select()
        .single()

      if (error) {
        console.error('Error al guardar feedback en Supabase:', error)
        return {
          success: false,
          error: error.message || 'Error al registrar el feedback en el servidor.',
        }
      }

      const item = mapDatabaseRowToFeedbackItem(data)
      saveLocalFeedbackId(item.id)

      return {
        success: true,
        data: item,
      }
    } catch (err) {
      console.error('Excepción inesperada al enviar feedback:', err)
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Error inesperado de conexión.',
      }
    }
  },

  /**
   * Consultar feedbacks enviados por el usuario actual (tanto por auth como por IDs locales en navegador).
   */
  async getMyFeedbacks(emailFallback?: string): Promise<FeedbackItem[]> {
    try {
      const { data: authData } = await supabase.auth.getUser()
      const currentUser = authData?.user
      const localIds = getLocalFeedbackIds()
      const resultsMap = new Map<string, FeedbackItem>()

      // 1. Si está autenticado, consultar por user_id o email
      if (currentUser) {
        let query = supabase.from('user_feedback').select('*')
        if (currentUser.email) {
          query = query.or(`user_id.eq.${currentUser.id},user_email.eq.${currentUser.email}`)
        } else {
          query = query.eq('user_id', currentUser.id)
        }
        const { data, error } = await query.order('created_at', { ascending: false })
        if (!error && data) {
          data.forEach(d => resultsMap.set(d.id, mapDatabaseRowToFeedbackItem(d)))
        }
      } else if (emailFallback && emailFallback.trim()) {
        // En modo no autenticado, si el usuario especifica su email, filtrar si hay coincidencia
        const { data, error } = await supabase
          .from('user_feedback')
          .select('*')
          .eq('user_email', emailFallback.trim().toLowerCase())
          .order('created_at', { ascending: false })
        if (!error && data) {
          data.forEach(d => resultsMap.set(d.id, mapDatabaseRowToFeedbackItem(d)))
        }
      }

      // 2. Si hay IDs guardados localmente en este navegador, consultar vía RPC segura
      if (localIds.length > 0) {
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('get_feedbacks_by_ids', { p_ids: localIds })
        if (!rpcError && rpcData) {
          (rpcData as UserFeedbackDbRow[]).forEach((d: UserFeedbackDbRow) => {
            if (!resultsMap.has(d.id)) {
              resultsMap.set(d.id, mapDatabaseRowToFeedbackItem(d))
            }
          })
        }
      }

      return Array.from(resultsMap.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    } catch (err) {
      console.error('Error al obtener mis feedbacks:', err)
      return []
    }
  },

  /**
   * Consultar todos los feedbacks (disponible para administradores y managers).
   */
  async getAllFeedbacks(): Promise<FeedbackItem[]> {
    try {
      const { data, error } = await supabase
        .from('user_feedback')
        .select('*')
        .order('created_at', { ascending: false })

      if (error || !data) {
        console.error('Error al consultar feedbacks globales:', error)
        return []
      }

      return (data as UserFeedbackDbRow[]).map(mapDatabaseRowToFeedbackItem)
    } catch (err) {
      console.error('Error al obtener lista global de feedbacks:', err)
      return []
    }
  },

  /**
   * Actualizar el estado y nota de respuesta de un feedback.
   */
  async updateStatus(id: string, status: FeedbackStatus, adminNotes?: string): Promise<boolean> {
    try {
      interface UpdateFeedbackPayload {
        status: FeedbackStatus
        updated_at: string
        admin_notes?: string
      }

      const updatePayload: UpdateFeedbackPayload = {
        status,
        updated_at: new Date().toISOString(),
      }
      if (adminNotes !== undefined) {
        updatePayload.admin_notes = adminNotes
      }

      const { error } = await supabase
        .from('user_feedback')
        .update(updatePayload)
        .eq('id', id)

      if (error) {
        console.error('Error al actualizar estado del feedback:', error)
        return false
      }

      return true
    } catch (err) {
      console.error('Error al actualizar feedback:', err)
      return false
    }
  },
}
