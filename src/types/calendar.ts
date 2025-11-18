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
