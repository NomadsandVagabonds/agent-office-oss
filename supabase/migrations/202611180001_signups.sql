-- Who has signed up, for the owner only. These views live in a schema of their own, `owner`, which the
-- database's web API does not serve (supabase/config.toml exposes `public` and `graphql_public` only), and
-- nobody but the database owner may read them: no browser key, signed in or not, can reach them.
-- Read them in the Supabase dashboard's SQL editor, e.g.
--   select * from owner.signups order by signed_up desc;
--   select * from owner.signups_by_day;
create schema if not exists owner;
revoke all on schema owner from public, anon, authenticated;

create or replace view owner.signups as
  select u.id,
         u.email,
         coalesce(u.raw_app_meta_data->>'provider', 'email') as provider,
         u.created_at as signed_up,
         u.last_sign_in_at as last_signed_in,
         p.user_id is not null as has_saved,
         p.updated_at as last_saved
    from auth.users u
    left join public.blockrooms_profiles p on p.user_id = u.id
   where not coalesce(u.is_anonymous, false);

create or replace view owner.signups_by_day as
  select date_trunc('day', signed_up)::date as day,
         count(*) as signed_up,
         count(*) filter (where provider = 'google') as with_google,
         count(*) filter (where provider <> 'google') as with_email_code,
         count(*) filter (where has_saved) as saved_a_visit
    from owner.signups
   group by 1
   order by 1 desc;

revoke all on owner.signups, owner.signups_by_day from public, anon, authenticated;
