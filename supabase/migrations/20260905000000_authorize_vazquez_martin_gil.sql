-- =====================================================================
-- AUTUMN - CREAR USUARIO AUTORIZADO SIN ORGANIZACIÓN
-- Email: vazquez.martin.gil@gmail.com
-- Contraseña predeterminada: Autumn2026!
-- =====================================================================

-- 1. Añadir el email a la lista blanca de usuarios autorizados
INSERT INTO public.allowed_users (email)
VALUES ('vazquez.martin.gil@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- 2. Asegurar que no tenga invitaciones u organizaciones vinculadas previamente
DELETE FROM public.organization_invitations
WHERE email ILIKE 'vazquez.martin.gil@gmail.com';

DELETE FROM public.organization_members
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email ILIKE 'vazquez.martin.gil@gmail.com'
);

-- 3. Crear o actualizar la cuenta en auth.users con la contraseña "Autumn2026!"
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Buscar si ya existe el usuario
  SELECT id INTO v_user_id FROM auth.users WHERE email ILIKE 'vazquez.martin.gil@gmail.com';

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      'vazquez.martin.gil@gmail.com',
      crypt('Autumn2026!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"Martín Vázquez"}',
      now(),
      now()
    );

    -- Registrar identidad para login con email
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    )
    VALUES (
      v_user_id,
      v_user_id,
      json_build_object('sub', v_user_id::text, 'email', 'vazquez.martin.gil@gmail.com'),
      'email',
      now(),
      now(),
      now()
    )
    ON CONFLICT (provider, id) DO NOTHING;
  ELSE
    -- Si ya existía, restablecerle la contraseña a Autumn2026!
    UPDATE auth.users
    SET 
      encrypted_password = crypt('Autumn2026!', gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
    WHERE id = v_user_id;
  END IF;
END;
$$;

-- Consulta de comprobación final:
SELECT id, email, created_at, email_confirmed_at 
FROM auth.users 
WHERE email ILIKE 'vazquez.martin.gil@gmail.com';
