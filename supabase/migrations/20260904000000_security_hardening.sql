-- =====================================================================
-- AUTUMN - MIGRACIÓN DE SEGURIDAD PRE-PRODUCCIÓN
-- Refuerzo de RLS, Aislamiento de Tenants y Protección de Whitelist
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. CORRECCIÓN: BOLA / IDOR EN MEMBRESÍAS DE ORGANIZACIÓN
-- ---------------------------------------------------------------------
-- Eliminamos la política abierta que permitía a cualquier usuario auto-asignarse a cualquier organización
DROP POLICY IF EXISTS "Insertar membresia propia al crear organizacion" ON public.organization_members;

-- Solo los managers o admins de la organización pueden añadir nuevos miembros directamente por tabla
CREATE POLICY "Managers pueden agregar miembros a su organizacion"
ON public.organization_members FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = organization_members.organization_id
    AND om.user_id = auth.uid()
    AND om.role IN ('manager', 'admin')
  )
);

-- ---------------------------------------------------------------------
-- 2. CORRECCIÓN: AISLAMIENTO DE TENANTS EN EL REGISTRO DE USUARIOS
-- ---------------------------------------------------------------------
-- Modificamos el trigger para NUNCA asociar a un usuario desconocido a la primera empresa de la base de datos
CREATE OR REPLACE FUNCTION public.handle_new_user_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
BEGIN
  -- 1. Buscar si existe una invitación pendiente asociada a su correo electrónico
  SELECT organization_id, role INTO inv 
  FROM public.organization_invitations 
  WHERE LOWER(email) = LOWER(NEW.email) 
  ORDER BY created_at DESC 
  LIMIT 1;

  -- 2. Si fue invitado formalmente, se le asigna a dicha organización con su rol correspondiente
  IF inv.organization_id IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (inv.organization_id, NEW.id, COALESCE(inv.role, 'member'))
    ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role;
    
    -- Borrar la invitación consumida
    DELETE FROM public.organization_invitations WHERE LOWER(email) = LOWER(NEW.email);
  END IF;

  -- Si NO tiene invitación, el usuario se registra sin organización.
  -- La aplicación le mostrará el asistente para crear su propia empresa o unirse mediante código.

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- 3. CORRECCIÓN: RESTRINGIR ACCESO A TABLA ALLOWED_USERS
-- ---------------------------------------------------------------------
ALTER TABLE public.allowed_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios autenticados pueden ver y agregar allowed_users" ON public.allowed_users;

-- Lectura: Solo puedes ver tu propio correo o correos gestionados si eres manager/admin
CREATE POLICY "Lectura controlada de allowed_users"
ON public.allowed_users FOR SELECT TO authenticated
USING (
  email = auth.jwt() ->> 'email'
  OR EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
    AND om.role IN ('manager', 'admin')
  )
);

-- Inserción / Modificación: Solo managers/admins pueden añadir correos a la lista blanca
CREATE POLICY "Solo managers pueden insertar en allowed_users"
ON public.allowed_users FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = organization_members.organization_id
    AND om.user_id = auth.uid()
    AND om.role IN ('manager', 'admin')
  )
);

CREATE POLICY "Solo managers pueden modificar allowed_users"
ON public.allowed_users FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
    AND om.role IN ('manager', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
    AND om.role IN ('manager', 'admin')
  )
);

CREATE POLICY "Solo managers pueden eliminar de allowed_users"
ON public.allowed_users FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
    AND om.role IN ('manager', 'admin')
  )
);
