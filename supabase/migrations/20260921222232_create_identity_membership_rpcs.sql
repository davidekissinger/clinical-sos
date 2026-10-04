-- Recovered from applied Supabase migration history on 2026-10-04.
begin;

-- A self-service Auth deletion cascades auth.users -> profiles. Memberships
-- belong to that user and their normalized facility/engagement scope already
-- cascades from the membership, so retaining a restrictive profile FK would
-- make the documented account-deletion flow impossible.
alter table public.client_memberships
  drop constraint client_memberships_client_user_id_fkey;

alter table public.client_memberships
  add constraint client_memberships_client_user_id_fkey
  foreign key (client_user_id)
  references public.profiles (id)
  on update cascade
  on delete cascade;

commit;

