import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAutosave } from '@/hooks/useAutosave'

describe('useAutosave Hook', () => {
  const projectId = 'test-project-123'
  const initialData = { name: 'Autumn Project', tasks: [] }
  const initialVersion = 1

  let onSaveMock: any
  let onLoadCloudMock: any
  let onLocalUpdateMock: any

  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    
    onSaveMock = vi.fn().mockResolvedValue({ success: true, version: 2 })
    onLoadCloudMock = vi.fn().mockResolvedValue({ data: { name: 'Cloud Project', tasks: [] }, version: 2 })
    onLocalUpdateMock = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // 1. Debounce de 2 segundos
  describe('Debounce Behavior', () => {
    it('should not call onSave immediately when data changes', async () => {
      const { result, rerender } = renderHook(
        ({ data }) =>
          useAutosave({
            projectId,
            data,
            version: initialVersion,
            onSave: onSaveMock,
            onLoadCloud: onLoadCloudMock,
            onLocalUpdate: onLocalUpdateMock,
          }),
        {
          initialProps: { data: initialData },
        }
      )

      expect(onSaveMock).not.toHaveBeenCalled()
      expect(result.current.status).toBe('idle')

      // Rerender with changed data
      await act(async () => {
        rerender({ data: { ...initialData, name: 'Updated Name' } })
      })
      
      expect(onSaveMock).not.toHaveBeenCalled()
    })

    it('should trigger onSave only after 2 seconds of inactivity', async () => {
      const { result, rerender } = renderHook(
        ({ data }) =>
          useAutosave({
            projectId,
            data,
            version: initialVersion,
            onSave: onSaveMock,
            onLoadCloud: onLoadCloudMock,
            onLocalUpdate: onLocalUpdateMock,
          }),
        {
          initialProps: { data: initialData },
        }
      )

      // Trigger change 1
      await act(async () => {
        rerender({ data: { ...initialData, name: 'Change 1' } })
      })

      // Advance by 1.5 seconds
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500)
      })
      expect(onSaveMock).not.toHaveBeenCalled()

      // Trigger another change (resets debounce)
      await act(async () => {
        rerender({ data: { ...initialData, name: 'Change 2' } })
      })

      // Advance by 1.5 seconds again
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500)
      })
      expect(onSaveMock).not.toHaveBeenCalled()

      // Advance remaining 500ms to complete 2 seconds since Change 2
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500)
      })

      expect(onSaveMock).toHaveBeenCalledTimes(1)
      expect(onSaveMock).toHaveBeenCalledWith({ ...initialData, name: 'Change 2' }, 1)
      expect(result.current.status).toBe('saved')
    })
  })

  // 2. Respaldo Local (Offline-first)
  describe('Offline-first Local Backup', () => {
    it('should backup data to localStorage and enter network-error status when offline', async () => {
      const onLineSpy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

      const { result, rerender } = renderHook(
        ({ data }) =>
          useAutosave({
            projectId,
            data,
            version: initialVersion,
            onSave: onSaveMock,
            onLoadCloud: onLoadCloudMock,
            onLocalUpdate: onLocalUpdateMock,
          }),
        {
          initialProps: { data: initialData },
        }
      )

      const updatedData = { ...initialData, name: 'Offline Changes' }
      await act(async () => {
        rerender({ data: updatedData })
      })

      // Advance timers by 2 seconds to trigger saving
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })

      expect(onSaveMock).not.toHaveBeenCalled()
      expect(result.current.status).toBe('network-error')

      const localBackup = localStorage.getItem(`autumn_autosave_${projectId}`)
      expect(localBackup).not.toBeNull()
      
      const parsedBackup = JSON.parse(localBackup!)
      expect(parsedBackup.data).toEqual(updatedData)
      expect(parsedBackup.version).toBe(initialVersion)

      onLineSpy.mockRestore()
    })

    it('should backup data to localStorage and enter network-error status if saving throws a network error', async () => {
      // Mock onSave to throw a network error
      onSaveMock.mockRejectedValueOnce(new Error('Failed to fetch'))

      const { result, rerender } = renderHook(
        ({ data }) =>
          useAutosave({
            projectId,
            data,
            version: initialVersion,
            onSave: onSaveMock,
            onLoadCloud: onLoadCloudMock,
            onLocalUpdate: onLocalUpdateMock,
          }),
        {
          initialProps: { data: initialData },
        }
      )

      const updatedData = { ...initialData, name: 'Unstable Connection Changes' }
      await act(async () => {
        rerender({ data: updatedData })
      })

      // Advance timers by 2 seconds to trigger saving
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })

      expect(onSaveMock).toHaveBeenCalledTimes(1)
      expect(result.current.status).toBe('network-error')

      const localBackup = localStorage.getItem(`autumn_autosave_${projectId}`)
      expect(localBackup).not.toBeNull()
      
      const parsedBackup = JSON.parse(localBackup!)
      expect(parsedBackup.data).toEqual(updatedData)
    })
  })

  // 3. Control de Concurrencia (Bloqueo Optimista)
  describe('Concurrency Control (Optimistic Locking)', () => {
    it('should block UI, open conflict modal, and stop autosaving on concurrency error', async () => {
      // Create a concurrency error
      const concurrencyError: any = new Error('Version mismatch')
      concurrencyError.code = 'CONCURRENCY_ERROR'
      onSaveMock.mockRejectedValueOnce(concurrencyError)

      const { result, rerender } = renderHook(
        ({ data }) =>
          useAutosave({
            projectId,
            data,
            version: initialVersion,
            onSave: onSaveMock,
            onLoadCloud: onLoadCloudMock,
            onLocalUpdate: onLocalUpdateMock,
          }),
        {
          initialProps: { data: initialData },
        }
      )

      const updatedData = { ...initialData, name: 'Conflicting Change' }
      await act(async () => {
        rerender({ data: updatedData })
      })

      // Trigger autosave
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })

      expect(onSaveMock).toHaveBeenCalledTimes(1)
      expect(result.current.status).toBe('concurrency-conflict')
      expect(result.current.isUiBlocked).toBe(true)
      expect(result.current.isConflictModalOpen).toBe(true)

      // Test that autosaving stops (changing data again shouldn't trigger new saves)
      onSaveMock.mockClear()
      await act(async () => {
        rerender({ data: { ...updatedData, name: 'Change after conflict' } })
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })

      expect(onSaveMock).not.toHaveBeenCalled()
    })
  })

  // 4. Resolución de Conflictos
  describe('Conflict Resolution', () => {
    let hookResult: any
    let rerenderHook: any

    beforeEach(async () => {
      // Trigger a concurrency conflict first to place the hook in conflict state
      const concurrencyError: any = new Error('Version mismatch')
      concurrencyError.code = 'CONCURRENCY_ERROR'
      onSaveMock.mockRejectedValueOnce(concurrencyError)

      const rendered = renderHook(
        ({ data }) =>
          useAutosave({
            projectId,
            data,
            version: initialVersion,
            onSave: onSaveMock,
            onLoadCloud: onLoadCloudMock,
            onLocalUpdate: onLocalUpdateMock,
          }),
        {
          initialProps: { data: initialData },
        }
      )

      hookResult = rendered.result
      rerenderHook = rendered.rerender

      await act(async () => {
        rerenderHook({ data: { ...initialData, name: 'Conflict Data' } })
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })

      // Verify we are in conflict
      expect(hookResult.current.status).toBe('concurrency-conflict')
      expect(hookResult.current.isUiBlocked).toBe(true)
      expect(hookResult.current.isConflictModalOpen).toBe(true)
      
      // Clear mocks for clean resolution testing
      onSaveMock.mockClear()
      onLoadCloudMock.mockClear()
    })

    it('should load server version, discard local changes, reset UI block and resume autosave when selecting "cloud"', async () => {
      const serverData = { name: 'Cloud Master Version', tasks: [] }
      const serverVersion = 5
      onLoadCloudMock.mockResolvedValueOnce({ data: serverData, version: serverVersion })

      // Resolve conflict by loading cloud
      await act(async () => {
        await hookResult.current.resolveConflict('cloud')
      })

      expect(onLoadCloudMock).toHaveBeenCalledTimes(1)
      expect(onLocalUpdateMock).toHaveBeenCalledWith(serverData, serverVersion)
      expect(hookResult.current.currentVersion).toBe(serverVersion)
      expect(hookResult.current.isUiBlocked).toBe(false)
      expect(hookResult.current.isConflictModalOpen).toBe(false)
      expect(hookResult.current.status).toBe('idle')

      // Test that autosaving has resumed
      await act(async () => {
        rerenderHook({ data: { ...serverData, name: 'Post Conflict Edit' } })
      })
      onSaveMock.mockResolvedValueOnce({ success: true, version: serverVersion + 1 })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })

      expect(onSaveMock).toHaveBeenCalledTimes(1)
      expect(onSaveMock).toHaveBeenCalledWith({ ...serverData, name: 'Post Conflict Edit' }, serverVersion)
      expect(hookResult.current.status).toBe('saved')
    })

    it('should force save, increment version, reset UI block, and resume autosave when selecting "overwrite"', async () => {
      const serverVersion = 5
      // Mock onLoadCloud to return the version currently on the server
      onLoadCloudMock.mockResolvedValueOnce({ data: { name: 'Cloud Version' }, version: serverVersion })
      
      // Mock onSave to succeed when retrying with the incremented version (serverVersion + 1 = 6)
      onSaveMock.mockResolvedValueOnce({ success: true, version: 6 })

      // Resolve conflict by overwriting
      await act(async () => {
        await hookResult.current.resolveConflict('overwrite')
      })

      expect(onLoadCloudMock).toHaveBeenCalledTimes(1)
      // Should save local data with version = serverVersion + 1 (which is 6)
      expect(onSaveMock).toHaveBeenCalledTimes(1)
      expect(onSaveMock).toHaveBeenCalledWith({ ...initialData, name: 'Conflict Data' }, serverVersion)
      
      expect(hookResult.current.currentVersion).toBe(6)
      expect(hookResult.current.isUiBlocked).toBe(false)
      expect(hookResult.current.isConflictModalOpen).toBe(false)
      expect(hookResult.current.status).toBe('saved')
    })
  })
})
