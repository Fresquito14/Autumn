import { useMemo } from 'react'
import { Check, X, ShieldAlert, ShieldCheck } from 'lucide-react'

interface PasswordStrengthMeterProps {
  password: string
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const analysis = useMemo(() => {
    if (!password) {
      return {
        score: 0,
        label: 'Sin contraseña',
        color: 'bg-muted',
        textColor: 'text-muted-foreground',
        hasMinLength: false,
        hasUpperLower: false,
        hasNumber: false,
        hasSpecial: false,
      }
    }

    const hasMinLength = password.length >= 8
    const hasUpperLower = /[a-z]/.test(password) && /[A-Z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    const hasSpecial = /[^A-Za-z0-9]/.test(password)

    let score = 0
    if (password.length >= 6) score += 1
    if (hasMinLength) score += 1
    if (hasUpperLower) score += 1
    if (hasNumber) score += 1
    if (hasSpecial) score += 1

    let label = 'Muy débil'
    let color = 'bg-red-500'
    let textColor = 'text-red-500'

    if (score === 2) {
      label = 'Débil'
      color = 'bg-orange-500'
      textColor = 'text-orange-500'
    } else if (score === 3) {
      label = 'Aceptable'
      color = 'bg-amber-500'
      textColor = 'text-amber-500'
    } else if (score === 4) {
      label = 'Fuerte'
      color = 'bg-emerald-500'
      textColor = 'text-emerald-500'
    } else if (score >= 5) {
      label = 'Excelente'
      color = 'bg-emerald-600 dark:bg-emerald-400'
      textColor = 'text-emerald-600 dark:text-emerald-400'
    }

    return {
      score,
      label,
      color,
      textColor,
      hasMinLength,
      hasUpperLower,
      hasNumber,
      hasSpecial,
    }
  }, [password])

  if (!password) return null

  const normalizedScore = Math.min(4, Math.max(1, analysis.score - 1))

  return (
    <div className="space-y-2 pt-1.5 animate-in fade-in duration-200">
      {/* Visual Level Bars */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            {analysis.score >= 4 ? (
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
            )}
            Seguridad de la contraseña:
          </span>
          <span className={`text-[11px] font-bold ${analysis.textColor}`}>
            {analysis.label}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1.5 h-1.5">
          {[1, 2, 3, 4].map((seg) => (
            <div
              key={seg}
              className={`h-full rounded-full transition-all duration-300 ${
                seg <= normalizedScore ? analysis.color : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Requirement Checkpoints */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-muted-foreground pt-0.5">
        <div className={`flex items-center gap-1 ${analysis.hasMinLength ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}`}>
          {analysis.hasMinLength ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 text-muted-foreground/50" />}
          <span>8+ caracteres</span>
        </div>

        <div className={`flex items-center gap-1 ${analysis.hasUpperLower ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}`}>
          {analysis.hasUpperLower ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 text-muted-foreground/50" />}
          <span>Mayúsculas & minúsculas</span>
        </div>

        <div className={`flex items-center gap-1 ${analysis.hasNumber ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}`}>
          {analysis.hasNumber ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 text-muted-foreground/50" />}
          <span>Al menos un número</span>
        </div>

        <div className={`flex items-center gap-1 ${analysis.hasSpecial ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}`}>
          {analysis.hasSpecial ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 text-muted-foreground/50" />}
          <span>Carácter especial (!@#$)</span>
        </div>
      </div>
    </div>
  )
}
