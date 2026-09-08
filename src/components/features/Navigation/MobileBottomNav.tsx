import { ListTodo, Palmtree } from 'lucide-react'
import { cn } from '@/lib/utils'

export type MobileTab = 'my-tasks' | 'my-vacations'

interface MobileBottomNavProps {
  currentView: string
  onSelectView: (view: 'my-tasks' | 'my-vacations') => void
}

export function MobileBottomNav({ currentView, onSelectView }: MobileBottomNavProps) {
  const tabs = [
    {
      id: 'my-tasks' as const,
      label: 'Mis Tareas',
      icon: ListTodo,
      isActive: currentView === 'my-tasks',
    },
    {
      id: 'my-vacations' as const,
      label: 'Vacaciones',
      icon: Palmtree,
      isActive: currentView === 'my-vacations',
    },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border shadow-lg md:hidden"
      style={{
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
      }}
      aria-label="Navegación móvil"
    >
      <div className="flex items-center justify-around h-14 px-2 max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectView(tab.id)}
              className={cn(
                'flex flex-col items-center justify-center min-w-[48px] min-h-[44px] px-3 py-1 rounded-xl transition-all select-none',
                tab.isActive
                  ? 'text-primary font-bold bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground active:scale-95'
              )}
              aria-current={tab.isActive ? 'page' : undefined}
            >
              <Icon className={cn('h-5 w-5', tab.isActive ? 'text-primary' : 'text-muted-foreground')} />
              <span className="text-[10px] mt-0.5 tracking-tight">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
