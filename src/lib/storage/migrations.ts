import { db } from './db'

/**
 * Database migrations for future schema changes
 *
 * Version 1: Initial schema
 * - Projects, Tasks, Milestones, Dependencies, Resources, TimeEntries, Baselines
 *
 * Version 2: Remove isCompleted field
 * - Removed isCompleted boolean field from Task interface
 * - Task completion is now determined exclusively by actualDuration
 */

const CURRENT_VERSION_KEY = 'db_migration_version'

async function getMigrationVersion(): Promise<number> {
  const version = localStorage.getItem(CURRENT_VERSION_KEY)
  return version ? parseInt(version, 10) : 0
}

async function setMigrationVersion(version: number): Promise<void> {
  localStorage.setItem(CURRENT_VERSION_KEY, version.toString())
}

export async function runMigrations() {
  const currentVersion = await getMigrationVersion()

  // Migration 1: Remove isCompleted field from all tasks
  if (currentVersion < 1) {
    console.log('Running migration 1: Removing isCompleted field from tasks...')
    try {
      const tasks = await db.tasks.toArray()

      // Update each task to remove the isCompleted field
      for (const task of tasks) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const taskAny = task as any
        if ('isCompleted' in taskAny) {
          delete taskAny.isCompleted
          await db.tasks.put(task)
        }
      }

      await setMigrationVersion(1)
      console.log(`Migration 1 complete: Updated ${tasks.length} tasks`)
    } catch (error) {
      console.error('Migration 1 failed:', error)
    }
  }

  // Future migrations will be added here
  // if (currentVersion < 2) { ... }
}

// Initialize migrations on app startup
runMigrations()
