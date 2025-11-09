import { DateRange } from './calendar'

export interface ResourceCalendar {
  vacations: DateRange[]
  customWorkingDays?: number[] // Override of project
}

export interface Resource {
  id: string
  projectId: string
  name: string
  email?: string
  role?: string
  maxHoursPerWeek: number // 40 by default
  calendar: ResourceCalendar
  costPerHour?: number
}
