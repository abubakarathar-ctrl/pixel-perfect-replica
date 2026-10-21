create type public.app_role as enum ('admin','member');
create type public.lead_tier as enum ('hot','warm','cold');
create type public.pipeline_stage as enum ('new','verified','contacted','replied','meeting','won','lost');
create type public.employment_type as enum ('contract','contract_friendly','full_time');
create type public.contact_type as enum ('recruiter_hr','decision_maker');
create type public.email_status as enum ('valid','risky','invalid','unknown');
create type public.activity_type as enum ('note','email','call','meeting','status_change');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text, full_name text, created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null, unique(user_id, role)
);
grant select, insert, update, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id=_user_id and role=_role) $$;

create policy "roles readable" on public.user_roles for select to authenticated using (true);
create policy "admins manage roles" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id,email,full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)));
  if not exists (select 1 from public.user_roles where role='admin') then
    insert into public.user_roles(user_id,role) values (new.id,'admin');
  else
    insert into public.user_roles(user_id,role) values (new.id,'member');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null, website text, linkedin_url text, size text, funding_stage text, location text,
  score int not null default 50, tier lead_tier not null default 'cold',
  stage pipeline_stage not null default 'new',
  owner_id uuid, follow_up_date date,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.companies to authenticated;
grant all on public.companies to service_role;
alter table public.companies enable row level security;
create policy "view companies" on public.companies for select to authenticated
  using (public.has_role(auth.uid(),'admin') or owner_id is null or owner_id = auth.uid());
create policy "insert companies" on public.companies for insert to authenticated with check (true);
create policy "update companies" on public.companies for update to authenticated
  using (public.has_role(auth.uid(),'admin') or owner_id is null or owner_id = auth.uid());
create policy "delete companies" on public.companies for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create or replace function public.can_see_company(_cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.companies c where c.id=_cid and
   (public.has_role(auth.uid(),'admin') or c.owner_id is null or c.owner_id = auth.uid())) $$;

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null, role_family text, employment_type employment_type not null default 'contract',
  remote_us boolean not null default true, job_url text, source text,
  found_date date not null default current_date, is_live boolean not null default true
);
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  full_name text not null, title text, contact_type contact_type not null default 'decision_maker',
  linkedin_url text, email text, email_status email_status not null default 'unknown', source text
);
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  user_id uuid, type activity_type not null default 'note', body text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.jobs, public.contacts, public.activities to authenticated;
grant all on public.jobs, public.contacts, public.activities to service_role;
alter table public.jobs enable row level security;
alter table public.contacts enable row level security;
alter table public.activities enable row level security;
create policy "jobs access" on public.jobs for all to authenticated using (public.can_see_company(company_id)) with check (public.can_see_company(company_id));
create policy "contacts access" on public.contacts for all to authenticated using (public.can_see_company(company_id)) with check (public.can_see_company(company_id));
create policy "activities read" on public.activities for select to authenticated using (public.can_see_company(company_id));
create policy "activities insert" on public.activities for insert to authenticated with check (public.can_see_company(company_id) and user_id = auth.uid());

create or replace function public.log_stage_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.stage is distinct from old.stage then
    insert into public.activities(company_id,user_id,type,body)
    values (new.id, auth.uid(), 'status_change', 'Stage moved from '||old.stage||' to '||new.stage);
  end if;
  return new;
end $$;
create trigger companies_stage_change after update on public.companies for each row execute function public.log_stage_change();

create table public.api_keys (
  provider text primary key, secret_value text not null, last4 text not null,
  updated_at timestamptz not null default now()
);
grant select (provider,last4,updated_at), insert, update, delete on public.api_keys to authenticated;
grant all on public.api_keys to service_role;
alter table public.api_keys enable row level security;
create policy "admins api keys" on public.api_keys for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- seed
insert into public.companies (id,name,website,linkedin_url,size,funding_stage,location,score,tier,stage,follow_up_date,created_at) values
('11111111-0000-0000-0000-000000000001','Quorra Labs','https://quorralabs.io','https://linkedin.com/company/quorra-labs','51-200','Series B','San Francisco, CA',92,'hot','contacted',current_date,now()),
('11111111-0000-0000-0000-000000000002','Driftline','https://driftline.dev','https://linkedin.com/company/driftline','11-50','Series A','Austin, TX',88,'hot','new',null,now()),
('11111111-0000-0000-0000-000000000003','Helix Ledger','https://helixledger.com','https://linkedin.com/company/helix-ledger','201-500','Series C','New York, NY',81,'hot','replied',current_date,now()-interval '1 day'),
('11111111-0000-0000-0000-000000000004','Paperkite AI','https://paperkite.ai','https://linkedin.com/company/paperkite','11-50','Seed','Seattle, WA',74,'warm','verified',null,now()-interval '2 days'),
('11111111-0000-0000-0000-000000000005','Northbeam Cloud','https://northbeam.cloud','https://linkedin.com/company/northbeam','51-200','Series A','Denver, CO',69,'warm','meeting',current_date,now()-interval '3 days'),
('11111111-0000-0000-0000-000000000006','Cinder Security','https://cindersec.com','https://linkedin.com/company/cinder-security','11-50','Series A','Boston, MA',66,'warm','new',null,now()-interval '3 days'),
('11111111-0000-0000-0000-000000000007','Tessellate Data','https://tessellate.so','https://linkedin.com/company/tessellate','51-200','Series B','Chicago, IL',58,'warm','contacted',null,now()-interval '4 days'),
('11111111-0000-0000-0000-000000000008','Mosswood Health','https://mosswood.health','https://linkedin.com/company/mosswood','201-500','Series C','Remote',45,'cold','won',null,now()-interval '5 days'),
('11111111-0000-0000-0000-000000000009','Brightpath Robotics','https://brightpath.bot','https://linkedin.com/company/brightpath','11-50','Seed','Pittsburgh, PA',38,'cold','lost',null,now()-interval '6 days'),
('11111111-0000-0000-0000-000000000010','Orbitkit','https://orbitkit.app','https://linkedin.com/company/orbitkit','1-10','Pre-seed','Miami, FL',31,'cold','new',null,now()-interval '6 days');

