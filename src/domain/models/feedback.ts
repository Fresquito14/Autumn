export type FeedbackStatus = 'nuevo' | 'aceptado' | 'planificado' | 'completado' | 'desestimado'

export type FeedbackCategory = 'suggestion' | 'bug' | 'improvement' | 'other'

export interface FeedbackItem {
  id: string
  userId?: string | null
  userEmail?: string | null
  comment: string
  category: FeedbackCategory
  status: FeedbackStatus
  projectId?: string | null
  projectName?: string | null
  deviceInfo?: string | null
  adminNotes?: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateFeedbackDTO {
  comment: string
  category?: FeedbackCategory
  projectId?: string | null
  projectName?: string | null
  deviceInfo?: string | null
  userEmail?: string | null
}
