import { Holiday } from './calendar'

export interface ProjectConfig {
  workingDays: number[] // [1,2,3,4,5] = Mon-Fri
  hoursPerDay: number   // 8

  // Holiday management
  useGlobalHolidays: boolean // If true, includes global holidays in calculations
  excludedGlobalHolidayIds: string[] // Global holidays to exclude for this project
  projectSpecificHolidays: Holiday[] // Additional holidays specific to this project

  // Scheduling behavior
  skipHolidaysInScheduling: boolean // If true, holidays don't extend task duration (only affect resource capacity)

  defaultDuration: number // 1 day by default
}

export interface Project {
  id: string
  name: string
  description?: string
  startDate: Date
  endDate?: Date // Calculated
  config: ProjectConfig
  baselineId?: string
  createdAt: Date
  updatedAt: Date
}
