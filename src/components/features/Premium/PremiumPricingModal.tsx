import { useState } from 'react'
import { Crown, Zap, Sparkles, Building2, Cloud, Users, ShieldCheck, ArrowRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface PremiumPricingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PremiumPricingModal({ open, onOpenChange }: PremiumPricingModalProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly')
  const [isRequesting, setIsRequesting] = useState(false)

  const handleSubscribeClick = () => {
    setIsRequesting(true)
    setTimeout(() => {
      setIsRequesting(false)
      onOpenChange(false)
      toast.success('¡Registro prioritario guardado!', {
        description: 'La pasarela de pago se habilitará próximamente. Recibirás un email con tu enlace de activación prioritario.',
        duration: 6000,
      })
    }, 600)
  }

  const features = [
    {
      title: 'Proyectos Ilimitados',
      description: 'Crea y gestiona todos los proyectos que necesites sin la restricción de 3 proyectos del plan gratuito.',
      icon: Crown,
    },
    {
      title: 'Sincronización en la Nube (Cloud)',
      description: 'Accede a tus proyectos desde cualquier dispositivo con persistencia en tiempo real en Supabase PostgreSQL.',
      icon: Cloud,
    },
    {
      title: 'Organizaciones y Colaboración en Equipo',
      description: 'Invita a tu equipo con roles diferenciados: Project Managers (edición) y Visualizadores (solo lectura).',
      icon: Building2,
    },
    {
      title: 'Recursos Globales y Detección de Sobreasignación',
      description: 'Asigna miembros de tu equipo a través de múltiples proyectos y balancea cargas de trabajo.',
      icon: Users,
    },
    {
      title: 'Líneas Base (Baselines) y Control de Cambios',
      description: 'Congela versiones del cronograma para comparar el progreso real frente al planificado.',
      icon: Sparkles,
    },
    {
      title: 'Seguridad Empresarial RLS',
      description: 'Aislamiento estricto de datos con políticas de seguridad a nivel de fila y copias de seguridad continuas.',
      icon: ShieldCheck,
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center sm:text-center pb-2">
          <div className="mx-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-semibold mb-2">
            <Crown className="h-3.5 w-3.5" />
            Plan Premium Corporativo
          </div>
          <DialogTitle className="text-2xl sm:text-3xl font-bold tracking-tight">
            Eleva la gestión de tus proyectos al siguiente nivel
          </DialogTitle>
          <DialogDescription className="text-base text-muted-foreground max-w-xl mx-auto">
            Desbloquea colaboración en tiempo real, organizaciones multi-usuario y proyectos ilimitados para ti y tu equipo.
          </DialogDescription>
        </DialogHeader>

        {/* Pricing selector */}
        <div className="flex justify-center my-4">
          <div className="bg-muted p-1 rounded-xl inline-flex items-center gap-1 text-sm font-medium">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-1.5 rounded-lg transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-background shadow-sm text-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Mensual (19€ / mes)
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 py-1.5 rounded-lg transition-all inline-flex items-center gap-1.5 ${
                billingCycle === 'yearly'
                  ? 'bg-background shadow-sm text-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Anual (15€ / mes)
              <span className="text-[10px] bg-primary/15 text-primary font-bold px-1.5 py-0.5 rounded-full">
                -20%
              </span>
            </button>
          </div>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 py-2">
          {features.map((feat) => {
            const Icon = feat.icon
            return (
              <div
                key={feat.title}
                className="flex items-start gap-3 p-3.5 rounded-xl border bg-card hover:bg-muted/40 transition-colors"
              >
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold leading-tight">{feat.title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {feat.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Activation flow note */}
        <div className="rounded-xl bg-muted/60 p-4 border text-xs text-muted-foreground space-y-1.5 mt-2">
          <div className="font-semibold text-foreground flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-amber-500" />
            ¿Cómo funciona la activación?
          </div>
          <p>
            Una vez completada la suscripción, recibirás un correo electrónico de confirmación para crear tu propia <strong>Organización</strong> corporativa, añadir el logotipo de tu empresa e invitar a los miembros de tu equipo con sus respectivos roles.
          </p>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Continuar en modo local
          </Button>
          <Button
            type="button"
            onClick={handleSubscribeClick}
            disabled={isRequesting}
            className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-primary hover:from-amber-600 hover:to-primary/90 text-primary-foreground font-semibold"
          >
            <Crown className="h-4 w-4 mr-2" />
            {isRequesting ? 'Procesando...' : 'Pásate a Premium'}
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
