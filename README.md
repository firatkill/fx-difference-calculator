# Döviz Kuru Farkı

e-Fatura zip dosyalarından müşteri cari hesabını çıkarıp, ödemeleri **FIFO**
mantığıyla en eski faturadan mahsup eden ve oluşan **döviz kuru farkını**
hesaplayan web uygulaması.

Tamamen tarayıcıda çalışır: zip açma, XML okuma ve tüm hesaplar istemci
tarafındadır; fatura verisi hiçbir sunucuya gönderilmez. Çalışmalar tarayıcının
kendi deposunda (IndexedDB) saklanır.

## Problem

Müşteri, kur 5 TL iken kesilen 10.000 TL'lik (2.000 USD) faturayı, kur 10 TL
olduğunda 10.000 TL (=1.000 USD) ödeyerek "kapattım" diyemesin. Borç dövizle
izlenir; kalan 1.000 USD ve kur farkı `1.000 × (10 − 5) = 5.000 TL` raporlanır
(kur farkı faturasına esas tutar).

## Kullanım

1. GİB/entegratörden indirilen **tek zip** dosyasını ana sayfaya bırakın
   (içinde yıl/ay klasörleri ve fatura zip'leri olabilir; iç içe zip'ler
   otomatik açılır).
2. İçe aktarma raporunu ve müşteriyi onaylayın.
3. Gerekirse **devir bakiyesi** girin (USD veya TL+kur).
4. **Ödeme ekle** ile müşterinin ödemelerini girin (TL+kur veya USD+kur).
5. Tablo; fatura/ödeme satırlarını, her faturanın ödenen/kalan kısmını,
   ödeme başına kur farkını ve yürüyen bakiyeyi gösterir. Satıra tıklayınca
   mahsup dökümü açılır.
6. **Excel ⬇** ile iki sayfalı rapor indirin (Cari Hesap + Mahsup Detayı).

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

Ayrıntılar: [docs/plan.md](docs/plan.md)

## Geliştirme

```bash
npm install
npm run dev            # http://localhost:3000
npm test               # birim + uçtan uca testler (vitest)
npm run build          # statik çıktı (out/)
npm run make-fixture   # docs örneklerinden test zip'i üret
```

Statik çıktı (`out/`) herhangi bir statik dosya sunucusunda barındırılabilir.

## Teknolojiler

Next.js 15 (static export) · TypeScript · Tailwind CSS v4 · fflate ·
fast-xml-parser · big.js · Dexie (IndexedDB) · exceljs · vitest
