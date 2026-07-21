# Çok Kullanıcılı Platform Dönüşümü — Geliştirme Planı

> Durum: **ONAY BEKLİYOR** — Plan tamamlandı, implementasyon onayı bekleniyor.
> Bu doküman, [docs/plan.md](plan.md)'de tamamlanan yerel/tek-kullanıcılı MVP'yi
> authentication + merkezi veritabanı olan çok kullanıcılı bir platforma dönüştürür.
> Mevcut hesap motoru, parser ve UI bileşenlerinin büyük kısmı **aynen korunur**;
> değişen katman veri saklama ve erişim kontrolüdür.

## 1. Amaç

Uygulama artık tek kişinin tarayıcısında değil, birden fazla kullanıcının
(muhasebeci/temsilci) giriş yaparak **kendi müşterilerinin cari hesap
defterlerini** tuttuğu, verilerin merkezi bir veritabanında saklandığı bir
platforma dönüşüyor.

**Önceki mimari kararının bilinçli tersine çevrilmesi:** `docs/plan.md`
bölüm 2'deki "backend yok, veri tarayıcıdan çıkmaz" kararı, çok kullanıcılı
kalıcılık ihtiyacı nedeniyle bu fazda kaldırılıyor. Veri artık Supabase
(Postgres) üzerinde saklanacak.

## 2. Verilen Kararlar (mülakat sonuçları)

| # | Konu | Karar |
|---|------|-------|
| 1 | Stack | **Supabase** (Auth + Postgres + Row Level Security) |
| 2 | Barındırma | **Vercel** (uygulama) + **hosted Supabase** (veritabanı/auth). Kullanıcı `NEXT_PUBLIC_SUPABASE_URL`, publishable (anon) key ve secret (service role) key'i env değişkeni olarak ekleyecek. |
| 3 | Zip işleme | **İstemci ayrıştırır** (mevcut `lib/zip`, `lib/parser` kodu aynen kalır), sonucu Supabase'e gönderir. |
| 4 | Veri izolasyonu | Her kullanıcı **yalnızca kendi müşterilerini** görür/düzenler (RLS ile zorunlu kılınır). Admin rolü / paylaşımlı havuz yok. |
| 5 | Şifre yönetimi | Admin (seed script), sabit geçici şifreyle 3 kullanıcı oluşturur. Kullanıcılar giriş yaptıktan sonra şifrelerini değiştirebilir. Zorunlu ilk değişiklik veya e-posta ile şifre sıfırlama **bu fazda yok**. |
| 6 | Seed kullanıcılar | Placeholder bilgilerle (bölüm 8) 3 kullanıcı; gerçek bilgiler sonradan güncellenebilir. |
| 7 | Eski veri | Tarayıcı içi (IndexedDB/Dexie) veriler taşınmaz, göz ardı edilir. Dexie tamamen kaldırılır. |
| 8 | Oturum/güvenlik | Temel e-posta+şifre girişi + "beni hatırla" (kalıcı/oturumluk oturum seçimi) + basit istemci taraflı brute-force yavaşlatması. |
| 9 | Signup | **Yok.** Yalnızca sign-in sayfası var; kullanıcı oluşturma sadece seed script/admin API ile yapılır. |

## 3. Varsayımlar (itiraz edilebilir)

1. **Tek Supabase projesi:** Geliştirme ve prod için ayrı Supabase projesi
   açılmaz; kullanıcının sağlayacağı tek proje hem yerel geliştirmede hem
   Vercel'de kullanılır. (Ayrı dev/staging projesi istenirse sonradan eklenir.)
