create policy "admins manage roles insert" on public.user_roles for insert to authenticated
  with check (public.has_role(auth.uid(),'admin'));
create policy "admins manage roles delete" on public.user_roles for delete to authenticated
  using (public.has_role(auth.uid(),'admin'));
grant insert, delete on public.user_roles to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email)
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role) values (new.id, 'employee')
  on conflict do nothing;

  -- the very first account becomes the system administrator
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

-- admins can read every role row (already covered) and see all profiles (already public to authenticated)
create or replace function public.list_user_roles()
returns table (user_id uuid, role public.app_role)
language sql stable security definer set search_path = public as $$
  select ur.user_id, ur.role from public.user_roles ur
  where public.has_role(auth.uid(),'admin');
$$;