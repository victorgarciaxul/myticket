-- MyTicket — Schema completo
-- Ejecutar en el SQL Editor de Supabase

-- Extensiones
create extension if not exists "uuid-ossp";

-- Perfiles de usuario (extends auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz default now()
);

-- Proyectos de gastos
create table public.projects (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'rejected', 'signed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Gastos individuales
create table public.expenses (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null check (type in (
    'food', 'transport_train', 'transport_bus', 'transport_taxi',
    'transport_car_own', 'transport_car_shared', 'accommodation', 'other'
  )),
  date date not null,
  amount numeric(10,2),
  currency text not null default 'EUR',
  description text,
  project_tag text,
  trip_reason text not null,
  receipt_url text,
  ai_data jsonb,
  transport_medium text check (transport_medium in (
    'train', 'bus', 'taxi', 'car_own', 'car_shared', 'plane', 'bike'
  )),
  km numeric(10,2),
  co2_kg numeric(10,4),
  created_at timestamptz default now()
);

-- Notificaciones
create table public.notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  project_id uuid references public.projects(id) on delete cascade,
  type text not null check (type in ('submitted', 'approved', 'rejected')),
  message text not null,
  read boolean default false,
  created_at timestamptz default now()
);

-- Trigger para crear perfil al registrar usuario
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'user')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger updated_at en projects
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.handle_updated_at();

-- RLS (Row Level Security)
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.expenses enable row level security;
alter table public.notifications enable row level security;

-- Profiles: cada uno ve el suyo; admins ven todos
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Admins view all profiles" on public.profiles
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Projects: owner ve los suyos; admins ven todos los enviados+
create policy "Users manage own projects" on public.projects
  for all using (auth.uid() = user_id);

create policy "Admins view submitted projects" on public.projects
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    and status != 'draft'
  );

create policy "Admins update submitted projects" on public.projects
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Expenses
create policy "Users manage own expenses" on public.expenses
  for all using (auth.uid() = user_id);

create policy "Admins view all expenses" on public.expenses
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Notifications
create policy "Users see own notifications" on public.notifications
  for all using (auth.uid() = user_id);

create policy "Admins insert notifications" on public.notifications
  for insert with check (true);

-- Storage bucket para tickets
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict do nothing;

create policy "Authenticated users can upload receipts" on storage.objects
  for insert with check (bucket_id = 'receipts' and auth.role() = 'authenticated');

create policy "Public can view receipts" on storage.objects
  for select using (bucket_id = 'receipts');
