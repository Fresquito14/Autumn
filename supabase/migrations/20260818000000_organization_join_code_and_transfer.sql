-- =====================================================================
-- AUTUMN - ORGANIZATIONS, JOIN CODES, RLS POLICIES & OWNERSHIP TRANSFER
-- =====================================================================

-- 1. AGREGAR CÓDIGO DE UNIÓN A ORGANIZACIONES
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS join_code TEXT UNIQUE;

-- Función generadora de código alfanumérico corto (ej. ORG-7492)
CREATE OR REPLACE FUNCTION public.generate_unique_org_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    v_code := 'ORG-' || upper(substring(md5(random()::text) from 1 for 4));
    SELECT EXISTS (SELECT 1 FROM public.organizations WHERE join_code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_code;
END;
$$;

-- Trigger para auto-generar join_code al insertar cualquier organización
CREATE OR REPLACE FUNCTION public.set_org_join_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.join_code IS NULL OR trim(NEW.join_code) = '' THEN
    NEW.join_code := public.generate_unique_org_code();
  ELSE
    NEW.join_code := upper(trim(NEW.join_code));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_org_join_code ON public.organizations;
CREATE TRIGGER trg_set_org_join_code
BEFORE INSERT ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.set_org_join_code();

-- Rellenar códigos para las organizaciones existentes que no lo tengan
UPDATE public.organizations 
SET join_code = public.generate_unique_org_code()
WHERE join_code IS NULL;

-- Índice para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_organizations_join_code ON public.organizations(upper(join_code));

-- 2. POLÍTICAS RLS EN ORGANIZACIONES Y MIEMBROS (CORRIGE ERROR DE RETURNING)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- SELECT organizations: Miembros de la organización O el creador de la misma
DROP POLICY IF EXISTS "Miembros pueden ver su organizacion" ON public.organizations;
CREATE POLICY "Miembros pueden ver su organizacion"
ON public.organizations FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR id IN (SELECT public.get_user_organization_ids())
);

-- INSERT organizations: Cualquier usuario autenticado puede crear una organización con su user_id
DROP POLICY IF EXISTS "Usuarios autenticados pueden crear organizaciones" ON public.organizations;
CREATE POLICY "Usuarios autenticados pueden crear organizaciones"
ON public.organizations FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

-- UPDATE organizations: El creador o un manager/admin
DROP POLICY IF EXISTS "Managers pueden actualizar su organizacion" ON public.organizations;
CREATE POLICY "Managers pueden actualizar su organizacion"
ON public.organizations FOR UPDATE TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = organizations.id
    AND om.user_id = auth.uid()
    AND om.role IN ('manager', 'admin')
  )
)
WITH CHECK (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = organizations.id
    AND om.user_id = auth.uid()
    AND om.role IN ('manager', 'admin')
  )
);

-- SELECT organization_members
DROP POLICY IF EXISTS "Miembros pueden ver miembros de su organizacion" ON public.organization_members;
CREATE POLICY "Miembros pueden ver miembros de su organizacion"
ON public.organization_members FOR SELECT TO authenticated
USING (
  organization_id IN (SELECT public.get_user_organization_ids())
  OR EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = organization_members.organization_id AND o.created_by = auth.uid()
  )
);

-- INSERT organization_members: Registrarse uno mismo al crear o mediante un manager
DROP POLICY IF EXISTS "Insertar membresia propia al crear organizacion" ON public.organization_members;
CREATE POLICY "Insertar membresia propia al crear organizacion"
ON public.organization_members FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = organization_members.organization_id
    AND om.user_id = auth.uid()
    AND om.role IN ('manager', 'admin')
  )
);

-- 3. RPC ATÓMICA PARA CREAR ORGANIZACIÓN (100% SEGURA Y ATÓMICA)
CREATE OR REPLACE FUNCTION public.create_new_organization(org_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_org RECORD;
  v_code TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  v_code := public.generate_unique_org_code();

  INSERT INTO public.organizations (name, created_by, join_code)
  VALUES (trim(org_name), auth.uid(), v_code)
  RETURNING id, name, join_code, created_at, created_by INTO v_new_org;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_new_org.id, auth.uid(), 'manager')
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN jsonb_build_object(
    'id', v_new_org.id,
    'name', v_new_org.name,
    'join_code', v_new_org.join_code,
    'created_at', v_new_org.created_at,
    'created_by', v_new_org.created_by
  );
END;
$$;

-- 4. RPC PARA UNIRSE A UNA ORGANIZACIÓN MEDIANTE CÓDIGO
CREATE OR REPLACE FUNCTION public.join_organization_by_code(org_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_code TEXT := upper(trim(org_code));
  v_org RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  SELECT id, name, join_code INTO v_org
  FROM public.organizations
  WHERE upper(trim(join_code)) = v_clean_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El código de organización no es válido o no existe.';
  END IF;

  -- Insertar membresía como manager
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org.id, auth.uid(), 'manager')
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN jsonb_build_object(
    'organization_id', v_org.id,
    'name', v_org.name,
    'join_code', v_org.join_code,
    'success', true
  );
END;
$$;

-- 5. RPC PARA TRASPASAR PROYECTO (TRANSFER OWNERSHIP)
CREATE OR REPLACE FUNCTION public.transfer_project_ownership(
  p_project_id UUID,
  p_new_owner_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project RECORD;
  v_is_member BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  -- 1. Verificar que el usuario actual es el OWNER del proyecto
  SELECT id, user_id, organization_id INTO v_project
  FROM public.projects
  WHERE id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proyecto no encontrado';
  END IF;

  IF v_project.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Solo el creador del proyecto puede traspasar su propiedad';
  END IF;

  IF v_project.organization_id IS NULL THEN
    RAISE EXCEPTION 'El proyecto debe pertenecer a una organización para ser traspasado';
  END IF;

  -- 2. Verificar que el nuevo responsable pertenece a la misma organización
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = v_project.organization_id AND user_id = p_new_owner_id
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RAISE EXCEPTION 'El nuevo responsable debe ser miembro de la misma organización';
  END IF;

  -- 3. Actualizar el owner del proyecto
  UPDATE public.projects
  SET user_id = p_new_owner_id,
      updated_at = now()
  WHERE id = p_project_id;

  RETURN true;
END;
$$;

-- 6. RPC PARA OBTENER LISTA DE MIEMBROS DE LA ORGANIZACIÓN
CREATE OR REPLACE FUNCTION public.get_organization_members_list(p_org_id UUID)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  role TEXT,
  joined_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para ver los miembros de esta organización';
  END IF;

  RETURN QUERY
  SELECT 
    om.user_id,
    COALESCE(u.email, 'Usuario') as email,
    om.role,
    om.created_at as joined_at
  FROM public.organization_members om
  LEFT JOIN auth.users u ON u.id = om.user_id
  WHERE om.organization_id = p_org_id
  ORDER BY om.created_at ASC;
END;
$$;
