-- =====================================================================
-- AUTUMN - AUTORIZAR USUARIO SIN ORGANIZACIÓN
-- Email: vazquez.martin.gil@gmail.com
-- =====================================================================

-- 1. Añadir el email a la lista blanca de usuarios autorizados
INSERT INTO public.allowed_users (email)
VALUES ('vazquez.martin.gil@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- 2. Asegurar que no tenga invitaciones u organizaciones vinculadas
DELETE FROM public.organization_invitations
WHERE email ILIKE 'vazquez.martin.gil@gmail.com';

DELETE FROM public.organization_members
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email ILIKE 'vazquez.martin.gil@gmail.com'
);

-- Consulta de verificación:
SELECT * FROM public.allowed_users WHERE email ILIKE 'vazquez.martin.gil@gmail.com';
