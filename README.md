# Döviz Kuru Farkı

e-Fatura zip dosyalarından müşteri cari hesabını çıkarıp, ödemeleri **FIFO**
mantığıyla en eski faturadan mahsup eden ve oluşan **döviz kuru farkını**
hesaplayan çok kullanıcılı web uygulaması.

Zip açma ve XML okuma tarayıcıda yapılır; ayrıştırılmış fatura verisi
**Supabase** (Postgres + Auth) üzerinde, giriş yapan kullanıcıya özel olarak
saklanır (Row Level Security ile her kullanıcı yalnızca kendi müşterilerini
görür). Kayıt (signup) yok — kullanıcılar önceden oluşturulmuş hesaplarla
giriş yapar.

## Problem

Müşteri, kur 5 TL iken kesilen 10.000 TL'lik (2.000 USD) faturayı, kur 10 TL
olduğunda 10.000 TL (=1.000 USD) ödeyerek "kapattım" diyemesin. Borç dövizle
izlenir; kalan 1.000 USD ve kur farkı `1.000 × (10 − 5) = 5.000 TL` raporlanır
(kur farkı faturasına esas tutar).

## Kullanım

1. `/sign-in` üzerinden e-posta + şifre ile giriş yapın.
2. GİB/entegratörden indirilen **tek zip** dosyasını ana sayfaya bırakın
   (içinde yıl/ay klasörleri ve fatura zip'leri olabilir; iç içe zip'ler
   otomatik açılır).
3. İçe aktarma raporunu ve müşteriyi onaylayın.
4. Gerekirse **devir bakiyesi** girin (USD veya TL+kur).
5. **Ödeme ekle** ile müşterinin ödemelerini girin (TL+kur veya USD+kur).
6. Tablo; fatura/ödeme satırlarını, her faturanın ödenen/kalan kısmını,
   ödeme başına kur farkını ve yürüyen bakiyeyi gösterir. Satıra tıklayınca
   mahsup dökümü açılır.
7. **Excel ⬇** ile iki sayfalı rapor indirin (Cari Hesap + Mahsup Detayı).

## Hesap kuralları (özet)

- Borç tutarı: faturanın `PayableAmount` alanı (tevkifat düşülmüş). Kur:
  `PricingExchangeRate/CalculationRate` (yoksa nottaki `Döviz Kuru:`).
- Yalnızca **USD** faturalar hesaba girer; TRY/İADE/kursuz belgeler
  "hesaba katılmayanlar" bölümünde listelenir.
- FIFO: ödemeler tarih sırasıyla en eski açık faturaya mahsup edilir. Aynı gün:
  önce faturalar, sonra ödemeler.
- Dilim kur farkı: `kapatılan USD × (ödeme kuru − fatura kuru)`.
- Fazla ödeme avans olur, sonraki faturaları otomatik kapatır.
- Mükerrer faturalar (aynı UUID) bir kez sayılır.

Hesap motoru ayrıntıları: [docs/plan.md](docs/plan.md) ·
Platform/auth mimarisi: [docs/plan-platform.md](docs/plan-platform.md)

## Kurulum (yerel geliştirme)

1. Bağımlılıkları kurun: `npm install`
2. `.env` dosyasına Supabase proje bilgilerinizi girin (`.env.example`'a bakın):
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
   SUPABASE_SECRET_KEY=...   # yalnızca migration/seed için, tarayıcıya gitmez
   ```
3. `supabase/migrations/0001_init.sql` dosyasının tamamını Supabase
   Dashboard → SQL Editor'e yapıştırıp çalıştırın. Bu migration:
   - `customers` / `invoices` / `payments` tablolarını, RLS politikalarını ve
     `add_payment` fonksiyonunu oluşturur,
   - 3 placeholder kullanıcı oluşturur (aşağıya bakın).
   - Tekrar çalıştırmak güvenlidir (idempotent).
4. `npm run dev` → http://localhost:3000 → `/sign-in`'e yönlendirilir.

### Seed kullanıcılar (placeholder — gerçek bilgilerle güncellenebilir)

| E-posta | Geçici şifre |
|---|---|
| muhasebeci1@firma.com | `CHANGE_ME_SEED_PASSWORD` |
| muhasebeci2@firma.com | `CHANGE_ME_SEED_PASSWORD` |
| muhasebeci3@firma.com | `CHANGE_ME_SEED_PASSWORD` |

Giriş yaptıktan sonra **Hesabım** sayfasından şifre değiştirilebilir.

## Geliştirme komutları

```bash
npm run dev            # http://localhost:3000
npm test               # motor + parser birim testleri (vitest)
npm run build          # production build
npm run make-fixture   # docs örneklerinden test zip'i üret
```

## Deploy (Vercel)

1. Depoyu Vercel'e bağlayın.
2. Proje ayarlarına `NEXT_PUBLIC_SUPABASE_URL` ve
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` değişkenlerini ekleyin.
   `SUPABASE_SECRET_KEY`'i Vercel'e **eklemeyin** (yalnızca yerel migration/seed
   için gereklidir).
3. Deploy edin — middleware oturum kontrolünü otomatik uygular.

## Teknolojiler

Next.js 15 (App Router, server modu) · TypeScript · Tailwind CSS v4 ·
Supabase (Auth + Postgres + RLS, `@supabase/ssr`) · fflate · fast-xml-parser ·
big.js · exceljs · vitest
