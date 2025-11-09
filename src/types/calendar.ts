export interface Holiday {
  id: string
  date: Date
  name: string
  description?: string
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
