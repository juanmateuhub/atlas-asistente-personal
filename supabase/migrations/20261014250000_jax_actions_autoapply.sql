-- Jax applies changes immediately (user's choice) and every change can be undone.
--   undo: what is needed to revert, captured from the DB right before applying
--         (previous values for updates, the full row for deletes, the new id for creates)
--   href: where the user can see the change in the app
alter table public.jax_actions
  add column undo jsonb not null default '{}'::jsonb check (jsonb_typeof(undo) = 'object' and pg_column_size(undo) <= 600000),
  add column href text check (href is null or (href ~ '^/[A-Za-z0-9/_?=&%.-]*$' and char_length(href) <= 300));

alter table public.jax_actions drop constraint jax_actions_status_check;
alter table public.jax_actions
  add constraint jax_actions_status_check check (status in ('pending', 'applied', 'dismissed', 'failed', 'undone'));
