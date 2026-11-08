-- ================= PRIMERA GRAN VELADA · VOTACIONES (Supabase > SQL Editor > Run) =================
create table public.fights(
  id text primary key,
  opens_at timestamptz not null default '2026-11-08 14:30:00+00',  -- 9:30 a. m. Perú
  voting_open boolean not null default true);
insert into public.fights(id) values ('round1'),('round2'),('round3'),('exhibicion'),('sorpresa');

create table public.fight_totals(               -- totales públicos (todos empiezan en 0)
  fight_id text primary key references public.fights(id),
  votes_a integer not null default 0 check (votes_a >= 0),
  votes_b integer not null default 0 check (votes_b >= 0));
insert into public.fight_totals(fight_id) select id from public.fights;

create table public.votes(
  id bigint generated always as identity primary key,
  fight_id text not null references public.fights(id),
  user_id uuid not null references auth.users(id),
  choice smallint not null check (choice in (1,2)),
  created_at timestamptz not null default now(),
  constraint un_voto_por_usuario_y_combate unique (fight_id, user_id));   -- REGLA PRINCIPAL

-- Los votos son permanentes: nadie (ni la web ni la API) puede modificarlos o borrarlos
create function public.votes_inmutables() returns trigger language plpgsql as
$$ begin raise exception 'VOTES_ARE_PERMANENT'; end $$;
create trigger no_update_delete before update or delete on public.votes
  for each row execute function public.votes_inmutables();
create trigger no_truncate before truncate on public.votes
  for each statement execute function public.votes_inmutables();

-- Cada voto nuevo suma a los totales
create function public.sumar_total() returns trigger language plpgsql security definer set search_path = '' as
$$ begin
  update public.fight_totals set votes_a = votes_a + (new.choice = 1)::int, votes_b = votes_b + (new.choice = 2)::int
  where fight_id = new.fight_id;
  return new; end $$;
create trigger votes_suman after insert on public.votes for each row execute function public.sumar_total();

-- Seguridad: la web solo LEE. Escribir votos únicamente con cast_vote()
alter table public.fights enable row level security;
alter table public.fight_totals enable row level security;
alter table public.votes enable row level security;
create policy "ver combates" on public.fights for select using (true);
create policy "ver totales"  on public.fight_totals for select using (true);
create policy "ver mis votos" on public.votes for select to authenticated using (user_id = auth.uid());
revoke all on public.fights, public.fight_totals, public.votes from anon, authenticated;
grant select on public.fights, public.fight_totals to anon, authenticated;
grant select on public.votes to authenticated;

-- Validación en el servidor
create function public.cast_vote(p_fight text, p_choice smallint) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); f public.fights;
begin
  if uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then raise exception 'LOGIN_REQUIRED'; end if;
  if p_choice not in (1,2) then raise exception 'INVALID_CHOICE'; end if;
  select * into f from public.fights where id = p_fight;
  if not found then raise exception 'FIGHT_NOT_FOUND'; end if;
  if not f.voting_open or now() < f.opens_at then raise exception 'VOTING_CLOSED'; end if;
  if exists (select 1 from public.votes where fight_id = p_fight and user_id = uid) then raise exception 'ALREADY_VOTED'; end if;
  begin
    insert into public.votes(fight_id, user_id, choice) values (p_fight, uid, p_choice);
  exception when unique_violation then raise exception 'ALREADY_VOTED';
  end;
end $$;
revoke all on function public.cast_vote(text, smallint) from public, anon;
grant execute on function public.cast_vote(text, smallint) to authenticated;

-- Tiempo real para todos los visitantes
alter publication supabase_realtime add table public.fight_totals;
-- Para probar antes de la hora:  update public.fights set opens_at = now();
