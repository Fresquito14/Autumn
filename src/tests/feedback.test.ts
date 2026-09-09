import { describe, it, expect, vi, beforeEach } from 'vitest'
import { feedbackService } from '@/infrastructure/supabase/feedbackService'
import { supabase } from '@/infrastructure/supabase/client'
import type { CreateFeedbackDTO } from '@/types'

// Mock supabase client
vi.mock('@/infrastructure/supabase/client', () => {
  return {
    supabase: {
      auth: {
        getUser: vi.fn(),
      },
      from: vi.fn(),
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    },
  }
})

describe('feedbackService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects submission when comment is empty or only whitespace', async () => {
    const dto: CreateFeedbackDTO = {
      comment: '   ',
      category: 'suggestion',
    }

    const res = await feedbackService.submitFeedback(dto)
    expect(res.success).toBe(false)
    expect(res.error).toContain('no puede estar vacío')
  })

  it('submits feedback successfully for authenticated user', async () => {
    const mockUser = { id: 'user-123', email: 'test@autumn.app' }
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: { user: mockUser as any },
      error: null,
    })

    const mockInsertedRow = {
      id: 'fb-uuid-1',
      user_id: 'user-123',
      user_email: 'test@autumn.app',
      comment: 'Me gustaría poder cambiar el color de las barras de Gantt.',
      category: 'suggestion',
      status: 'nuevo',
      project_id: 'proj-1',
      project_name: 'Proyecto Alpha',
      device_info: 'desktop',
      admin_notes: null,
      created_at: '2026-09-08T00:00:00Z',
      updated_at: '2026-09-08T00:00:00Z',
    }

    const mockSelect = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValueOnce({ data: mockInsertedRow, error: null }),
    })
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
    vi.mocked(supabase.from).mockReturnValue({ insert: mockInsert } as any)

    const res = await feedbackService.submitFeedback({
      comment: 'Me gustaría poder cambiar el color de las barras de Gantt.',
      category: 'suggestion',
      projectId: 'proj-1',
      projectName: 'Proyecto Alpha',
    })

    expect(res.success).toBe(true)
    expect(res.data?.id).toBe('fb-uuid-1')
    expect(res.data?.status).toBe('nuevo')
    expect(res.data?.userEmail).toBe('test@autumn.app')
  })

  it('allows anonymous feedback when no authenticated user exists', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: { user: null as any },
      error: null,
    })

    const mockInsertedRow = {
      id: 'fb-uuid-anon',
      user_id: null,
      user_email: 'anon@example.com',
      comment: 'Enlace roto en la documentación.',
      category: 'bug',
      status: 'nuevo',
      project_id: null,
      project_name: null,
      device_info: 'mobile',
      admin_notes: null,
      created_at: '2026-09-08T00:00:00Z',
      updated_at: '2026-09-08T00:00:00Z',
    }

    const mockSelect = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValueOnce({ data: mockInsertedRow, error: null }),
    })
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
    vi.mocked(supabase.from).mockReturnValue({ insert: mockInsert } as any)

    const res = await feedbackService.submitFeedback({
      comment: 'Enlace roto en la documentación.',
      category: 'bug',
      userEmail: 'anon@example.com',
    })

    expect(res.success).toBe(true)
    expect(res.data?.userId).toBeNull()
    expect(res.data?.userEmail).toBe('anon@example.com')
  })

  it('updates feedback status correctly', async () => {
    const mockEq = vi.fn().mockResolvedValueOnce({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any)

    const success = await feedbackService.updateStatus('fb-uuid-1', 'aceptado', 'Planificar para Q4')
    expect(success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'aceptado',
        admin_notes: 'Planificar para Q4',
      })
    )
  })

  it('fetches user feedbacks correctly with getMyFeedbacks', async () => {
    const mockUser = { id: 'user-456', email: 'me@autumn.app' }
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: { user: mockUser as any },
      error: null,
    })

    const mockRows = [
      {
        id: 'fb-1',
        user_id: 'user-456',
        user_email: 'me@autumn.app',
        comment: 'Mi aportación 1',
        category: 'improvement',
        status: 'completado',
        project_id: null,
        project_name: null,
        device_info: null,
        admin_notes: 'Respuesta del admin',
        created_at: '2026-09-08T00:00:00Z',
        updated_at: '2026-09-08T00:00:00Z',
      },
    ]

    const mockOrder = vi.fn().mockResolvedValueOnce({ data: mockRows, error: null })
    const mockOr = vi.fn().mockReturnValue({ order: mockOrder })
    const mockSelect = vi.fn().mockReturnValue({ or: mockOr })
    vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any)

    const list = await feedbackService.getMyFeedbacks()
    expect(list.length).toBe(1)
    expect(list[0].id).toBe('fb-1')
    expect(list[0].adminNotes).toBe('Respuesta del admin')
    expect(list[0].status).toBe('completado')
  })
})
