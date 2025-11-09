import { Holiday } from './calendar'

export interface ProjectConfig {
  workingDays: number[] // [1,2,3,4,5] = Mon-Fri
  hoursPerDay: number   // 8
  holidays: Holiday[]
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
