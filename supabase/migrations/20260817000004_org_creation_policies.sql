-- =====================================================================
-- PERMISOS PARA CREAR ORGANIZACIONES Y GESTIONAR MEMBRESÍAS
-- =====================================================================

-- 1. Insertar organizaciones
DROP POLICY IF EXISTS "Usuarios autenticados pueden crear organizaciones" ON public.organizations;
CREATE POLICY "Usuarios autenticados pueden crear organizaciones"
ON public.organizations FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

-- 2. Modificar organizaciones
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

-- 3. Insertar miembros en organizaciones
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
