/**
 * Global Holiday - shared across all projects
 * Stored in a global table, not tied to specific projects
 */
export interface GlobalHoliday {
  id: string
  name: string
  date: Date
  description?: string
  appliesTo?: string[] // Tags like "España", "Madrid" - if empty, applies to all
  isRecurring?: boolean // If true, applies every year (e.g., Christmas)
  createdAt: Date
  updatedAt: Date
}

/**
 * Holiday - can be global or project-specific
 * Used in calculations and project config
 */
export interface Holiday {
  id: string
  date: Date
  name: string
  description?: string
  appliesTo?: string[] // Optional: Tags of resources this holiday applies to. If empty, applies to all.
}

export interface DateRange {
  start: Date
  end: Date
}

export interface WorkingDay {
  dayOfWeek: number // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  isWorking: boolean
  hours?: number // Hours per day for this specific day
}
