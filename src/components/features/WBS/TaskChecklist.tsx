import { useState, useEffect } from 'react'
import { Plus, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ChecklistItem } from '@/types'
import { cn } from '@/lib/utils'

interface TaskChecklistProps {
  checklist: ChecklistItem[]
  onAddItem: (text: string) => void
  onToggleItem: (itemId: string) => void
  onDeleteItem: (itemId: string) => void
  onUpdateItem: (itemId: string, text: string) => void
  onAllCompleted?: () => void
  hasActualDuration: boolean
}

export function TaskChecklist({
  checklist,
  onAddItem,
  onToggleItem,
  onDeleteItem,
  onUpdateItem,
  onAllCompleted,
  hasActualDuration
}: TaskChecklistProps) {
  const [newItemText, setNewItemText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const completedCount = checklist.filter(item => item.completed).length
  const totalCount = checklist.length
  const allCompleted = totalCount > 0 && completedCount === totalCount

  // Detect when all items are completed and prompt for actual duration
  useEffect(() => {
    if (allCompleted && !hasActualDuration && onAllCompleted) {
      onAllCompleted()
    }
  }, [allCompleted, hasActualDuration, onAllCompleted])

  const handleAddItem = () => {
    if (newItemText.trim()) {
      onAddItem(newItemText.trim())
      setNewItemText('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddItem()
    }
  }

  const startEditing = (item: ChecklistItem) => {
    setEditingId(item.id)
    setEditText(item.text)
  }

  const saveEdit = () => {
    if (editingId && editText.trim()) {
      onUpdateItem(editingId, editText.trim())
      setEditingId(null)
      setEditText('')
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditText('')
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Checklist</h3>
        {totalCount > 0 && (
          <span className={cn(
            "text-xs font-medium px-2 py-1 rounded",
            allCompleted
              ? "bg-autumn-progress/10 text-autumn-progress"
              : "bg-muted text-muted-foreground"
          )}>
            {completedCount}/{totalCount} completados
          </span>
        )}
      </div>

      {/* Checklist items */}
      <div className="space-y-2">
        {checklist.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 group"
          >
            {/* Checkbox */}
            <button
              type="button"
              onClick={() => onToggleItem(item.id)}
              className={cn(
                "flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                item.completed
                  ? "bg-autumn-progress border-autumn-progress"
                  : "border-border hover:border-primary"
              )}
            >
              {item.completed && <Check className="h-3 w-3 text-white" />}
            </button>

            {/* Text */}
            {editingId === item.id ? (
              <div className="flex-1 flex items-center gap-2">
                <Input
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit()
                    if (e.key === 'Escape') cancelEdit()
                  }}
                  className="h-8"
                  autoFocus
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={saveEdit}
                  className="h-8 w-8 p-0"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={cancelEdit}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <span
                  className={cn(
                    "flex-1 text-sm cursor-pointer",
                    item.completed && "line-through text-muted-foreground"
                  )}
                  onDoubleClick={() => startEditing(item)}
                >
                  {item.text}
                </span>

                {/* Delete button */}
                <button
                  type="button"
                  onClick={() => onDeleteItem(item.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add new item */}
      <div className="flex items-center gap-2">
        <Input
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Agregar item..."
          className="h-9"
        />
        <Button
          type="button"
          onClick={handleAddItem}
          size="sm"
          variant="outline"
          className="h-9"
          disabled={!newItemText.trim()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
