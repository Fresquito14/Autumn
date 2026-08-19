import { DateRange } from './calendar'

export interface ResourceCalendar {
  vacations: DateRange[]
  customWorkingDays?: number[] // Override of project
}

/**
 * Global Resource - not tied to a specific project
 * Can be assigned to multiple projects and tasks
 */
export interface Resource {
  id: string
  name: string
  email?: string
  tags: string[] // For skill-based filtering (e.g., ["Frontend", "React", "Senior"])
  maxHoursPerWeek: number // Default capacity (e.g., 40)
  calendar: ResourceCalendar
  costPerHour?: number
}

/**
 * Weekly allocation of hours for a resource assignment
 * Calculated automatically based on task dates and working days
 */
export interface WeeklyAllocation {
  weekStart: Date // Start of the week (Monday)
  workingDaysInWeek: number // Number of working days in this week for this task
  plannedHours: number // Planned hours for this week
  actualHours?: number // Actual hours worked (filled when task is completed)
}

/**
 * Assignment of a resource to a task with hour allocation
 * Supports automatic redistribution when task dates change
 */
export interface TaskResourceAssignment {
  id: string
  taskId: string
  resourceId: string
  plannedHours: number // Total planned hours
  actualHours?: number // Total actual hours (when task is completed)

  // Temporal distribution (calculated automatically)
  weeklyDistribution: WeeklyAllocation[]

  // Manual override flag (if user adjusts distribution manually)
  isManualDistribution: boolean
}