2. **Yazma yolu:** Özel bir Next.js API katmanı **kurulmaz**; tarayıcı,
   `@supabase/supabase-js` istemcisiyle doğrudan Postgres'e yazar/okur.
   Güvenlik RLS politikalarıyla sağlanır. İstisna: ödeme belge numarasının
   (`ÖD-0001`) yarış durumu olmadan atanması için tek bir Postgres fonksiyonu
   (RPC) kullanılır — bu da normal kullanıcı yetkisiyle (RLS'e tabi) çalışır,
   `SECURITY DEFINER` kullanılmaz.
3. **Fatura mükerrer kontrolü:** `upsert(..., { onConflict: 'uuid', ignoreDuplicates: true })`
   ile yapılır; hangi satırların gerçekten eklendiği dönen sonuçtan sayılır
   (mevcut `alreadyExistingCount` mantığının Supabase karşılığı).
4. **Route yapısı temizliği:** Static export (`output: 'export'`) artık
   gerekmediğinden `/workspace?id=...` query-param workaround'u kaldırılır;
   düzgün dinamik route'a geçilir: `/customers/[id]`.
5. **Realtime yok:** Çoklu sekme/cihaz arası anlık senkronizasyon (Supabase
   Realtime) bu fazda kurulmaz; her mutasyondan sonra normal yeniden sorgu
   (refetch) yeterli kabul edilir.
6. **Manuel müşteri oluşturma yok:** Müşteriler yalnızca zip içe aktarımıyla
   oluşturulur (mevcut davranış). Zip'siz "yeni müşteri ekle" formu kapsam
   dışıdır (istenirse kolay eklenir).
7. **"Beni hatırla":** İşaretlenirse Supabase oturumu `localStorage`'da (varsayılan,
   tarayıcı kapansa da kalıcı), işaretlenmezse `sessionStorage`'da tutulur
   (tarayıcı kapanınca oturum sona erer).
8. **Rate limiting:** Sunucu tarafında Supabase'in kendi auth koruması
   (varsayılan) yeterli kabul edilir; buna ek olarak istemci tarafında basit
   bir sayaç ile art arda 5 başarısız denemeden sonra kısa süreli (ör. 30 sn)
   giriş düğmesi kilitlenir. Gerçek bir güvenlik katmanı değildir, kullanıcı
   deneyimi için basit bir sürtünmedir.
9. **E-posta doğrulama:** Seed kullanıcılar admin API ile `email_confirm: true`
   olarak oluşturulur (e-posta doğrulama adımı olmadan direkt giriş yapabilirler).
10. **Para birimi/hesap motoru:** `lib/engine/fifo.ts`, `lib/parser/ubl.ts`,
    `lib/zip/extract.ts`, `lib/money.ts`, `lib/dates.ts`, `lib/excel/export.ts`
    **değişmeden** korunur — bunlar saf fonksiyonlardır, veri kaynağından
    bağımsızdır. Sadece veri okuma/yazma katmanı (`lib/db/*`) değişir.

## 4. Mimari Genel Bakış

```
Tarayıcı (Next.js client component)
   ├─ zip yükle → lib/zip + lib/parser (DEĞİŞMEDİ) → ParsedInvoice[]
   ├─ supabase-js (anon key + kullanıcı oturumu, RLS uygular)
   │     ├─ customers  (upsert: user_id + customer_vkn)
   │     ├─ invoices   (upsert: uuid, ignoreDuplicates)
   │     └─ payments   (RPC: add_payment → atomik ÖD-#### numarası)
   └─ lib/engine/fifo.ts (DEĞİŞMEDİ) → ekranda hesapla/göster

Next.js Middleware (@supabase/ssr)
   └─ her istekte oturum çerezini yeniler; oturum yoksa /sign-in'e yönlendirir

Supabase (hosted)
   ├─ Auth (e-posta+şifre, signup kapalı, sadece admin API ile kullanıcı)
   └─ Postgres: customers / invoices / payments (RLS: user_id = auth.uid())

Vercel
   └─ Next.js'i server modunda barındırır (artık static export değil)
```

## 5. Veri Modeli (Postgres)

```sql
-- customers (önceki "Workspace")
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_vkn text not null,
  customer_name text not null,
  supplier_name text,
  opening_balance jsonb,           -- {date, entryMode, amountFx, amountTl?, rate?} | null
  payment_counter integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, customer_vkn)
);

-- invoices (fatura UUID'si birincil anahtar; aynı müşteride mükerrer önlenir)
create table public.invoices (
  uuid uuid primary key,
  customer_id uuid not null references public.customers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  doc_no text not null,
  issue_date date not null,
  due_date date,
  currency text not null,
  rate numeric(18,6),
  amount_fx numeric(18,2) not null,
  tax_inclusive_fx numeric(18,2),
  supplier_name text,
  customer_vkn text not null,
  customer_name text not null,
  invoice_type text not null,
  excluded_reason text,            -- NON_USD | IADE | NO_RATE | PARSE_ERROR | null
  excluded_detail text,
  source_path text not null,
  created_at timestamptz not null default now()
);

-- payments
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  doc_no text not null,
  date date not null,
  seq integer not null,
  entry_mode text not null,        -- TL | USD
  amount_tl numeric(18,2),
  amount_fx numeric(18,2) not null,
  rate numeric(18,6) not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customers enable row level security;
alter table public.invoices  enable row level security;
alter table public.payments  enable row level security;

create policy "kendi verisi" on public.customers
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "kendi verisi" on public.invoices
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "kendi verisi" on public.payments
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Ödeme belge no'sunu yarış durumu olmadan atayan fonksiyon (RLS'e tabi, security definer DEĞİL)
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
```

