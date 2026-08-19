import { db } from './db'

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

  if (currentVersion < 1) {
    console.log('Running migration 1: Removing isCompleted field from tasks...')
    try {
      const tasks = await db.tasks.toArray()

      for (const task of tasks) {
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
}

// Initialize migrations on startup
runMigrations()
