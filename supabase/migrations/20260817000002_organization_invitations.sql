-- =====================================================================
-- AUTUMN - ORGANIZATION INVITATIONS AND WHITELIST INTEGRATION
-- =====================================================================

-- 1. TABLA DE INVITACIONES
CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'manager', 'admin')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, email)
);

CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON public.organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_org_invitations_org_id ON public.organization_invitations(organization_id);

-- 2. POLÍTICAS RLS EN INVITACIONES
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Miembros de org pueden ver invitaciones" ON public.organization_invitations;
CREATE POLICY "Miembros de org pueden ver invitaciones"
ON public.organization_invitations FOR SELECT TO authenticated
USING (
  organization_id IN (SELECT public.get_user_organization_ids())
);

DROP POLICY IF EXISTS "Miembros de org pueden crear invitaciones" ON public.organization_invitations;
CREATE POLICY "Miembros de org pueden crear invitaciones"
ON public.organization_invitations FOR INSERT TO authenticated
WITH CHECK (
  organization_id IN (SELECT public.get_user_organization_ids())
);

DROP POLICY IF EXISTS "Miembros de org pueden borrar invitaciones" ON public.organization_invitations;
CREATE POLICY "Miembros de org pueden borrar invitaciones"
ON public.organization_invitations FOR DELETE TO authenticated
USING (
  organization_id IN (SELECT public.get_user_organization_ids())
);

-- 3. PERMITIR INSERTAR EN ALLOWED_USERS A USUARIOS AUTENTICADOS
ALTER TABLE public.allowed_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios autenticados pueden ver y agregar allowed_users" ON public.allowed_users;
CREATE POLICY "Usuarios autenticados pueden ver y agregar allowed_users"
ON public.allowed_users FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- 4. ACTUALIZAR TRIGGER DE ASIGNACIÓN CON SOPORTE PARA INVITACIONES
CREATE OR REPLACE FUNCTION public.handle_new_user_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
  default_org_id UUID;
BEGIN
  -- Buscar invitacion pendiente para este email
  SELECT organization_id, role INTO inv 
  FROM public.organization_invitations 
  WHERE LOWER(email) = LOWER(NEW.email) 
  ORDER BY created_at DESC 
  LIMIT 1;

  IF inv.organization_id IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (inv.organization_id, NEW.id, COALESCE(inv.role, 'member'))
    ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role;
    
    DELETE FROM public.organization_invitations WHERE LOWER(email) = LOWER(NEW.email);
  ELSE
    SELECT id INTO default_org_id FROM public.organizations ORDER BY created_at ASC LIMIT 1;
    IF default_org_id IS NOT NULL THEN
      INSERT INTO public.organization_members (organization_id, user_id, role)
      VALUES (default_org_id, NEW.id, 'member')
      ON CONFLICT (organization_id, user_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