`lib/types.ts` içindeki `Invoice`/`Payment`/`OpeningBalance`/`Workspace`
tipleri bu şemaya birebir karşılık gelecek şekilde güncellenir (`Workspace` →
`Customer` adlandırması ve `userId` alanı eklenir).

## 6. Auth Akışı

- **`/sign-in`** — tek genel erişilebilir sayfa. E-posta + şifre formu,
  `supabase.auth.signInWithPassword`. Başarısız denemede Supabase'in
  döndürdüğü hata Türkçeleştirilip gösterilir. 5 başarısız denemeden sonra
  düğme 30 sn kilitlenir (istemci taraflı sayaç, `localStorage`).
- **"Beni hatırla" checkbox'ı** — işaretliyse `localStorage`, değilse
  `sessionStorage` kullanan bir Supabase istemcisi oluşturulur.
- **Middleware (`middleware.ts`)** — `@supabase/ssr` ile her istekte session
  çerezi yenilenir; `/sign-in` dışındaki tüm route'larda oturum yoksa
  `/sign-in`'e yönlendirilir. Oturumu olan kullanıcı `/sign-in`'e giderse
  ana sayfaya yönlendirilir.
- **Çıkış yap** — header'da düğme, `supabase.auth.signOut()`.
- **`/hesabim`** — şifre değiştirme formu (`supabase.auth.updateUser({ password })`).
  Zorunlu değildir, isteğe bağlı erişilir.