insert into public.jobs (company_id,title,role_family,employment_type,remote_us,job_url,source,found_date) values
('11111111-0000-0000-0000-000000000001','Senior SRE (Contract, 6mo)','SRE','contract',true,'https://quorralabs.io/careers/sre','LinkedIn',current_date),
('11111111-0000-0000-0000-000000000001','Platform Engineer','DevOps','contract_friendly',true,'https://quorralabs.io/careers/platform','Greenhouse',current_date),
('11111111-0000-0000-0000-000000000002','DevOps Engineer – Kubernetes','DevOps','contract',true,'https://driftline.dev/jobs/1','Wellfound',current_date),
('11111111-0000-0000-0000-000000000003','Cloud Security Engineer','Security','contract',true,'https://helixledger.com/jobs/sec','LinkedIn',current_date-1),
('11111111-0000-0000-0000-000000000003','Data Engineer (dbt/Snowflake)','Data','contract_friendly',true,'https://helixledger.com/jobs/data','Lever',current_date-1),
('11111111-0000-0000-0000-000000000004','ML Engineer – LLM Infra','ML','contract',true,'https://paperkite.ai/jobs/ml','YC Jobs',current_date-2),
('11111111-0000-0000-0000-000000000005','AWS Cloud Architect','Cloud','contract',true,'https://northbeam.cloud/jobs','LinkedIn',current_date-3),
('11111111-0000-0000-0000-000000000006','Detection Engineer','Security','contract_friendly',true,'https://cindersec.com/jobs','Ashby',current_date-3),
('11111111-0000-0000-0000-000000000007','Analytics Engineer','Data','full_time',false,'https://tessellate.so/jobs','Lever',current_date-4),
('11111111-0000-0000-0000-000000000008','Senior DevOps (Terraform)','DevOps','contract',true,'https://mosswood.health/jobs','Indeed',current_date-5),
('11111111-0000-0000-0000-000000000009','Robotics ML Engineer','ML','full_time',false,'https://brightpath.bot/jobs','Wellfound',current_date-6),
('11111111-0000-0000-0000-000000000010','GCP Cloud Engineer','Cloud','contract_friendly',true,'https://orbitkit.app/jobs','YC Jobs',current_date-6);

insert into public.contacts (company_id,full_name,title,contact_type,linkedin_url,email,email_status,source) values
('11111111-0000-0000-0000-000000000001','Maya Chen','Head of Talent','recruiter_hr','https://linkedin.com/in/mayachen','maya@quorralabs.io','valid','Apollo'),
('11111111-0000-0000-0000-000000000001','Daniel Ortiz','VP Engineering','decision_maker','https://linkedin.com/in/dortiz','daniel@quorralabs.io','valid','Hunter'),
('11111111-0000-0000-0000-000000000002','Priya Natarajan','CTO','decision_maker','https://linkedin.com/in/priyan','priya@driftline.dev','risky','Apollo'),
('11111111-0000-0000-0000-000000000003','Jordan Blake','Technical Recruiter','recruiter_hr','https://linkedin.com/in/jblake','jordan@helixledger.com','valid','Apollo'),
('11111111-0000-0000-0000-000000000003','Sam Whitfield','Director of Security','decision_maker','https://linkedin.com/in/swhitfield','sam.w@helixledger.com','valid','Hunter'),
('11111111-0000-0000-0000-000000000004','Leo Park','Founder & CEO','decision_maker','https://linkedin.com/in/leopark','leo@paperkite.ai','valid','Apollo'),
('11111111-0000-0000-0000-000000000005','Ava Thompson','People Ops Lead','recruiter_hr','https://linkedin.com/in/avat','ava@northbeam.cloud','invalid','Apollo'),
('11111111-0000-0000-0000-000000000005','Marcus Reed','Head of Infrastructure','decision_maker','https://linkedin.com/in/mreed','marcus@northbeam.cloud','valid','Hunter'),
('11111111-0000-0000-0000-000000000006','Nina Alvarez','CISO','decision_maker','https://linkedin.com/in/ninaal','nina@cindersec.com','risky','Apollo'),
('11111111-0000-0000-0000-000000000007','Ethan Cole','Talent Partner','recruiter_hr','https://linkedin.com/in/ecole','ethan@tessellate.so','valid','Apollo'),
('11111111-0000-0000-0000-000000000008','Grace Kim','VP Platform','decision_maker','https://linkedin.com/in/gracek','grace@mosswood.health','valid','Hunter'),
('11111111-0000-0000-0000-000000000010','Omar Haddad','Co-founder','decision_maker','https://linkedin.com/in/ohaddad','omar@orbitkit.app','unknown','Apollo');

insert into public.activities (company_id,type,body,created_at) values
('11111111-0000-0000-0000-000000000001','email','Intro email sent to Daniel re: SRE contract.',now()-interval '2 hours'),
('11111111-0000-0000-0000-000000000003','email','Sam replied — interested, wants 2 profiles by Friday.',now()-interval '1 day'),
('11111111-0000-0000-0000-000000000005','meeting','Discovery call booked with Marcus, Thu 2pm ET.',now()-interval '2 days'),
('11111111-0000-0000-0000-000000000008','status_change','Closed won — 2 DevOps contractors placed.',now()-interval '4 days');