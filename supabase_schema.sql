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

-- ════════════════════════════════════════════════
--  Gym Tracker — Supabase Schema
-- ════════════════════════════════════════════════

-- 6. Tabla de rutinas (splits)
create table if not exists gym_routines (
  id          uuid default gen_random_uuid() primary key,
  name        text not null,
  days_count  smallint not null check (days_count >= 1 and days_count <= 7),
  created_at  timestamptz default now()
);

-- 7. Tabla de los días de la rutina (textos/ejercicios)
create table if not exists gym_days (
  id          uuid default gen_random_uuid() primary key,
  routine_id  uuid references gym_routines(id) on delete cascade not null,
  day_index   smallint not null,
  title       text default '',
  content     text default '',
  created_at  timestamptz default now(),
  unique (routine_id, day_index)
);

-- 8. Tabla de registros semanales por día de la rutina
create table if not exists gym_logs (
  id          uuid default gen_random_uuid() primary key,
  routine_id  uuid references gym_routines(id) on delete cascade not null,
  day_index   smallint not null,
  week_id     text not null, -- e.g. "2026-W18" or the date of Monday
  status      smallint default 0 check (status in (0, 1)),
  created_at  timestamptz default now(),
  unique (routine_id, day_index, week_id)
);

-- 9. Índices para consultas rápidas
create index if not exists idx_gym_days_routine on gym_days(routine_id);
create index if not exists idx_gym_logs_routine on gym_logs(routine_id);
create index if not exists idx_gym_logs_week    on gym_logs(week_id);

-- 10. Activar Row Level Security
alter table gym_routines enable row level security;
alter table gym_days     enable row level security;
alter table gym_logs     enable row level security;

-- 11. Policies — acceso público con anon key
create policy "public gym_routines" on gym_routines for all using (true) with check (true);
create policy "public gym_days"     on gym_days     for all using (true) with check (true);
create policy "public gym_logs"     on gym_logs     for all using (true) with check (true);

-- 12. Tabla de ejercicios por día
create table if not exists gym_exercises (
  id          uuid default gen_random_uuid() primary key,
  day_id      uuid references gym_days(id) on delete cascade not null,
  name        text not null default '',
  sets        text not null default '',
  weight      text not null default '',
  link        text not null default '',
  order_index smallint not null default 0,
  created_at  timestamptz default now()
);

-- 13. Índices para ejercicios
create index if not exists idx_gym_exercises_day on gym_exercises(day_id);

-- 14. Activar Row Level Security en ejercicios
alter table gym_exercises enable row level security;
create policy "public gym_exercises" on gym_exercises for all using (true) with check (true);
