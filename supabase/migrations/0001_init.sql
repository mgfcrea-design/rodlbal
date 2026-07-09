create table productos (
  codigo text primary key,
  descripcion text not null,
  primera_vez_visto date not null default current_date,
  ultima_vez_visto date not null default current_date
);

create table cierres (
  id bigint generated always as identity primary key,
  fecha date not null unique,
  estado text not null default 'en_progreso' check (estado in ('en_progreso','finalizado')),
  n_codigos integer not null default 0,
  created_at timestamptz not null default now(),
  finalizado_at timestamptz
);

create table lecturas_stock (
  id bigint generated always as identity primary key,
  cierre_id bigint not null references cierres(id) on delete cascade,
  codigo text not null references productos(codigo),
  cantidad_total integer not null,
  cantidad_barcelona integer not null default 0,
  precio_neto numeric(10,2),
  created_at timestamptz not null default now(),
  unique (cierre_id, codigo)
);

create index idx_lecturas_codigo on lecturas_stock (codigo);
create index idx_lecturas_cierre on lecturas_stock (cierre_id);

alter table productos enable row level security;
alter table cierres enable row level security;
alter table lecturas_stock enable row level security;

create policy "authenticated_all_productos" on productos
  for all to authenticated using (true) with check (true);

create policy "authenticated_all_cierres" on cierres
  for all to authenticated using (true) with check (true);

create policy "authenticated_all_lecturas_stock" on lecturas_stock
  for all to authenticated using (true) with check (true);
