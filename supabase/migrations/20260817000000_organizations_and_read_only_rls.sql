-- =====================================================================
-- AUTUMN - ORGANIZATIONS & READ-ONLY RLS POLICIES MIGRATION
-- =====================================================================

-- 1. TABLAS DE ORGANIZACIÓN Y MEMBRESÍA
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'manager', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Vincular proyectos a una organización
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- 2. ÍNDICES DE ALTO RENDIMIENTO PARA RLS
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_org_id ON public.projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_project_id ON public.dependencies(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON public.milestones(project_id);

-- 3. FUNCIÓN HELPER 'SECURITY DEFINER' (EVITA RECURSIÓN INFINITA)
CREATE OR REPLACE FUNCTION public.get_user_organization_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid();
$$;

-- 4. POLÍTICAS RLS EN ORGANIZACIONES Y MIEMBROS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Miembros pueden ver su organizacion" ON public.organizations;
CREATE POLICY "Miembros pueden ver su organizacion"
ON public.organizations FOR SELECT TO authenticated
USING (
  id IN (SELECT public.get_user_organization_ids())
);

DROP POLICY IF EXISTS "Miembros pueden ver miembros de su organizacion" ON public.organization_members;
CREATE POLICY "Miembros pueden ver miembros de su organizacion"
ON public.organization_members FOR SELECT TO authenticated
USING (
  organization_id IN (SELECT public.get_user_organization_ids())
);

-- 5. POLÍTICAS RLS EN PROYECTOS (LECTURA GRUPAL / ESCRITURA MANAGER)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura proyectos propios o de organizacion" ON public.projects;
CREATE POLICY "Lectura proyectos propios o de organizacion"
ON public.projects FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR organization_id IN (SELECT public.get_user_organization_ids())
);

DROP POLICY IF EXISTS "Insertar proyecto como manager" ON public.projects;
CREATE POLICY "Insertar proyecto como manager"
ON public.projects FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Modificar proyecto solo manager" ON public.projects;
CREATE POLICY "Modificar proyecto solo manager"
ON public.projects FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Eliminar proyecto solo manager" ON public.projects;
CREATE POLICY "Eliminar proyecto solo manager"
ON public.projects FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- 6. POLÍTICAS RLS EN ENTIDADES HIJAS (TASKS, DEPENDENCIES, MILESTONES...)
-- TASKS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura tareas del proyecto" ON public.tasks;
CREATE POLICY "Lectura tareas del proyecto"
ON public.tasks FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = tasks.project_id
    AND (
      p.user_id = auth.uid() 
      OR p.organization_id IN (SELECT public.get_user_organization_ids())
    )
  )
);

DROP POLICY IF EXISTS "Modificar tareas solo manager del proyecto" ON public.tasks;
CREATE POLICY "Modificar tareas solo manager del proyecto"
ON public.tasks FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = tasks.project_id AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = tasks.project_id AND p.user_id = auth.uid()
  )
);

-- DEPENDENCIES
ALTER TABLE public.dependencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura dependencias del proyecto" ON public.dependencies;
CREATE POLICY "Lectura dependencias del proyecto"
ON public.dependencies FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = dependencies.project_id
    AND (
      p.user_id = auth.uid() 
      OR p.organization_id IN (SELECT public.get_user_organization_ids())
    )
  )
);

DROP POLICY IF EXISTS "Modificar dependencias solo manager" ON public.dependencies;
CREATE POLICY "Modificar dependencias solo manager"
ON public.dependencies FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = dependencies.project_id AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = dependencies.project_id AND p.user_id = auth.uid()
  )
);

-- MILESTONES
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura hitos del proyecto" ON public.milestones;
CREATE POLICY "Lectura hitos del proyecto"
ON public.milestones FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = milestones.project_id
    AND (
      p.user_id = auth.uid() 
      OR p.organization_id IN (SELECT public.get_user_organization_ids())
    )
  )
);

DROP POLICY IF EXISTS "Modificar hitos solo manager" ON public.milestones;
CREATE POLICY "Modificar hitos solo manager"
ON public.milestones FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = milestones.project_id AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = milestones.project_id AND p.user_id = auth.uid()
  )
);

-- 7. TRIGGER: AUTO-ASIGNACIÓN A ORGANIZACIÓN PRINCIPAL AL REGISTRARSE
CREATE OR REPLACE FUNCTION public.handle_new_user_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_org_id UUID;
BEGIN
  SELECT id INTO default_org_id FROM public.organizations ORDER BY created_at ASC LIMIT 1;
  
  IF default_org_id IS NULL THEN
    INSERT INTO public.organizations (name) VALUES ('Fresh Analytics Inc.')
    RETURNING id INTO default_org_id;
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (default_org_id, NEW.id, 'member')
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_on_user_created_assign_org ON auth.users;
CREATE TRIGGER tr_on_user_created_assign_org
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_organization();
