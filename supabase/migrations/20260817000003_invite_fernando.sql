-- 1. Ensure allowed_users has fernando.guijarrovillalba@gmail.com
INSERT INTO public.allowed_users (email)
VALUES ('fernando.guijarrovillalba@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- 2. Ensure organization_invitations has invite for fernando.guijarrovillalba@gmail.com to Fresh Analytics Inc.
INSERT INTO public.organization_invitations (organization_id, email, role)
SELECT id, 'fernando.guijarrovillalba@gmail.com', 'member'
FROM public.organizations
WHERE name = 'Fresh Analytics Inc.'
LIMIT 1
ON CONFLICT (organization_id, email) DO UPDATE SET role = 'member';
