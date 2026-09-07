-- ROLES
create type public.app_role as enum ('employee','manager','hr','travel_office','admin');
create type public.request_status as enum ('pending','in_progress','approved','rejected','closed');
create type public.approval_status as enum ('pending','approved','rejected','skipped');

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);
grant select on public.departments to authenticated;
grant all on public.departments to service_role;
alter table public.departments enable row level security;
create policy "departments readable" on public.departments for select to authenticated using (true);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null default '',
  department_id uuid references public.departments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create policy "read own roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.request_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  department_id uuid not null references public.departments(id) on delete cascade,
  description text,
  created_at timestamptz not null default now(),
  unique (name, department_id)
);
grant select on public.request_types to authenticated;
grant all on public.request_types to service_role;
alter table public.request_types enable row level security;
create policy "request types readable" on public.request_types for select to authenticated using (true);

create table public.approval_workflows (
  id uuid primary key default gen_random_uuid(),
  request_type_id uuid not null references public.request_types(id) on delete cascade,
  step_order int not null,
  approver_role public.app_role not null,
  unique (request_type_id, step_order)
);
grant select on public.approval_workflows to authenticated;
grant all on public.approval_workflows to service_role;
alter table public.approval_workflows enable row level security;
create policy "workflows readable" on public.approval_workflows for select to authenticated using (true);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references auth.users(id) on delete cascade,
  request_type_id uuid not null references public.request_types(id),
  department_id uuid not null references public.departments(id),
  status public.request_status not null default 'pending',
  current_step int not null default 1,
  comments text,
  attachments text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.requests to authenticated;
grant all on public.requests to service_role;
alter table public.requests enable row level security;

create table public.request_approvals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  approver_role public.app_role not null,
  approver_employee_id uuid references auth.users(id),
  step_order int not null,
  status public.approval_status not null default 'pending',
  comments text,
  attachments text[] not null default '{}',
  action_date timestamptz,
  created_at timestamptz not null default now(),
  unique (request_id, step_order)
);
grant select, insert, update on public.request_approvals to authenticated;
grant all on public.request_approvals to service_role;
alter table public.request_approvals enable row level security;

-- can the user act on / see this request?
create or replace function public.is_request_approver(_user_id uuid, _request_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.request_approvals ra
    join public.user_roles ur on ur.role = ra.approver_role
    where ra.request_id = _request_id and ur.user_id = _user_id
  ) or public.has_role(_user_id,'admin');
$$;

create policy "own requests readable" on public.requests for select to authenticated
  using (employee_id = auth.uid() or public.is_request_approver(auth.uid(), id));
create policy "create own requests" on public.requests for insert to authenticated
  with check (employee_id = auth.uid());

create policy "approvals readable" on public.request_approvals for select to authenticated
  using (
    exists (select 1 from public.requests r where r.id = request_id and r.employee_id = auth.uid())
    or public.is_request_approver(auth.uid(), request_id)
  );

-- audit log
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.requests(id) on delete cascade,
  actor_id uuid,
  action text not null,
  details text,
  created_at timestamptz not null default now()
);
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "audit readable" on public.audit_logs for select to authenticated
  using (request_id is null or exists (select 1 from public.requests r where r.id = request_id and (r.employee_id = auth.uid() or public.is_request_approver(auth.uid(), r.id))));

-- notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid references public.requests(id) on delete cascade,
  title text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "own notifications update" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- new user -> profile + employee role
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email)
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'employee')
  on conflict do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- notify helper
create or replace function public.notify_users(_role public.app_role, _request_id uuid, _title text, _body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, request_id, title, body)
  select ur.user_id, _request_id, _title, _body from public.user_roles ur where ur.role = _role;
end;
$$;

-- create workflow steps after a request is inserted
create or replace function public.init_request_workflow()
returns trigger language plpgsql security definer set search_path = public as $$
declare first_role public.app_role; type_name text;
begin
  insert into public.request_approvals (request_id, approver_role, step_order)
  select new.id, w.approver_role, w.step_order
  from public.approval_workflows w where w.request_type_id = new.request_type_id
  order by w.step_order;

  select rt.name into type_name from public.request_types rt where rt.id = new.request_type_id;
  select approver_role into first_role from public.request_approvals where request_id = new.id order by step_order limit 1;

  insert into public.audit_logs (request_id, actor_id, action, details)
  values (new.id, new.employee_id, 'request_created', type_name);

  insert into public.notifications (user_id, request_id, title, body)
  values (new.employee_id, new.id, 'Request submitted', 'Your ' || type_name || ' request has been submitted.');

  if first_role is not null then
    perform public.notify_users(first_role, new.id, 'New approval assigned', 'A ' || type_name || ' request needs your approval.');
  else
    update public.requests set status = 'approved' where id = new.id;
  end if;
  return new;
