import { supabase } from './client'
import type { FeedbackItem, CreateFeedbackDTO, FeedbackStatus } from '@/types'

export interface SubmitFeedbackResponse {
  success: boolean
  data?: FeedbackItem
  error?: string
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

      return {
        success: true,
        data: {
          id: data.id,
          userId: data.user_id,
          userEmail: data.user_email,
          comment: data.comment,
          category: data.category,
          status: data.status,
          projectId: data.project_id,
          projectName: data.project_name,
          deviceInfo: data.device_info,
          adminNotes: data.admin_notes,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        },
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
   * Consultar feedbacks enviados (los propios del usuario o todos si es administrador)
   */
  async getFeedbacks(): Promise<FeedbackItem[]> {
    try {
      const { data, error } = await supabase
        .from('user_feedback')
        .select('*')
        .order('created_at', { ascending: false })

      if (error || !data) {
        console.error('Error al consultar feedbacks:', error)
        return []
      }

      return data.map(item => ({
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
      }))
    } catch (err) {
      console.error('Error al obtener lista de feedbacks:', err)
      return []
    }
  },

  /**
   * Actualizar el estado de un feedback (ej. nuevo -> aceptado -> planificado -> completado)
   */
  async updateStatus(id: string, status: FeedbackStatus, adminNotes?: string): Promise<boolean> {
    try {
      const updatePayload: Record<string, any> = { status }
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
