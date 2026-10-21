CREATE OR REPLACE FUNCTION public.is_owner(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role IN ('owner','admin')) $$;

CREATE OR REPLACE FUNCTION public.is_manager(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role IN ('owner','admin','manager')) $$;

CREATE OR REPLACE FUNCTION public.can_see_company(_cid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = _cid AND
   (public.is_manager(auth.uid()) OR c.owner_id IS NULL OR c.owner_id = auth.uid())) $$;

DROP POLICY IF EXISTS "view companies" ON public.companies;
DROP POLICY IF EXISTS "update companies" ON public.companies;
DROP POLICY IF EXISTS "delete companies" ON public.companies;
CREATE POLICY "view companies" ON public.companies FOR SELECT TO authenticated
  USING (public.is_manager(auth.uid()) OR owner_id IS NULL OR owner_id = auth.uid());
CREATE POLICY "update companies" ON public.companies FOR UPDATE TO authenticated
  USING (public.is_manager(auth.uid()) OR owner_id IS NULL OR owner_id = auth.uid());
CREATE POLICY "delete companies" ON public.companies FOR DELETE TO authenticated
  USING (public.is_manager(auth.uid()));

DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
CREATE POLICY "owners manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));

DROP POLICY IF EXISTS "admins api keys" ON public.api_keys;
CREATE POLICY "owners api keys" ON public.api_keys FOR ALL TO authenticated
  USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles(id,email,full_name)
  VALUES (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)));
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role IN ('owner','admin')) THEN
    INSERT INTO public.user_roles(user_id,role) VALUES (new.id,'owner');
  ELSE
    INSERT INTO public.user_roles(user_id,role) VALUES (new.id,'bd');
  END IF;
  RETURN new;
END $$;

UPDATE public.user_roles SET role = 'owner' WHERE role = 'admin';
UPDATE public.user_roles SET role = 'bd' WHERE role = 'member';