-- =====================================================================
-- AUTUMN - MEJORA DE RLS Y RPC PARA SEGUIMIENTO DE FEEDBACK
-- Permite a los usuarios consultar sus aportaciones por user_id, user_email
-- o mediante IDs locales anónimos vía RPC segura con SECURITY DEFINER.
-- =====================================================================

-- 1. Actualizar política de SELECT para usuarios autenticados
DROP POLICY IF EXISTS "Usuarios pueden ver su propio feedback o administradores todos" ON public.user_feedback;
CREATE POLICY "Usuarios pueden ver su propio feedback o administradores todos"
ON public.user_feedback FOR SELECT TO authenticated
USING (
  user_id = (select auth.uid())
  OR (user_email IS NOT NULL AND user_email = (select auth.jwt()->>'email'))
  OR (select auth.jwt()->>'email') = 'vazquez.martin.gil@gmail.com'
  OR EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = (select auth.uid())
    AND om.role IN ('manager', 'admin', 'owner')
  )
);

-- 2. Actualizar política de UPDATE para gestores y administradores
DROP POLICY IF EXISTS "Managers y administradores pueden actualizar feedback" ON public.user_feedback;
CREATE POLICY "Managers y administradores pueden actualizar feedback"
ON public.user_feedback FOR UPDATE TO authenticated
USING (
  (select auth.jwt()->>'email') = 'vazquez.martin.gil@gmail.com'
  OR EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = (select auth.uid())
    AND om.role IN ('manager', 'admin', 'owner')
  )
)
WITH CHECK (
  (select auth.jwt()->>'email') = 'vazquez.martin.gil@gmail.com'
  OR EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = (select auth.uid())
    AND om.role IN ('manager', 'admin', 'owner')
  )
);

-- 3. Función RPC segura para consultar feedbacks específicos por array de IDs (para seguimiento anónimo/local)
CREATE OR REPLACE FUNCTION public.get_feedbacks_by_ids(p_ids uuid[])
RETURNS TABLE (
  id uuid,
  user_id uuid,
  user_email text,
  comment text,
  category text,
  status text,
  project_id uuid,
  project_name text,
  device_info text,
  admin_notes text,
  created_at timestamptz,
  updated_at timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT
    uf.id,
    uf.user_id,
    uf.user_email,
    uf.comment,
    uf.category,
    uf.status,
    uf.project_id,
    uf.project_name,
    uf.device_info,
    uf.admin_notes,
    uf.created_at,
    uf.updated_at
  FROM public.user_feedback uf
  WHERE uf.id = ANY(p_ids)
  ORDER BY uf.created_at DESC;
$$;

-- Conceder permisos de ejecución a roles anon y authenticated
GRANT EXECUTE ON FUNCTION public.get_feedbacks_by_ids(uuid[]) TO anon, authenticated;
