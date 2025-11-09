export interface ChecklistItem {
  id: string
  text: string
  completed: boolean
}

export type ConstraintType = 'ASAP' | 'ALAP' | 'MUST_START' | 'MUST_FINISH'

export interface Task {
  id: string
  projectId: string
  name: string
  description?: string

  // WBS
  wbsCode: string        // "1.2.3"
  parentId?: string      // For hierarchy
  level: number          // 0, 1, 2, 3...

  // Schedule
  duration: number       // In working days
  startDate: Date
  endDate: Date          // Calculated

  // Constraints
  constraintType?: ConstraintType
  constraintDate?: Date

  // Resources
  assignedTo: string[]   // Resource IDs

  // Tracking (Phase 2)
  percentComplete?: number
  actualStart?: Date
  actualFinish?: Date
  actualDuration?: number

  // Metadata
  notes?: string
  checklist: ChecklistItem[]
  tags?: string[]

  createdAt: Date
  updatedAt: Date
}

export interface Milestone {
  id: string
  projectId: string
  name: string
  date: Date
  linkedTaskId?: string  // Task it depends on
  offsetDays?: number    // Days after task
  description?: string
}
