-- Deleting an account was impossible for anyone who had ever accepted terms.
--
-- legal_acceptances cascaded from auth.users, but the table also refuses every
-- delete so the consent record cannot be rewritten. The cascade therefore hit
-- the immutability trigger and aborted the whole deletion, which meant no user
-- could be removed once they had signed up - test accounts and genuine erasure
-- requests alike.
--
-- Keep the record, drop the link: erasing an account now nulls user_id and
-- leaves the acceptance itself byte-for-byte as written. Nothing else about a
-- row may ever change, and rows still cannot be deleted.

alter table public.legal_acceptances
  alter column user_id drop not null;

alter table public.legal_acceptances
  drop constraint if exists legal_acceptances_user_id_fkey;

alter table public.legal_acceptances
  add constraint legal_acceptances_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

create or replace function public.prevent_legal_acceptance_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'legal_acceptances rows are immutable once written';
  end if;

  -- The single permitted mutation: severing the subject link when the account
  -- is erased. Every other column must be identical to what was written.
  if old.user_id is not null
     and new.user_id is null
     and new.id is not distinct from old.id
     and new.legal_document_id is not distinct from old.legal_document_id
     and new.legal_document_version_id is not distinct from old.legal_document_version_id
     and new.store_id is not distinct from old.store_id
     and new.accepted_at is not distinct from old.accepted_at
     and new.acceptance_surface is not distinct from old.acceptance_surface
     and new.ip_hash is not distinct from old.ip_hash
     and new.user_agent is not distinct from old.user_agent
     and new.metadata_json is not distinct from old.metadata_json
     and new.created_at is not distinct from old.created_at
  then
    return new;
  end if;

  raise exception 'legal_acceptances rows are immutable once written';
end;
$$;
