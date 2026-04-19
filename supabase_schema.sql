-- ════════════════════════════════════════════════
--  Habits App — Supabase Schema
--  Ejecuta este SQL en el SQL Editor de Supabase
-- ════════════════════════════════════════════════

-- 1. Tabla de hábitos
create table if not exists habits (
  id         uuid default gen_random_uuid() primary key,
  name       text not null,
  emoji      text not null default '📌',
  created_at timestamptz default now()
);

-- 2. Tabla de registros diarios
create table if not exists logs (
  id          uuid default gen_random_uuid() primary key,
  habit_id    uuid references habits(id) on delete cascade not null,
  fecha       date not null,
  value       smallint default 0 check (value in (0, 1)),
  created_at  timestamptz default now(),
  unique (habit_id, fecha)   -- solo un log por hábito por día, permite upsert
);

-- 3. Índices para consultas rápidas
create index if not exists idx_logs_habit_id on logs(habit_id);
create index if not exists idx_logs_fecha    on logs(fecha);

-- 4. Activar Row Level Security
alter table habits enable row level security;
alter table logs    enable row level security;

-- 5. Policies — acceso público con anon key
--    (Más adelante puedes restringir con auth.uid() si añades login)
create policy "public habits" on habits
  for all using (true) with check (true);

create policy "public logs" on logs
  for all using (true) with check (true);

-- ════════════════════════════════════════════════
--  Verificación: ver tablas creadas
-- ════════════════════════════════════════════════
-- select * from habits;
-- select * from logs;
