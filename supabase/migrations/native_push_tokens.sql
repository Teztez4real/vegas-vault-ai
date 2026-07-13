-- Native iOS/Android push tokens (APNs/FCM device tokens), separate from
-- push_subscriptions (which stores browser Web Push subscriptions and does
-- not apply inside the native app's WebView).
create table if not exists native_push_tokens (
  device_token text primary key,
  platform text not null default 'ios',
  user_id uuid,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table native_push_tokens enable row level security;
-- No public policy: only the service role (server-side) reads/writes this
-- table, same pattern as push_subscriptions/live_push_state.
