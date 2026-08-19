import { useState, useEffect, useRef } from 'react'

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'network-error' | 'concurrency-conflict'

export interface UseAutosaveProps<T> {
  projectId: string
  data: T
  version: number
  enabled?: boolean
  onSave: (data: T, version: number) => Promise<{ success: boolean; version: number }>
  onLoadCloud: () => Promise<{ data: T; version: number }>
  onLocalUpdate: (data: T, version: number) => void
}

/**
 * Strips metadata fields (version, timestamps) to create a clean fingerprint
 * representing only user-modifiable content.
 */
function getCleanDataFingerprint(data: any): string {
  if (!data) return ''
  return JSON.stringify(data, (key, value) => {
    if (key === 'version' || key === 'updatedAt' || key === 'createdAt') {
      return undefined
    }
    return value
  })
}

/**
 * Custom hook to handle automatic data saving (autosave) with optimistic locking concurrency control.
 */
export function useAutosave<T>({
  projectId,
  data,
  version,
  enabled = true,
  onSave,
  onLoadCloud,
  onLocalUpdate,
}: UseAutosaveProps<T>) {
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const [isUiBlocked, setIsUiBlocked] = useState(false)
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false)
  const [currentVersion, setCurrentVersion] = useState(version)
  const [isSavingEnabled, setIsSavingEnabled] = useState(enabled)

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedDataStrRef = useRef<string>('')
  const isInitialLoadRef = useRef(true)
  
  // Store refs to always have access to the latest values in async closures without re-triggering effects
  const dataRef = useRef(data)
  dataRef.current = data
  const currentVersionRef = useRef(currentVersion)
  currentVersionRef.current = currentVersion
  const isSavingEnabledRef = useRef(isSavingEnabled)
  isSavingEnabledRef.current = isSavingEnabled

  // Sync enabled prop with internal state
  useEffect(() => {
    setIsSavingEnabled(enabled)
    if (!enabled) {
      setIsConflictModalOpen(false)
      setIsUiBlocked(false)
      setStatus('idle')
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [enabled])

  // Reset tracking state when projectId changes
  useEffect(() => {
    setCurrentVersion(version)
    currentVersionRef.current = version
    isInitialLoadRef.current = true
    lastSavedDataStrRef.current = getCleanDataFingerprint(data)
  }, [projectId])

  // Keep currentVersion in sync if the initial version prop changes from outside
  useEffect(() => {
    if (version !== currentVersion) {
      setCurrentVersion(version)
      currentVersionRef.current = version
    }
  }, [version])

  // Debounced autosave effect
  useEffect(() => {
    // If saving is disabled, read-only or no data, do not schedule autosave
    if (!data || !enabled || !isSavingEnabledRef.current) {
      return
    }

    const currentDataStr = getCleanDataFingerprint(data)

    // Skip autosaving on initial page/project load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false
      lastSavedDataStrRef.current = currentDataStr
      return
    }

    // Skip autosaving if content data hasn't actually changed from last saved state
    if (currentDataStr === lastSavedDataStrRef.current) {
      return
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(async () => {
      await triggerSave(dataRef.current, currentVersionRef.current)
    }, 2000)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [data, enabled])

  const triggerSave = async (dataToSave: T, versionToSave: number) => {
    if (!enabled || !isSavingEnabledRef.current) {
      return
    }

    // Offline-first check
    if (typeof window !== 'undefined' && navigator && !navigator.onLine) {
      handleNetworkError(dataToSave, versionToSave)
      return
    }

    setStatus('saving')
    try {
      const response = await onSave(dataToSave, versionToSave)
      if (response.success) {
        setCurrentVersion(response.version)
        currentVersionRef.current = response.version
        lastSavedDataStrRef.current = getCleanDataFingerprint(dataToSave)
        
        // Clear local backup on success
        if (typeof window !== 'undefined') {
          localStorage.removeItem(`autumn_autosave_${projectId}`)
        }
        setStatus('saved')
      }
    } catch (error: any) {
      // Check if error is a concurrency mismatch error
      const isConcurrencyError = 
        error && 
        (error.code === 'CONCURRENCY_ERROR' || 
         error.status === 412 || 
         (error.message && error.message.includes('version mismatch')) ||
         (error.message && error.message.includes('concurrency')))

      if (isConcurrencyError) {
        setIsSavingEnabled(false)
        setIsUiBlocked(true)
        setStatus('concurrency-conflict')
        setIsConflictModalOpen(true)
      } else {
        handleNetworkError(dataToSave, versionToSave)
      }
    }
  }

  const handleNetworkError = (dataToSave: T, versionToSave: number) => {
    setStatus('network-error')
    
    // Store local pending update in localStorage as disaster-recovery backup
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          `autumn_autosave_${projectId}`, 
          JSON.stringify({ data: dataToSave, version: versionToSave, timestamp: Date.now() })
        )
      } catch (err) {
        console.warn('Failed to store autosave backup in localStorage', err)
      }
    }
  }

  const resolveConflict = async (resolution: 'cloud' | 'overwrite') => {
    if (resolution === 'cloud') {
      // 1. Keep Cloud: Overwrite local data with cloud data
      try {
        const { data: cloudData, version: cloudVersion } = await onLoadCloud()
        onLocalUpdate(cloudData, cloudVersion)
        setCurrentVersion(cloudVersion)
        currentVersionRef.current = cloudVersion
        lastSavedDataStrRef.current = getCleanDataFingerprint(cloudData)
        
        setIsConflictModalOpen(false)
        setIsUiBlocked(false)
        setIsSavingEnabled(true)
        setStatus('idle')
      } catch (err) {
        console.error('Failed to load cloud version during conflict resolution:', err)
        setStatus('network-error')
      }
    } else {
      // 2. Overwrite Cloud: Force push local data with latest cloud version
      try {
        const { version: latestCloudVersion } = await onLoadCloud()
        
        const response = await onSave(dataRef.current, latestCloudVersion)
        if (response.success) {
          setCurrentVersion(response.version)
          currentVersionRef.current = response.version
          lastSavedDataStrRef.current = getCleanDataFingerprint(dataRef.current)
          
          setIsConflictModalOpen(false)
          setIsUiBlocked(false)
          setIsSavingEnabled(true)
          setStatus('saved')
        }
      } catch (err) {
        console.error('Failed to force overwrite cloud during conflict resolution:', err)
        setStatus('network-error')
      }
    }
  }

  return {
    status,
    isUiBlocked,
    isConflictModalOpen,
    currentVersion,
    resolveConflict,
    triggerSave,
  }
}