- **Seed kullanıcılar** — `supabase/migrations/0001_init.sql` içinde, doğrudan
  `auth.users`/`auth.identities` tablolarına `INSERT` ile (Supabase SQL
  Editor'de superuser bağlamında çalıştırılır). 3 placeholder kullanıcı,
  sabit geçici şifreyle:

  | E-posta (placeholder) | Ad | Geçici şifre |
  |---|---|---|
  | muhasebeci1@firma.com | Muhasebeci 1 | `CHANGE_ME_SEED_PASSWORD` |
  | muhasebeci2@firma.com | Muhasebeci 2 | `CHANGE_ME_SEED_PASSWORD` |
  | muhasebeci3@firma.com | Muhasebeci 3 | `CHANGE_ME_SEED_PASSWORD` |

  Blok idempotent'tir (`where not exists`); gerçek e-posta/isim/şifre bilgisi
  geldiğinde migration dosyasındaki liste güncellenip tekrar çalıştırılabilir.

## 7. Kod Tabanında Değişiklikler

| Durum | Dosya/Alan |
|---|---|
| **Aynen kalır** | `lib/engine/fifo.ts`, `lib/parser/ubl.ts`, `lib/zip/extract.ts`, `lib/money.ts`, `lib/dates.ts`, `lib/excel/export.ts`, `lib/import.ts` (küçük tip değişikliği hariç), tüm `components/*` (veri kaynağı prop'larla aynı şekilde beslenir), `tests/parser.test.ts`, `tests/fifo.test.ts`, `tests/extract.test.ts`, `tests/e2e-fixture.test.ts` |
| **Kaldırılır** | `lib/db/schema.ts`, `lib/db/repo.ts` (Dexie), `dexie` + `dexie-react-hooks` + `zustand` bağımlılıkları |
| **Yeni** | `lib/supabase/client.ts` (tarayıcı istemcisi, remember-me destekli), `lib/supabase/server.ts` (middleware/server component istemcisi), `lib/supabase/repo.ts` (Dexie repo'nun Supabase karşılığı: `importIntoWorkspace`→`importIntoCustomer`, `addPayment`, `updatePayment`, `deletePayment`, `setOpeningBalance`, `deleteWorkspace`→`deleteCustomer`, `listWorkspaces`→`listCustomers`), `middleware.ts`, `app/sign-in/page.tsx`, `app/hesabim/page.tsx`, `supabase/migrations/0001_init.sql` (bölüm 5'teki DDL + RLS + RPC + seed kullanıcılar) |
| **Taşınır/yeniden adlandırılır** | `app/workspace/page.tsx` (`?id=` query param) → `app/customers/[id]/page.tsx` (dinamik route, `Suspense` workaround'u kaldırılır) |
| **Güncellenir** | `lib/types.ts` (`Workspace`→`Customer` + `userId` alanı), `next.config.ts` (`output: 'export'` satırı kaldırılır), `app/layout.tsx` (header'a çıkış yap eklenir), `.env.local.example` (yeni) |

## 8. Ortam Değişkenleri

Kullanıcının `.env` dosyasında gerçek değerlerle hazır (Supabase'in yeni
anahtar isimlendirmesi — `ANON_KEY`/`SERVICE_ROLE_KEY` değil):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...   # publishable key, tarayıcıya gider
SUPABASE_SECRET_KEY=...                    # yalnızca seed script'te kullanılır, ASLA client'a gitmez
```

`.env` zaten `.gitignore`'da (`.env*`). Bu değerler yerel `.env` dosyasından
okunur; Vercel'e deploy edilirken `NEXT_PUBLIC_SUPABASE_URL` ve
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` proje ayarlarına eklenir.
`SUPABASE_SECRET_KEY` Vercel'e **eklenmez** (sadece yerel seed script için
gereklidir).

## 9. Geliştirme Fazları

- [ ] **Faz 1 — Supabase şeması + proje bağlantısı:** `supabase/migrations/0001_init.sql`
  (bölüm 5), `.env.local.example`, `@supabase/supabase-js` + `@supabase/ssr`
  kurulumu, `lib/supabase/client.ts` / `server.ts`. Supabase dashboard'da
  migration'ın elle çalıştırılması (kullanıcı tarafından, SQL editor'de).
- [ ] **Faz 2 — Auth:** `middleware.ts`, `/sign-in`, çıkış yap, "beni hatırla",
  basit rate-limit sayaç, `/hesabim` şifre değiştirme.
- [ ] **Faz 3 — Next.js server moduna geçiş + route temizliği:** `next.config.ts`
  düzenlemesi, `/workspace?id=` → `/customers/[id]`, Dexie/zustand kaldırma.
- [ ] **Faz 4 — Supabase repo katmanı + müşteri listesi/zip içe aktarma:**
  `lib/supabase/repo.ts`, ana sayfa (müşterilerim) ve içe aktarma akışının
  yeni repo'ya bağlanması.
- [ ] **Faz 5 — Ödeme/devir formlarının Supabase'e bağlanması:** `add_payment`
  RPC entegrasyonu, düzenle/sil, devir bakiyesi CRUD.
- [ ] **Faz 6 — Uçtan uca doğrulama + Vercel deploy:** seed kullanıcılarla
  gerçek Supabase projesinde giriş → zip yükle → ödeme → çıkış → tekrar giriş
  → verinin kalıcı olduğu, farklı kullanıcının bu veriyi göremediği doğrulanır.
  Vercel'e deploy, env değişkenlerinin doğrulanması.

## 10. Kapsam Dışı (bilinçli)

- Kullanıcı kayıt (signup) sayfası
- ~~Şifremi unuttum / e-posta ile sıfırlama akışı~~ → **kapsam içine alındı**, /sign-in + /set-password ortak akışıyla eklendi
- ~~Admin/yönetici rolü, kullanıcı yönetim paneli~~ → **kapsam içine alındı**, app_metadata.role tabanlı /admin paneli olarak eklendi
- Paylaşımlı müşteri havuzu
- Supabase Realtime ile çoklu sekme senkronizasyonu
- IndexedDB'den Supabase'e veri taşıma aracı
- Ayrı dev/staging Supabase projesi
- ~~İki faktörlü kimlik doğrulama (2FA)~~ → **kapsam içine alındı**, TOTP MFA olarak eklendi (hesabım + girişte zorunlu kılma)
- ~~Zip'siz manuel müşteri oluşturma formu~~ → **kapsam içine alındı**, "Yeni Müşteri" formuyla eklendi (bkz. layout/dashboard yeniden tasarımı)
