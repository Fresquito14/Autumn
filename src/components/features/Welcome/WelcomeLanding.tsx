import { useState } from 'react'
import {
  Crown,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Zap,
  ShieldCheck,
  HardDrive,
  Layers,
  CalendarDays,
  Cloud,
  ArrowRightLeft,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PremiumPricingModal } from '../Premium/PremiumPricingModal'

interface WelcomeLandingProps {
  onStartFree: () => void
}

export function WelcomeLanding({ onStartFree }: WelcomeLandingProps) {
  const [isPricingOpen, setIsPricingOpen] = useState(false)

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-10 animate-in fade-in duration-500">
      {/* Hero Header */}
      <div className="text-center space-y-3.5 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-semibold shadow-xs">
          <Sparkles className="h-3.5 w-3.5" />
          Planificación Profesional de Proyectos & Diagramas de Gantt
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
          🍂 Bienvenido a Autumn
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Diseñado para gestores que necesitan control riguroso de dependencias, cálculo de ruta crítica, desglose WBS y balance de recursos.
        </p>
      </div>

      {/* Two Choice Pathway Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch max-w-4xl mx-auto pt-2">
        {/* Banner 1: Free Local Mode */}
        <Card className="relative flex flex-col justify-between border-2 hover:border-primary/50 transition-all shadow-sm hover:shadow-md bg-card">
          <div>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="p-3 rounded-xl bg-muted text-foreground">
                  <HardDrive className="h-6 w-6 text-primary" />
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground border">
                  Sin Registro
                </span>
              </div>
              <CardTitle className="text-2xl font-bold">Prueba la versión gratuita</CardTitle>
              <CardDescription className="text-sm">
                Almacenamiento 100% privado en tu navegador (IndexedDB). Sin registro, tarjeta ni conexión a base de datos.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>Hasta <strong>3 proyectos simultáneos</strong> completos en local.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>Diagrama de Gantt interactivo con Drag & Drop y zoom dinámico.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>Estructura WBS y cálculo automático de fechas (Algoritmo de Kahn).</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>Exportación e importación completa de proyectos en archivos JSON.</span>
              </div>
              <div className="flex items-start gap-2.5 text-muted-foreground text-xs pt-1">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>Tus datos permanecen exclusivamente en la memoria de tu dispositivo.</span>
              </div>
            </CardContent>
          </div>

          <CardFooter className="pt-4 border-t">
            <Button
              size="lg"
              variant="outline"
              onClick={onStartFree}
              className="w-full font-semibold border-primary/30 hover:bg-primary/5 hover:text-primary h-11"
            >
              Empezar a Probar Gratis
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardFooter>
        </Card>

        {/* Banner 2: Premium Cloud */}
        <Card className="relative flex flex-col justify-between border-2 border-primary/40 hover:border-primary transition-all shadow-md hover:shadow-lg bg-gradient-to-b from-card to-primary/5">
          <div className="absolute -top-3 right-6">
            <span className="bg-gradient-to-r from-amber-500 to-primary text-primary-foreground text-[11px] font-bold px-3 py-0.5 rounded-full shadow-sm flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Recomendado
            </span>
          </div>

          <div>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Crown className="h-6 w-6" />
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Equipos & Nube
                </span>
              </div>
              <CardTitle className="text-2xl font-bold">Hazte Premium</CardTitle>
              <CardDescription className="text-sm">
                Sincronización multidispositivo en tiempo real, organizaciones por código y proyectos ilimitados.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <span><strong>Proyectos Ilimitados</strong> respaldados en Supabase Cloud.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <span>Crea tu <strong>Organización</strong> y comparte tu código de equipo.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <span><strong>Roadmap consolidado</strong> y mapa de calor de recursos compartidos.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <span><strong>Traspaso de proyectos</strong> entre gestores de la misma organización.</span>
              </div>
              <div className="flex items-start gap-2.5 text-muted-foreground text-xs pt-1">
                <Cloud className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                <span>Sincronización en la nube con seguridad PostgreSQL RLS de grado bancario.</span>
              </div>
            </CardContent>
          </div>

          <CardFooter className="pt-4 border-t">
            <Button
              size="lg"
              onClick={() => setIsPricingOpen(true)}
              className="w-full font-semibold bg-gradient-to-r from-amber-500 to-primary hover:from-amber-600 hover:to-primary/90 text-primary-foreground shadow-sm h-11"
            >
              <Crown className="h-4 w-4 mr-2" />
              Ver Planes y Ventajas
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Footer Info */}
      <div className="flex flex-wrap items-center justify-center gap-6 pt-6 border-t text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          Seguridad RLS Empresarial
        </span>
        <span className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-primary" />
          Arquitectura Local-First
        </span>
        <span className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 text-primary" />
          Motor de Cálculo Kahn
        </span>
        <span className="flex items-center gap-1.5">
          <ArrowRightLeft className="h-3.5 w-3.5 text-primary" />
          Traspaso de Propiedad
        </span>
      </div>

      {/* Premium Pricing Modal */}
      <PremiumPricingModal open={isPricingOpen} onOpenChange={setIsPricingOpen} />
    </div>
  )
}
