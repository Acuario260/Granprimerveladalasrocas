-- Ejecutar UNA VEZ en Supabase > SQL Editor. Deja el voto ligado a una cuenta real (usuario + contraseña),
-- rechaza cuentas anónimas y mantiene la regla: 1 voto por cuenta y combate.
alter table public.votes add column if not exists voter_name text;
drop function if exists public.cast_vote(text, smallint, text);
create or replace function public.cast_vote(p_fight text, p_choice smallint) returns void
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
