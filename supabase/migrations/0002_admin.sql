-- Döviz Kuru Farkı — admin/yönetici rolü + kullanıcı yönetimi
-- bkz. docs/plan-platform.md §10 (kapsam içine alındı)
--
-- Bu dosya da 0001_init.sql gibi Supabase Dashboard > SQL Editor'de elle
-- çalıştırılmak üzere hazırlanmıştır. Tekrar çalıştırılabilir (idempotent).

-- ── 1. Seed süper admin ─────────────────────────────────────────────────────
-- is_super_admin: gerçek GoTrue kolonu. raw_app_meta_data.role: yetki
-- kontrollerinde (middleware, Server Action'lar) kullanılan bayrak.
-- ÖNEMLİ: rol bilgisi app_metadata'da tutulur, user_metadata'da DEĞİL —
-- app_metadata yalnızca Admin API (service-role) ile yazılabilir, kullanıcı
-- kendi updateUser() çağrısıyla asla değiştiremez. user_metadata bunun
-- aksine kullanıcının kendisi tarafından yazılabilir olduğundan yetki
-- kontrolü için GÜVENSİZDİR — bu yüzden burada bilinçli olarak
-- app_metadata seçildi.
--
-- Geçici şifre yalnızca bu dosyadadır; giriş yaptıktan (ve zorunlu MFA
-- kurulumunu tamamladıktan) sonra /admin/hesabim üzerinden değiştirilebilir.

do $$
declare
  v_new_id uuid;
begin
  if not exists (select 1 from auth.users where email = 'admin@example.com') then
    v_new_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_new_id,
      'authenticated',
      'authenticated',
      'admin@example.com',
      extensions.crypt('CHANGE_ME_SEED_PASSWORD', extensions.gen_salt('bf')),
      now(), now(),
      '{"provider":"email","providers":["email"],"role":"super-admin"}',
      jsonb_build_object('name', 'Admin'),
      true,
      now(), now(),
      '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      v_new_id,
      v_new_id::text,
      jsonb_build_object('sub', v_new_id::text, 'email', 'admin@example.com'),
      'email',
      now(), now(), now()
    );
  end if;
end $$;

-- ── 2. Admin salt-okunur RLS bypass ─────────────────────────────────────────
-- Mevcut "kendi verisi" (for all, user_id = auth.uid()) politikasına
-- DOKUNULMAZ — her tabloya EK bir "for select" politikası eklenir. Postgres
-- aynı komut (SELECT) için birden fazla permissive politikayı OR ile
-- birleştirir: admin tüm satırları görebilir, ama insert/update/delete hâlâ
-- yalnızca sahibiyle sınırlı kalır (admin paneli v1 zaten salt okunur;
-- admin'in kendi yazma işlemleri — davet/sil/banla — RLS'i tamamen atlayan
-- service-role istemciyle yapılır, bkz. lib/supabase/admin.ts).

drop policy if exists "admin salt okunur" on public.customers;
create policy "admin salt okunur" on public.customers
  for select using (((auth.jwt() -> 'app_metadata' ->> 'role') = 'super-admin'));

drop policy if exists "admin salt okunur" on public.invoices;
create policy "admin salt okunur" on public.invoices
  for select using (((auth.jwt() -> 'app_metadata' ->> 'role') = 'super-admin'));

drop policy if exists "admin salt okunur" on public.payments;
create policy "admin salt okunur" on public.payments
  for select using (((auth.jwt() -> 'app_metadata' ->> 'role') = 'super-admin'));
