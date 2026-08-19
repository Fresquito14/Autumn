import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { supabase } from '@/lib/supabase/client'
import { useProject } from './useProject'
import { supabaseSyncService } from '@/lib/supabase/db_service'
import type { Organization, OrganizationRole } from '@/domain/models'

export interface UserOrganizationItem {
  id: string
  name: string
  joinCode?: string
  role: OrganizationRole
  createdAt: Date
  createdBy?: string
}

export interface OrganizationMemberItem {
  userId: string
  email: string
  role: OrganizationRole
  joinedAt?: Date
}

interface OrganizationState {
  organizations: UserOrganizationItem[]
  currentOrganization: Organization | null
  userRole: OrganizationRole | null
  hasManagedOrganization: boolean
  isLoading: boolean
  error: string | null

  loadUserOrganizations: () => Promise<void>
  loadUserOrganization: () => Promise<void> // alias for backward compatibility
  setCurrentOrganization: (org: Organization | null) => void
  createOrganization: (name: string) => Promise<Organization>
  joinOrganizationByCode: (code: string) => Promise<void>
  getOrganizationMembers: (orgId: string) => Promise<OrganizationMemberItem[]>
  switchOrganization: (orgId: string) => Promise<void>
  clear: () => void
}

export const useOrganization = create<OrganizationState>()(
  devtools(
    (set, get) => ({
      organizations: [],
      currentOrganization: null,
      userRole: null,
      hasManagedOrganization: false,
      isLoading: false,
      error: null,

      loadUserOrganizations: async () => {
        set({ isLoading: true, error: null })
        try {
          const { data: userData } = await supabase.auth.getUser()
          if (!userData?.user) {
            set({
              organizations: [],
              currentOrganization: null,
              userRole: null,
              hasManagedOrganization: false,
              isLoading: false,
            })
            return
          }

          const userId = userData.user.id

          // 1. Fetch all memberships for this user
          const { data: members, error: memError } = await supabase
            .from('organization_members')
            .select('organization_id, role')
            .eq('user_id', userId)

          if (memError) throw memError

          if (!members || members.length === 0) {
            set({
              organizations: [],
              currentOrganization: null,
              userRole: null,
              hasManagedOrganization: false,
              isLoading: false,
            })
            return
          }

          // 2. Fetch the organization details
          const orgIds = members.map((m) => m.organization_id)
          const { data: orgsData, error: orgsError } = await supabase
            .from('organizations')
            .select('id, name, join_code, created_at, created_by')
            .in('id', orgIds)

          if (orgsError) throw orgsError

          const orgMap = new Map((orgsData || []).map((o) => [o.id, o]))

          const userOrgs: UserOrganizationItem[] = []
          for (const m of members) {
            const orgDetails = orgMap.get(m.organization_id)
            if (orgDetails) {
              userOrgs.push({
                id: orgDetails.id,
                name: orgDetails.name,
                joinCode: orgDetails.join_code || undefined,
                role: (m.role as OrganizationRole) || 'member',
                createdAt: new Date(orgDetails.created_at),
                createdBy: orgDetails.created_by || undefined,
              })
            }
          }

          const hasManager = userOrgs.some(
            (o) => o.role === 'manager' || o.role === 'admin'
          )

          // Select current org: keep existing if still valid, otherwise pick managed org, or first org
          const currentId = get().currentOrganization?.id
          let selectedOrgItem = userOrgs.find((o) => o.id === currentId)
          if (!selectedOrgItem) {
            selectedOrgItem =
              userOrgs.find((o) => o.role === 'manager' || o.role === 'admin') ||
              userOrgs[0] ||
              null
          }

          const activeOrg: Organization | null = selectedOrgItem
            ? {
                id: selectedOrgItem.id,
                name: selectedOrgItem.name,
                joinCode: selectedOrgItem.joinCode,
                createdAt: selectedOrgItem.createdAt,
                createdBy: selectedOrgItem.createdBy,
              }
            : null

          set({
            organizations: userOrgs,
            currentOrganization: activeOrg,
            userRole: selectedOrgItem ? selectedOrgItem.role : null,
            hasManagedOrganization: hasManager,
            isLoading: false,
          })
        } catch (error) {
          console.warn('Could not load user organizations:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      loadUserOrganization: async () => {
        await get().loadUserOrganizations()
      },

      createOrganization: async (name: string) => {
        set({ isLoading: true, error: null })
        try {
          const { data: userData } = await supabase.auth.getUser()
          if (!userData?.user) throw new Error('Usuario no autenticado')

          const userId = userData.user.id
          const cleanName = name.trim()

          // 1. Try atomic RPC first
          const { data: rpcData, error: rpcError } = await supabase.rpc(
            'create_new_organization',
            { org_name: cleanName }
          )

          let org: Organization

          if (!rpcError && rpcData?.id) {
            org = {
              id: rpcData.id,
              name: rpcData.name,
              joinCode: rpcData.join_code,
              createdAt: new Date(rpcData.created_at || Date.now()),
              createdBy: rpcData.created_by || userId,
            }
          } else {
            // Fallback direct insert
            const { data: newOrg, error: orgError } = await supabase
              .from('organizations')
              .insert({
                name: cleanName,
                created_by: userId,
              })
              .select('id, name, join_code, created_at, created_by')
              .single()

            if (orgError) throw orgError

            // Add creator as manager
            const { error: memError } = await supabase
              .from('organization_members')
              .upsert(
                {
                  organization_id: newOrg.id,
                  user_id: userId,
                  role: 'manager',
                },
                { onConflict: 'organization_id,user_id' }
              )

            if (memError) throw memError

            org = {
              id: newOrg.id,
              name: newOrg.name,
              joinCode: newOrg.join_code,
              createdAt: new Date(newOrg.created_at),
              createdBy: newOrg.created_by,
            }
          }

          await get().loadUserOrganizations()
          set({ currentOrganization: org, userRole: 'manager', isLoading: false })
          return org
        } catch (error) {
          console.error('Error creating organization:', error)
          set({ error: (error as Error).message, isLoading: false })
          throw error
        }
      },

      joinOrganizationByCode: async (code: string) => {
        set({ isLoading: true, error: null })
        try {
          const cleanCode = code.trim().toUpperCase()
          const { data, error } = await supabase.rpc('join_organization_by_code', {
            org_code: cleanCode,
          })

          if (error) throw error

          await get().loadUserOrganizations()

          if (data?.organization_id) {
            await get().switchOrganization(data.organization_id)
          }

          set({ isLoading: false })
        } catch (error) {
          console.error('Error joining organization by code:', error)
          set({ error: (error as Error).message, isLoading: false })
          throw error
        }
      },

      getOrganizationMembers: async (orgId: string): Promise<OrganizationMemberItem[]> => {
        try {
          // Attempt RPC first
          const { data, error } = await supabase.rpc('get_organization_members_list', {
            p_org_id: orgId,
          })

          if (!error && data) {
            return data.map((m: any) => ({
              userId: m.user_id,
              email: m.email || 'Usuario',
              role: (m.role as OrganizationRole) || 'member',
              joinedAt: m.joined_at ? new Date(m.joined_at) : undefined,
            }))
          }

          // Fallback direct select
          const { data: directMembers, error: directErr } = await supabase
            .from('organization_members')
            .select('user_id, role, created_at')
            .eq('organization_id', orgId)

          if (directErr) throw directErr

          return (directMembers || []).map((m: any) => ({
            userId: m.user_id,
            email: `Usuario (${m.user_id.slice(0, 6)}...)`,
            role: (m.role as OrganizationRole) || 'member',
            joinedAt: m.created_at ? new Date(m.created_at) : undefined,
          }))
        } catch (error) {
          console.warn('Error fetching organization members:', error)
          return []
        }
      },

      switchOrganization: async (orgId: string) => {
        const orgItem = get().organizations.find((o) => o.id === orgId)
        if (!orgItem) return

        const activeOrg: Organization = {
          id: orgItem.id,
          name: orgItem.name,
          joinCode: orgItem.joinCode,
          createdAt: orgItem.createdAt,
          createdBy: orgItem.createdBy,
        }

        set({
          currentOrganization: activeOrg,
          userRole: orgItem.role,
        })

        // Reload projects and sync cloud
        try {
          await useProject.getState().loadProjects()
          await supabaseSyncService.syncFullDatabaseFromCloud()
        } catch (err) {
          console.warn('Sync on organization switch:', err)
        }
      },

      setCurrentOrganization: (currentOrganization) =>
        set({ currentOrganization }),

      clear: () =>
        set({
          organizations: [],
          currentOrganization: null,
          userRole: null,
          hasManagedOrganization: false,
          error: null,
        }),
    }),
    { name: 'OrganizationStore' }
  )
)
