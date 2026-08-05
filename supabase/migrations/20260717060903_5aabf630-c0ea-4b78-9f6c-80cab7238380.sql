create table if not exists public.export_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  outcome text not null check (outcome in ('success','failure','canceled')),
  path text check (path in ('demux-decode','realtime-playback','mediarecorder-fallback')),
  browser text,
  resolution text not null,
  codec text not null,
  profile text,
  level text,
  bitrate integer not null,
  fps_target integer not null,
  encode_time_ms integer not null,
  frames_encoded integer,
  effective_fps numeric(10,2),
  realtime_multiplier numeric(10,3),
  source_duration_sec numeric(10,3),
  source_width integer,
  source_height integer,
  output_bytes bigint,
  error_category text check (error_category in ('codec','decode','quota','network','abort','unknown')),
  error_message text
);

create index if not exists export_metrics_created_at_idx on public.export_metrics (created_at desc);
create index if not exists export_metrics_user_idx on public.export_metrics (user_id, created_at desc);
create index if not exists export_metrics_regression_idx on public.export_metrics (browser, codec, resolution, created_at desc);

grant select on public.export_metrics to authenticated;
grant insert on public.export_metrics to authenticated;
grant all on public.export_metrics to service_role;

alter table public.export_metrics enable row level security;

create policy "export_metrics select own"
  on public.export_metrics for select to authenticated
  using (auth.uid() = user_id);

create policy "export_metrics select admin"
  on public.export_metrics for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "export_metrics insert own"
  on public.export_metrics for insert to authenticated
  with check (auth.uid() = user_id);