-- =====================================================================
-- AUTUMN - UNIFICACIÓN DE ORGANIZACIONES EN "Fresh Analytics Inc."
-- =====================================================================

DO $$
DECLARE
  v_target_org_id UUID;
  v_target_org_code TEXT;
  v_projects_updated INT := 0;
  v_members_migrated INT := 0;
  v_orgs_deleted INT := 0;
BEGIN
  -- 1. Buscar la organización principal "Fresh Analytics Inc."
  SELECT id, join_code INTO v_target_org_id, v_target_org_code
  FROM public.organizations
  WHERE name ILIKE 'Fresh Analytics Inc.%'
  ORDER BY created_at ASC
  LIMIT 1;

  -- Si no existe con ese nombre exacto, tomamos la primera y la renombramos, o la creamos
  IF v_target_org_id IS NULL THEN
    SELECT id INTO v_target_org_id
    FROM public.organizations
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_target_org_id IS NOT NULL THEN
      UPDATE public.organizations
      SET name = 'Fresh Analytics Inc.'
      WHERE id = v_target_org_id;
    ELSE
      INSERT INTO public.organizations (name, join_code)
      VALUES ('Fresh Analytics Inc.', 'ORG-' || upper(substring(md5(random()::text) from 1 for 4)))
      RETURNING id, join_code INTO v_target_org_id, v_target_org_code;
    END IF;
  END IF;

  -- Asegurar que tenga un join_code asignado
  IF v_target_org_code IS NULL THEN
    UPDATE public.organizations
    SET join_code = 'ORG-' || upper(substring(md5(random()::text) from 1 for 4))
    WHERE id = v_target_org_id
    RETURNING join_code INTO v_target_org_code;
  END IF;

  RAISE NOTICE 'Organización destino: Fresh Analytics Inc. (ID: %, Código: %)', v_target_org_id, v_target_org_code;

  -- 2. Migrar todos los miembros de otras organizaciones a Fresh Analytics Inc.
  -- Si el usuario ya era manager o admin, conservamos su rango más alto
  INSERT INTO public.organization_members (organization_id, user_id, role, created_at)
  SELECT 
    v_target_org_id,
    om.user_id,
    om.role,
    om.created_at
  FROM public.organization_members om
  WHERE om.organization_id != v_target_org_id
  ON CONFLICT (organization_id, user_id) 
  DO UPDATE SET role = 
    CASE 
      WHEN EXCLUDED.role IN ('admin', 'manager') AND public.organization_members.role = 'member' 
        THEN EXCLUDED.role
      ELSE public.organization_members.role 
    END;

  GET DIAGNOSTICS v_members_migrated = ROW_COUNT;
  RAISE NOTICE 'Miembros consolidados: %', v_members_migrated;

  -- 3. Reasignar todos los proyectos huérfanos o de otras organizaciones a Fresh Analytics Inc.
  -- Cumplimos estrictamente el disparador de concurrencia optimista incrementando version = version + 1
  UPDATE public.projects
  SET organization_id = v_target_org_id,
      version = COALESCE(version, 0) + 1,
      updated_at = now()
  WHERE organization_id IS NULL OR organization_id != v_target_org_id;

  GET DIAGNOSTICS v_projects_updated = ROW_COUNT;
  RAISE NOTICE 'Proyectos reasignados: %', v_projects_updated;

  -- 4. Reasignar invitaciones pendientes a Fresh Analytics Inc. (eliminando duplicados previos)
  DELETE FROM public.organization_invitations
  WHERE organization_id != v_target_org_id
  AND email IN (
    SELECT email FROM public.organization_invitations WHERE organization_id = v_target_org_id
  );

  UPDATE public.organization_invitations
  SET organization_id = v_target_org_id
  WHERE organization_id != v_target_org_id;

  -- 5. Eliminar todas las demás organizaciones
  DELETE FROM public.organizations
  WHERE id != v_target_org_id;

  GET DIAGNOSTICS v_orgs_deleted = ROW_COUNT;
  RAISE NOTICE 'Organizaciones secundarias eliminadas: %', v_orgs_deleted;

  RAISE NOTICE '=== UNIFICACIÓN EXITOSA: Solo queda Fresh Analytics Inc. ===';
END;
$$;

-- Consulta de comprobación post-unificación:
SELECT 
  id, 
  name, 
  join_code, 
  created_at,
  (SELECT count(*) FROM public.organization_members WHERE organization_id = organizations.id) as total_miembros,
  (SELECT count(*) FROM public.projects WHERE organization_id = organizations.id) as total_proyectos
FROM public.organizations;
