import { useState } from 'react'
import {
  Building2,
  Plus,
  Copy,
  Check,
  KeyRound,
} from 'lucide-react'
import { useOrganization } from '@/hooks/useOrganization'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { CreateOrganizationDialog } from './CreateOrganizationDialog'
import { JoinOrganizationDialog } from './JoinOrganizationDialog'
import { toast } from 'sonner'

export function OrganizationSwitcher() {
  const {
    organizations,
    currentOrganization,
    switchOrganization,
  } = useOrganization()

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isJoinOpen, setIsJoinOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopyCode = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!currentOrganization?.joinCode) return
    navigator.clipboard.writeText(currentOrganization.joinCode)
    setCopied(true)
    toast.success(`Código copiado: ${currentOrganization.joinCode}`, {
      description: 'Compártelo con otros gestores para que se unan a esta organización.',
    })
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-1.5">
      {organizations.length > 0 ? (
        <Select
          value={currentOrganization?.id || ''}
          onValueChange={(val) => {
            if (val === '__create_new__') {
              setIsCreateOpen(true)
            } else if (val === '__join_code__') {
              setIsJoinOpen(true)
            } else {
              switchOrganization(val)
            }
          }}
        >
          <SelectTrigger className="h-8 border-primary/20 bg-primary/10 hover:bg-primary/15 text-primary text-xs font-semibold px-2.5 gap-2 max-w-[240px] focus:ring-0 focus:ring-offset-0">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">
              {currentOrganization?.name || 'Selecciona Organización'}
            </span>
          </SelectTrigger>

          <SelectContent align="start" className="w-[280px]">
            <SelectGroup>
              <SelectLabel className="text-[11px] text-muted-foreground font-semibold px-2 py-1">
                Tus Organizaciones ({organizations.length})
              </SelectLabel>
              {organizations.map((org) => {
                return (
                  <SelectItem
                    key={org.id}
                    value={org.id}
                    className="text-xs cursor-pointer py-2"
                  >
                    <div className="flex items-center justify-between w-full gap-2">
                      <span className="font-medium truncate">{org.name}</span>
                      {org.joinCode && (
                        <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                          {org.joinCode}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                )
              })}
            </SelectGroup>

            <SelectSeparator />

            <SelectItem
              value="__join_code__"
              className="text-xs font-semibold text-foreground cursor-pointer py-2 focus:bg-muted"
            >
              <div className="flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-primary" />
                Unirse con Código
              </div>
            </SelectItem>

            <SelectItem
              value="__create_new__"
              className="text-xs font-semibold text-primary cursor-pointer py-2 focus:bg-primary/10"
            >
              <div className="flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Crear nueva Organización
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsJoinOpen(true)}
          className="h-8 text-xs font-semibold gap-1.5 border-primary/30"
        >
          <KeyRound className="h-3.5 w-3.5 text-primary" />
          Unirse a Organización
        </Button>
      )}

      {/* Copy Join Code Badge */}
      {currentOrganization?.joinCode && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopyCode}
          className="h-8 px-2 text-xs font-mono font-bold text-muted-foreground hover:text-primary hover:bg-primary/10 gap-1"
          title={`Código de unión: ${currentOrganization.joinCode} (clic para copiar)`}
        >
          <span>{currentOrganization.joinCode}</span>
          {copied ? (
            <Check className="h-3 w-3 text-emerald-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      )}

      {/* Join Organization Dialog */}
      <JoinOrganizationDialog
        open={isJoinOpen}
        onOpenChange={setIsJoinOpen}
      />

      {/* Create Organization Dialog */}
      <CreateOrganizationDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        isMandatoryOnboarding={false}
      />
    </div>
  )
}
