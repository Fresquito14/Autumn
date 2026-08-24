import { Filter } from 'lucide-react'
import { Label } from '@/components/ui/label'

interface LevelFilterProps {
  maxLevel: number
  currentMaxLevel: number
  onLevelChange: (level: number) => void
}

export function LevelFilter({ maxLevel, currentMaxLevel, onLevelChange }: LevelFilterProps) {
  if (maxLevel <= 1) return null

  return (
    <div className="flex items-center gap-2">
      <Filter className="h-4 w-4 text-muted-foreground" />
      <Label htmlFor="level-filter" className="text-sm font-normal">
        Mostrar hasta nivel:
      </Label>
      <select
        id="level-filter"
        className="flex h-8 rounded-md border border-input bg-background text-foreground px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
        value={currentMaxLevel}
        onChange={(e) => onLevelChange(Number(e.target.value))}
      >
        <option value={0} className="bg-background text-foreground">
          Todos
        </option>
        {Array.from({ length: maxLevel }, (_, i) => i + 1).map((level) => (
          <option key={level} value={level} className="bg-background text-foreground">
            Nivel {level}
          </option>
        ))}
      </select>
    </div>
  )
}
