import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { supabaseSyncService } from '@/lib/supabase/db_service'
import { db } from '@/lib/storage/db'
import { useTasks } from './useTasks'
import { useDependencies } from './useDependencies'
import { useMilestones } from './useMilestones'
import { useProject } from './useProject'
import { toast } from 'sonner'

interface UseLiveProjectSyncProps {
  projectId: string | null
  isReadOnly: boolean
  localVersion: number
}

/**
 * Real-time listener and window focus synchronization hook.
 * Automatically refreshes Read-Only projects when the Owner saves updates in Supabase.
 */
export function useLiveProjectSync({
  projectId,
  isReadOnly,
  localVersion,
}: UseLiveProjectSyncProps) {
  const isRefreshingRef = useRef(false)
  const localVersionRef = useRef(localVersion)
  localVersionRef.current = localVersion

  const performLiveSync = async (reason: 'realtime' | 'focus') => {
    if (!projectId || isRefreshingRef.current) return

    try {
      isRefreshingRef.current = true

      // 1. Fetch latest version from Supabase
      const { data: cloudData, version: cloudVersion } = await supabaseSyncService.loadProjectFromCloud(projectId)

      if (cloudData && cloudVersion > localVersionRef.current) {
        console.log(`[LiveSync] Updating local project from v${localVersionRef.current} to v${cloudVersion} (trigger: ${reason})`)

        // 2. Save full project locally in a single atomic transaction
        await db.transaction('rw', [db.projects, db.tasks, db.dependencies, db.milestones], async () => {
          await db.projects.put(cloudData.project)

          await db.tasks.where('projectId').equals(projectId).delete()
          if (cloudData.tasks?.length > 0) {
            await db.tasks.bulkPut(cloudData.tasks)
          }

          await db.dependencies.where('projectId').equals(projectId).delete()
          if (cloudData.dependencies?.length > 0) {
            await db.dependencies.bulkPut(cloudData.dependencies)
          }

          await db.milestones.where('projectId').equals(projectId).delete()
          if (cloudData.milestones?.length > 0) {
            await db.milestones.bulkPut(cloudData.milestones)
          }
        })

        await useProject.getState().updateProject(projectId, { version: cloudVersion })

        // 3. Reload stores reactively
        await Promise.all([
          useTasks.getState().loadTasks(projectId),
          useDependencies.getState().loadDependencies(projectId),
          useMilestones.getState().loadMilestones(projectId),
        ])

        if (isReadOnly) {
          toast.info('Cronograma actualizado en tiempo real', {
            description: 'El gestor del proyecto ha guardado nuevos cambios.',
            duration: 4000,
          })
        }
      }
    } catch (err) {
      console.warn('[LiveSync] Failed to perform live sync:', err)
    } finally {
      isRefreshingRef.current = false
    }
  }

  // 1. Supabase Realtime Channel Subscription
  useEffect(() => {
    if (!projectId) return

    const channelName = `project-live-${projectId}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projects',
          filter: `id=eq.${projectId}`,
        },
        (payload) => {
          const newVersion = (payload.new as any)?.version || 0
          if (newVersion > localVersionRef.current) {
            performLiveSync('realtime')
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId])

  // 2. Window Focus & Visibility Change Listener
  useEffect(() => {
    if (!projectId) return

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        performLiveSync('focus')
      }
    }

    window.addEventListener('focus', handleVisibilityOrFocus)
    document.addEventListener('visibilitychange', handleVisibilityOrFocus)

    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus)
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
    }
  }, [projectId])
}
