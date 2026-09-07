-- =====================================================================
-- AUTUMN - SISTEMA DE FEEDBACK Y SUGERENCIAS DE USUARIO
-- Tabla public.user_feedback, índices, trigger updated_at y RLS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  comment TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'suggestion' CHECK (category IN ('suggestion', 'bug', 'improvement', 'other')),
  status TEXT NOT NULL DEFAULT 'nuevo' CHECK (status IN ('nuevo', 'aceptado', 'planificado', 'completado', 'desestimado')),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  project_name TEXT,
  device_info TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.user_feedback IS 'Buzón de sugerencias, incidencias y feedback de usuarios para mejora continua.';

-- Índices optimizados según mejores prácticas
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON public.user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_status ON public.user_feedback(status);
CREATE INDEX IF NOT EXISTS idx_user_feedback_created_at ON public.user_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_feedback_project_id ON public.user_feedback(project_id) WHERE project_id IS NOT NULL;

-- Trigger para mantener actualizado el campo updated_at
CREATE OR REPLACE FUNCTION public.handle_user_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_feedback_updated_at ON public.user_feedback;
CREATE TRIGGER trg_user_feedback_updated_at
BEFORE UPDATE ON public.user_feedback
FOR EACH ROW EXECUTE FUNCTION public.handle_user_feedback_updated_at();

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- 1. Inserción permitida a usuarios autenticados
DROP POLICY IF EXISTS "Permitir insercion de feedback a usuarios autenticados" ON public.user_feedback;
CREATE POLICY "Permitir insercion de feedback a usuarios autenticados"
ON public.user_feedback FOR INSERT TO authenticated
WITH CHECK (
  user_id IS NULL OR user_id = (select auth.uid())
);

-- 2. Inserción permitida a usuarios anónimos (modo local free / landing)
DROP POLICY IF EXISTS "Permitir insercion de feedback anonimo" ON public.user_feedback;
CREATE POLICY "Permitir insercion de feedback anonimo"
ON public.user_feedback FOR INSERT TO anon
WITH CHECK (
  user_id IS NULL
);

-- 3. Lectura: el usuario puede ver su propio feedback, y los gestores/administradores pueden ver todos
DROP POLICY IF EXISTS "Usuarios pueden ver su propio feedback o administradores todos" ON public.user_feedback;
CREATE POLICY "Usuarios pueden ver su propio feedback o administradores todos"
ON public.user_feedback FOR SELECT TO authenticated
USING (
  user_id = (select auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = (select auth.uid())
    AND om.role IN ('manager', 'admin', 'owner')
  )
);

-- 4. Actualización: gestores y administradores pueden modificar estado y notas
DROP POLICY IF EXISTS "Managers y administradores pueden actualizar feedback" ON public.user_feedback;
CREATE POLICY "Managers y administradores pueden actualizar feedback"
ON public.user_feedback FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = (select auth.uid())
    AND om.role IN ('manager', 'admin', 'owner')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = (select auth.uid())
    AND om.role IN ('manager', 'admin', 'owner')
  )
);