end;
$$;
create trigger on_request_created after insert on public.requests
  for each row execute function public.init_request_workflow();

-- act on an approval step
create or replace function public.act_on_request(_request_id uuid, _decision public.approval_status, _comments text default null, _attachments text[] default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare
  step record; next_step record; type_name text; req record;
begin
  select * into req from public.requests where id = _request_id;
  if req is null then raise exception 'Request not found'; end if;
  if req.status in ('rejected','closed','approved') then raise exception 'Request already finalized'; end if;

  select * into step from public.request_approvals
   where request_id = _request_id and status = 'pending' order by step_order limit 1;
  if step is null then raise exception 'No pending step'; end if;

  if not (public.has_role(auth.uid(), step.approver_role) or public.has_role(auth.uid(),'admin')) then
    raise exception 'You are not authorized to act on this step';
  end if;
  if _decision not in ('approved','rejected') then raise exception 'Invalid decision'; end if;

  update public.request_approvals
     set status = _decision, comments = _comments, attachments = coalesce(_attachments,'{}'),
         approver_employee_id = auth.uid(), action_date = now()
   where id = step.id;

  select rt.name into type_name from public.request_types rt where rt.id = req.request_type_id;

  insert into public.audit_logs (request_id, actor_id, action, details)
  values (_request_id, auth.uid(), _decision::text, coalesce(_comments,''));

  if _decision = 'rejected' then
    update public.requests set status = 'rejected', updated_at = now() where id = _request_id;
    update public.request_approvals set status = 'skipped' where request_id = _request_id and status = 'pending';
    insert into public.notifications (user_id, request_id, title, body)
    values (req.employee_id, _request_id, 'Request rejected', 'Your ' || type_name || ' request was rejected.');
    return;
  end if;

  select * into next_step from public.request_approvals
   where request_id = _request_id and status = 'pending' order by step_order limit 1;

  if next_step is null then
    update public.requests set status = 'closed', updated_at = now() where id = _request_id;
    insert into public.notifications (user_id, request_id, title, body)
    values (req.employee_id, _request_id, 'Request closed', 'Your ' || type_name || ' request has been approved and closed.');
  else
    update public.requests set status = 'in_progress', current_step = next_step.step_order, updated_at = now() where id = _request_id;
    insert into public.notifications (user_id, request_id, title, body)
    values (req.employee_id, _request_id, 'Request progressed', 'Your ' || type_name || ' request moved to the next approval step.');
    perform public.notify_users(next_step.approver_role, _request_id, 'New approval assigned', 'A ' || type_name || ' request needs your approval.');
  end if;
end;
$$;

-- SEED
insert into public.departments (name) values ('HR'), ('Finance'), ('Travel'), ('IT');

insert into public.request_types (name, department_id, description)
select 'Salary Certificate', id, 'Official letter stating your salary' from public.departments where name='HR';
insert into public.request_types (name, department_id, description)
select 'Experience Certificate', id, 'Proof of employment and tenure' from public.departments where name='HR';
insert into public.request_types (name, department_id, description)
select 'Air Ticket', id, 'Business or annual leave air ticket' from public.departments where name='Travel';
insert into public.request_types (name, department_id, description)
select 'Hotel Booking', id, 'Accommodation for business travel' from public.departments where name='Travel';
insert into public.request_types (name, department_id, description)
select 'Expense Reimbursement', id, 'Claim back approved business expenses' from public.departments where name='Finance';
insert into public.request_types (name, department_id, description)
select 'Laptop Request', id, 'New or replacement hardware' from public.departments where name='IT';

insert into public.approval_workflows (request_type_id, step_order, approver_role)
select id, 1, 'manager' from public.request_types where name in ('Salary Certificate','Experience Certificate','Air Ticket','Hotel Booking','Expense Reimbursement','Laptop Request');
insert into public.approval_workflows (request_type_id, step_order, approver_role)
select id, 2, 'hr' from public.request_types where name in ('Salary Certificate','Experience Certificate','Air Ticket','Hotel Booking');
insert into public.approval_workflows (request_type_id, step_order, approver_role)
select id, 3, 'travel_office' from public.request_types where name in ('Air Ticket','Hotel Booking');
insert into public.approval_workflows (request_type_id, step_order, approver_role)
select id, 2, 'admin' from public.request_types where name in ('Expense Reimbursement','Laptop Request');
