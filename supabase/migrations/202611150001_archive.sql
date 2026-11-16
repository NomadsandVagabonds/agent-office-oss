-- Private saves only. Public scores/guestbook remain in Cloudflare D1.
create table public.blockrooms_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  document jsonb not null default '{"v":1}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint bounded_archive check (jsonb_typeof(document) = 'object' and document->>'v' = '1' and octet_length(document::text) <= 262144)
);
alter table public.blockrooms_profiles enable row level security;
revoke all on public.blockrooms_profiles from anon, authenticated;
grant select on public.blockrooms_profiles to authenticated;
create policy own_archive on public.blockrooms_profiles for select to authenticated using ((select auth.uid()) = user_id);

-- The caller cannot choose a user_id. The row lock / revision check prevents
-- a stale tab or device from silently replacing a newer save.
create function public.blockrooms_save_profile(expected_revision bigint, payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); saved public.blockrooms_profiles; accepted boolean;
begin
  if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'Sign in to save' using errcode = '42501';
  end if;
  if expected_revision is null or expected_revision < 0 or payload is null or
     jsonb_typeof(payload) <> 'object' or payload->>'v' is distinct from '1' or octet_length(payload::text) > 262144 then
    raise exception 'Invalid archive' using errcode = '22023';
  end if;
  insert into public.blockrooms_profiles(user_id) values (uid) on conflict do nothing;
  select * into saved from public.blockrooms_profiles where user_id = uid for update;
  accepted := saved.revision = expected_revision;
  if accepted then
    update public.blockrooms_profiles set document = payload, revision = revision + 1, updated_at = now()
      where user_id = uid returning * into saved;
  end if;
  return jsonb_build_object('accepted', accepted, 'revision', saved.revision, 'document', saved.document);
end;
$$;
revoke all on function public.blockrooms_save_profile(bigint, jsonb) from public, anon;
grant execute on function public.blockrooms_save_profile(bigint, jsonb) to authenticated;
