-- Döviz Kuru Farkı — çok kullanıcılı platform şeması
-- bkz. docs/plan-platform.md bölüm 5-6
--
-- Bu dosya Supabase Dashboard > SQL Editor'de (postgres/superuser bağlamında)
-- elle çalıştırılmak üzere hazırlanmıştır. Tekrar çalıştırılabilir (idempotent):
-- tablo/politika/fonksiyon oluşturmalar "if not exists" / "or replace" ile,
-- seed kullanıcılar "where not exists" kontrolüyle korunur.

-- Seed kullanıcı şifrelerini hash'lemek için (Supabase projelerinde genelde
-- zaten etkindir; idempotent).
create extension if not exists pgcrypto with schema extensions;

-- ── 1. Tablolar ────────────────────────────────────────────────────────────

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_vkn text not null,
  customer_name text not null,
  supplier_name text,
  opening_balance jsonb,
  payment_counter integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, customer_vkn)
);

create table if not exists public.invoices (
  uuid uuid primary key,
  customer_id uuid not null references public.customers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  doc_no text not null,
  issue_date date not null,
  due_date date,
  currency text not null,
  rate numeric(18, 6),
  amount_fx numeric(18, 2) not null,
  tax_inclusive_fx numeric(18, 2),
  supplier_name text,
  customer_vkn text not null,
  customer_name text not null,
  invoice_type text not null,
  excluded_reason text,
  excluded_detail text,
  source_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists invoices_customer_id_idx on public.invoices (customer_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  doc_no text not null,
  date date not null,
  seq integer not null,
  entry_mode text not null check (entry_mode in ('TL', 'USD')),
  amount_tl numeric(18, 2),
  amount_fx numeric(18, 2) not null,
  rate numeric(18, 6) not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_customer_id_idx on public.payments (customer_id);

-- ── 2. Row Level Security ───────────────────────────────────────────────────

alter table public.customers enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;

drop policy if exists "kendi verisi" on public.customers;
create policy "kendi verisi" on public.customers
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "kendi verisi" on public.invoices;
create policy "kendi verisi" on public.invoices
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "kendi verisi" on public.payments;
create policy "kendi verisi" on public.payments
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── 3. Ödeme belge no'sunu yarış durumu olmadan atayan fonksiyon ───────────
-- SECURITY DEFINER DEĞİL: çağıran kullanıcının RLS'i geçerli kalır
-- (customers satırına erişemiyorsa update 0 satır döner, fonksiyon hata verir).

create or replace function public.add_payment(
  p_customer_id uuid,
  p_date date,
  p_entry_mode text,
  p_amount_tl numeric,
  p_amount_fx numeric,
  p_rate numeric,
  p_note text
) returns public.payments
language plpgsql
as $$
declare
  v_counter int;
  v_result public.payments;
begin
  update public.customers
     set payment_counter = payment_counter + 1,
         updated_at = now()
   where id = p_customer_id
   returning payment_counter into v_counter;

  if v_counter is null then
    raise exception 'Müşteri bulunamadı veya erişim yok';
  end if;

  insert into public.payments (
    customer_id, user_id, doc_no, date, seq,
    entry_mode, amount_tl, amount_fx, rate, note
  ) values (
    p_customer_id, auth.uid(), 'ÖD-' || lpad(v_counter::text, 4, '0'), p_date, v_counter,
    p_entry_mode, p_amount_tl, p_amount_fx, p_rate, p_note
  ) returning * into v_result;

  return v_result;
end;
$$;

-- ── 4. Seed kullanıcılar (placeholder — bkz. docs/plan-platform.md bölüm 6) ─
-- Geçici şifreler yalnızca bu dosyadadır; kullanıcılar giriş yaptıktan sonra
-- /hesabim üzerinden değiştirebilir. Gerçek e-posta/isim bilgisi geldiğinde
-- bu blok güncellenip tekrar çalıştırılabilir (var olan kullanıcı atlanır).

do $$
declare
  v_users jsonb := '[
    {"email": "muhasebeci1@firma.com", "name": "Muhasebeci 1", "password": "CHANGE_ME_SEED_PASSWORD"},
    {"email": "muhasebeci2@firma.com", "name": "Muhasebeci 2", "password": "CHANGE_ME_SEED_PASSWORD"},
    {"email": "muhasebeci3@firma.com", "name": "Muhasebeci 3", "password": "CHANGE_ME_SEED_PASSWORD"}
  ]';
  v_user jsonb;
  v_new_id uuid;
begin
  for v_user in select * from jsonb_array_elements(v_users)
  loop
    if not exists (select 1 from auth.users where email = v_user->>'email') then
      v_new_id := gen_random_uuid();

      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, last_sign_in_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at,
        confirmation_token, email_change, email_change_token_new, recovery_token
      ) values (
        '00000000-0000-0000-0000-000000000000',
        v_new_id,
        'authenticated',
        'authenticated',
        v_user->>'email',
        extensions.crypt(v_user->>'password', extensions.gen_salt('bf')),
        now(), now(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('name', v_user->>'name'),
        now(), now(),
        '', '', '', ''
      );

      insert into auth.identities (
        id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(),
        v_new_id,
        v_new_id::text,
        jsonb_build_object('sub', v_new_id::text, 'email', v_user->>'email'),
        'email',
        now(), now(), now()
      );
    end if;
  end loop;
end $$;
