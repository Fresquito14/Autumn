export type OrganizationRole = 'member' | 'manager' | 'admin'

export interface Organization {
  id: string
  name: string
  joinCode?: string
  createdAt: Date
  createdBy?: string
}

export interface OrganizationMember {
  id: string
  organizationId: string
  userId: string
  role: OrganizationRole
  createdAt: Date
}
