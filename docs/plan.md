# Döviz Kuru Farkı Uygulaması — Geliştirme Planı

> Durum: **ONAY BEKLİYOR** — Plan tamamlandı, implementasyon onayı bekleniyor.
> Tarih: 2026-07-18

## 1. Amaç

Satıcı firmanın, dövize (USD) endeksli faturalarını müşteri bazında takip edip, müşterinin
TL veya USD olarak yaptığı ödemeleri **FIFO** mantığıyla en eski faturadan başlayarak mahsup eden
ve bu sırada oluşan **döviz kuru farkını** hesaplayıp gösteren bir web uygulaması.

**Çözülen problem:** Müşteri, kur 5 TL iken kesilen 10.000 TL'lik (2.000 USD) faturayı,
kur 10 TL olduğunda 10.000 TL (=1.000 USD) ödeyerek "kapattım" diyemesin. Borç dövizle takip
edilir: 2.000 USD borca 2.000 USD ödeme gerekir. Aradaki fark hem **kalan döviz borcu**
(1.000 USD) hem de **TL kur farkı** (kur farkı faturasına esas tutar) olarak raporlanır.

## 2. Verilen Kararlar (mülakat sonuçları)

| # | Konu | Karar |
|---|------|-------|
| 1 | Platform | Tamamen tarayıcıda (client-side), **backend yok**. Fatura verisi hiçbir sunucuya gitmez. |
| 2 | Kalıcılık | Tarayıcıda **IndexedDB** ile kayıt. Sayfa kapatılıp açıldığında çalışmaya devam edilebilir. |
| 3 | Stack | **Next.js** (static export) + TypeScript |
| 4 | Çoklu müşteri | Zip'ten birden fazla müşteri (VKN) çıkarsa **müşteri seçtirilir**; tek müşteri çıkarsa otomatik seçilir. |
| 5 | Borç tutarı | `LegalMonetaryTotal/PayableAmount` (tevkifat düşülmüş, müşterinin satıcıya fiilen ödeyeceği tutar). |
| 6 | Kur farkı gösterimi | **Satır bazında + özet**: her ödemenin kapattığı dilim için `kur farkı TL = kapatılan USD × (ödeme kuru − fatura kuru)`. Ödeme satırında detay, üstte toplam kur farkı + kalan döviz borcu. |
| 7 | Devir bakiyesi | Var. **Hem döviz hem TL+kur** olarak girilebilir (ödeme girişiyle aynı mantık). FIFO'da en başa konur. |
| 8 | Para birimi | **Sadece USD.** EUR yok. USD olmayan fatura çıkarsa hesaba katılmaz, uyarıyla ayrı listede gösterilir. |
| 9 | Ödeme girişi | Tarih (zorunlu) + tutar (TL veya USD seçmeli) + kur (her durumda zorunlu) + isteğe bağlı açıklama. Belge no otomatik (`ÖD-0001`). |
| 10 | Fazla ödeme | **Avans olarak kalır** (negatif bakiye). Sonraki tarihli faturalara otomatik mahsup edilir; mahsup anında avansın kuru ile fatura kuru karşılaştırılıp kur farkı hesaplanır. |
| 11 | İade faturası | **Kapsam dışı (MVP).** `InvoiceTypeCode = IADE` olan faturalar hesaba katılmaz, "hesaba katılmayanlar" listesinde uyarıyla gösterilir. |
| 12 | Export | **Excel (.xlsx)** — tablo + özet, ödeme satırları yeşil dolgulu. |

## 3. Varsayımlar (itiraz edilebilir)

Aşağıdakiler sorulmadan verilen makul varsayımlardır; herhangi birine itiraz edilirse plan güncellenir:

1. **Sıralama anahtarı:** Fatura düzenleme tarihi (`IssueDate`). Vade tarihi sıralamada kullanılmaz,
   sadece bilgi kolonu olarak gösterilir. Aynı tarihli belgelerde önce **faturalar** (belge no sırasıyla),
   sonra **ödemeler** (giriş sırasıyla) işlenir — yani aynı gün gelen ödeme o günün faturasını da kapatabilir.
2. **TL Tutar kolonu (fatura):** `PayableAmount × CalculationRate` olarak hesaplanır
   (faturanın not alanındaki yuvarlanmış TL değeri kullanılmaz; kuruş düzeyinde fark olabilir).
3. **Mükerrer fatura:** Aynı `UUID` ikinci kez gelirse atlanır; içe aktarma raporunda sayısı gösterilir.
4. **Kur alanı yoksa:** `PricingExchangeRate/CalculationRate` yoksa notlardaki `Döviz Kuru:x,xxxx`
   deseninden okunur; o da yoksa fatura "hesaba katılmayanlar" listesine düşer (kur farkı hesaplanamaz).
5. **Devir bakiyesi sadece borç** (pozitif) girilir. Müşterinin devir alacağı varsa en eski tarihli bir
   "ödeme" olarak girilebilir. Devir USD olarak kur girilmeden kaydedilirse, o dilime mahsup edilen
   ödemeler için kur farkı hesaplanamaz (— gösterilir); TL+kur veya USD+kur girilirse hesaplanır.
6. **Ödemeler düzenlenebilir/silinebilir.** Her değişiklikte tüm FIFO zinciri baştan, deterministik
   olarak yeniden hesaplanır (yüzlerce satır için anlıktır).
7. **Faturalar salt okunur** (zip'ten gelir), ama aynı çalışma dosyasına sonradan ek zip yüklenebilir
   (UUID ile birleştirilir).
8. **Sayı formatı:** tr-TR (`1.234,56`). USD ve TL 2 ondalık, kur 4 ondalık gösterilir. Girişlerde
   hem virgül hem nokta ondalık ayracı kabul edilir.
9. **Dil:** Arayüz Türkçe.
10. **Vergiler:** KDV/tevkifat detayı hesaplamada kullanılmaz (PayableAmount yeterli); fatura detay
    görünümünde bilgi olarak gösterilir.
11. **Zip yapısı esnek okunur:** Klasör yapısına (yıl/ay) güvenilmez; dış zip içinde **özyinelemeli**
    olarak tüm `.zip` (iç içe, max 5 seviye) ve `.xml` dosyaları taranır. `.DS_Store` vb. yok sayılır.
    (Örnek veride `2025/08/` içinde doğrudan duran bir `.xml` de var — bu da yakalanır.)
12. **Yuvarlama:** Dahili hesap `big.js` ile tam hassasiyette yapılır; USD mahsuplar kuruş (cent)
    hassasiyetinde, kur farkı TL satır bazında 2 haneye yuvarlanır; özet, yuvarlanmış satırların
    toplamıdır (satırlar ile özet daima tutarlı).

## 4. Alan Eşlemesi (UBL-TR → uygulama)

Örnek dosya: `docs/invoice_example/f516dcdd-….xml` (UBL 2.1, `TR1.2`, profil `TEMELFATURA`, tip `TEVKIFAT`)

| Uygulama alanı | XML kaynağı | Örnek değer |
|---|---|---|
| Belge no | `Invoice/cbc:ID` | `ORN2025000001638` |
| Tekil anahtar | `cbc:UUID` | `f516dcdd-…` |
| Fatura tarihi | `cbc:IssueDate` | `2025-08-01` |
| Fatura tipi | `cbc:InvoiceTypeCode` | `TEVKIFAT` (İADE ise dışlanır) |
| Para birimi | `cbc:DocumentCurrencyCode` | `USD` (değilse dışlanır) |
| Kur | `cac:PricingExchangeRate/cbc:CalculationRate` (yoksa Note `Döviz Kuru:…`) | `40.6467` |
| Döviz tutar (borç) | `cac:LegalMonetaryTotal/cbc:PayableAmount` | `569.78` |
| KDV dahil toplam (bilgi) | `…/cbc:TaxInclusiveAmount` | `621.58` |
| Vade tarihi (bilgi) | Note içinde `Vade Tarihi : GG.AA.YYYY` | `29.11.2025` |
| Müşteri VKN/TCKN | `cac:AccountingCustomerParty//cac:PartyIdentification/cbc:ID` | `3333333333` |
| Müşteri unvanı | `cac:AccountingCustomerParty//cac:PartyName/cbc:Name` | `ÖRNEK MÜŞTERİ …` |
| Satıcı unvanı | `cac:AccountingSupplierParty//cac:PartyName/cbc:Name` | `ÖRNEK TEDARİKÇİ …` |

Parse notları:
- XML'ler ~300KB (içinde dijital imza + base64 ek var); `fast-xml-parser` + `removeNSPrefix: true`
  ile parse edilir (tarayıcı ve Node testlerinde aynı kod çalışır, DOM bağımlılığı yok).
- `schemeID` VKN veya TCKN olabilir; ikisi de kabul edilir.

## 5. Veri Modeli

```ts
// Tüm tutarlar big.js ile tam hassasiyette işlenir, string olarak saklanır
interface Invoice {
  uuid: string;              // birincil anahtar (mükerrer kontrolü)
  workspaceId: string;
  docNo: string;             // ORN2025000001638
  issueDate: string;         // ISO 'YYYY-MM-DD'
  dueDate?: string;
  currency: string;          // 'USD' değilse excluded
  rate?: string;             // faturadaki kur (4 hane) — yoksa excluded
  amountFx: string;          // PayableAmount (USD)
  taxInclusiveFx?: string;   // bilgi amaçlı
  supplierName?: string;
  customerVkn: string;
  customerName: string;
  invoiceType: string;       // SATIS | TEVKIFAT | IADE | ...
  excluded?: { reason: 'NON_USD' | 'IADE' | 'NO_RATE' | 'PARSE_ERROR'; detail?: string };
  sourcePath: string;        // zip içindeki yol (izlenebilirlik)
}

interface Payment {
  id: string;                // ulid
  workspaceId: string;
  docNo: string;             // ÖD-0001 (otomatik sıra)
  date: string;              // ISO
  seq: number;               // aynı tarihli ödemelerin giriş sırası
  entryMode: 'TL' | 'USD';   // kullanıcı hangi cinsten girdi
  amountTl?: string;         // TL girildiyse girilen tutar
  amountFx: string;          // USD karşılığı (TL girildiyse amountTl / rate)
  rate: string;              // ödeme günü kuru (zorunlu)
  note?: string;
}

interface OpeningBalance {   // workspace başına 0 veya 1 adet
  date: string;              // FIFO'da her şeyden önce
  entryMode: 'TL' | 'USD';
  amountFx: string;
  rate?: string;             // opsiyonel; yoksa bu dilimde kur farkı hesaplanmaz
}

interface Workspace {
  id: string;
  customerVkn: string;
  customerName: string;
  supplierName?: string;
  openingBalance?: OpeningBalance;
  paymentCounter: number;    // ÖD-#### üretimi
  createdAt: number;
  updatedAt: number;
}
```

**IndexedDB (Dexie) şeması:** `workspaces`, `invoices (uuid, workspaceId)`, `payments (id, workspaceId)`.
Hesaplama sonuçları **saklanmaz**; her açılışta/değişiklikte motor yeniden hesaplar (tek doğruluk kaynağı).

## 6. FIFO + Kur Farkı Motoru

Saf fonksiyon: `compute(opening, invoices[], payments[]) → { rows[], allocations[], summary }`
(UI'dan ve testlerden bağımsız, `lib/engine/fifo.ts`)

### Algoritma

```
olaylar = [devir (varsa), USD faturalar, ödemeler]
         tarihe göre sırala; aynı tarihte: devir < fatura(belge no) < ödeme(seq)

açıkFaturalar = kuyruk (FIFO)   // her eleman: {ref, kalanUSD, kur?}
avanslar      = kuyruk (FIFO)   // her eleman: {ref, kalanUSD, kur}

her olay için:
  FATURA/DEVİR → açıkFaturalar.push(olay)
                 sonra: avanslar boşalana ya da fatura kapanana dek en eski avansı mahsup et
  ÖDEME        → kalan = ödeme.USD
                 açıkFaturalar'dan en eskiden başlayarak mahsup et
                 artan kaldıysa avanslar.push(artan, ödeme.kuru)

mahsup(fatura, ödeme, x USD):
  allocations += { fatura, ödeme, x,
                   kurFarkıTL: (fatura.kur ve ödeme.kuru varsa) x × (ödeme.kuru − fatura.kuru) }
```

- Kur farkı **pozitif** ise satıcı lehine (kur yükselmiş; kur farkı faturasına esas tutar),
  negatifse müşteri lehine. İkisi de gösterilir.
- `summary`: toplam fatura USD, toplam ödeme USD, kalan bakiye USD (negatif = avans),
  toplam kur farkı TL, dışlanan belge sayıları.

### Doğrulama örneği (kullanıcının senaryosu)

| Olay | Tutar | Kur | Sonuç |
|---|---|---|---|
| Fatura F-1 | 2.000 USD (10.000 TL) | 5,0000 | açık: 2.000 USD |
| Ödeme ÖD-1: 10.000 TL | → 1.000 USD | 10,0000 | F-1'den 1.000 USD mahsup |

→ Kalan bakiye: **1.000 USD** · Kur farkı: `1.000 × (10 − 5) = `**`5.000 TL`** ✓

### Kenar durumlar (motor testlerine girecek)

- Ödeme birden çok faturaya taşar (90k + 10k örneği)
- Ödeme açık borçtan büyük → avans; sonra gelen fatura avansı otomatik tüketir
- Avans + yeni fatura kur farkı: `x × (avans kuru − fatura kuru)`
- Devir bakiyesi kursuz → mahsupta kur farkı `—`, özete katılmaz
- Aynı gün fatura + ödeme sıralaması
- Kuruş yuvarlama: 3 ödemenin tek faturayı tam kapatması (cent artığı kalmamalı)
- Sıfır/negatif girişler reddedilir (form validasyonu + motor guard)

## 7. Zip İşleme Hattı

```
Dış .zip  ──fflate (async)──▶ girdiler
   ├─ *.zip  → özyinele (max derinlik 5)
   ├─ *.xml  → UBL parse dene
   └─ diğer  → yok say (.DS_Store, klasör kayıtları…)

XML → fast-xml-parser → alan eşlemesi → Invoice
   ├─ UUID mükerrer → atla (say)
   ├─ USD değil / İADE / kur yok / parse hatası → excluded olarak işaretle
   └─ geçerli → listeye ekle

Sonuç → İçe Aktarma Raporu modalı:
  "37 zip tarandı · 25 fatura okundu · 2 mükerrer atlandı · 1 hesaba katılmadı (TRY) · 0 hata"
Sonra → müşteri (VKN) grupları listelenir → seçilen müşteriyle workspace açılır/birleştirilir
```

- Büyük zip'lerde ilerleme çubuğu (n/toplam); parse ana thread'i kilitlememek için parça parça (yield) yapılır.
- Test fikstürü: `docs/invoice_zip_example/` klasöründen dış zip üretilir (`scripts/make-fixture.mjs`)
  ve gerçek 25 faturayla uçtan uca test edilir.

## 8. Arayüz

### Ekran akışı

```
[Ana sayfa]                          [Çalışma ekranı /workspace/:id]
┌──────────────────────────┐         ┌─────────────────────────────────────────────┐
│ Döviz Kuru Farkı         │         │ ÖRNEK MÜŞTERİ… (VKN 3333333333)   [Excel ⬇] │
│                          │         │ ┌─────────┬─────────┬─────────┬───────────┐ │
│ [Zip yükle / sürükle]    │   ──▶   │ │Fatura   │Ödeme    │Kalan    │Kur Farkı  │ │
│                          │         │ │148.259$ │100.000$ │48.259$  │+312.450 ₺ │ │
│ Son çalışmalar:          │         │ └─────────┴─────────┴─────────┴───────────┘ │
│ · ÖRNEK MÜŞTERİ (25 f.) │         │ [+ Ödeme ekle] [Devir bakiyesi] [+ Zip ekle] │
│ · …                      │         │ ┌──────────────────────── tablo ──────────┐ │
└──────────────────────────┘         │ │ …                                       │ │
                                     │ └─────────────────────────────────────────┘ │
                                     └─────────────────────────────────────────────┘
```

### Ana tablo kolonları

| Kolon | Fatura satırı | Ödeme satırı (yeşil arka plan) |
|---|---|---|
| Tarih | fatura tarihi | ödeme tarihi |
| Belge No | `ORN2025…` | `ÖD-0001` |
| Vade | vade tarihi | — |
| Kur | faturadaki kur | ödeme kuru |
| TL Tutar | USD × kur | ödenen TL |
| Döviz Tutar (USD) | PayableAmount | USD karşılığı |
| Ödenen (USD) | bu faturaya mahsup edilen toplam | — |
| Kalan (USD) | faturanın kalan açığı | — |
| Kur Farkı (TL) | — | bu ödemenin ürettiği toplam kur farkı |
| Bakiye (USD) | satır sonrası genel bakiye (yürüyen) | satır sonrası genel bakiye |

- Sıralama: tarih artan (en eski üstte). Devir satırı en üstte, gri/mavi tonda.
- **Satır genişletme:** ödeme satırına tıklayınca mahsup detayı açılır:
  hangi faturadan ne kadar kapatıldı, dilim dilim kur farkı. Fatura satırında: hangi ödemelerle
  kapatıldı + KDV/tevkifat bilgisi.
- Tam kapanan faturalar soluk gösterilir; kısmi kapananlar "Kalan" kolonunda vurgulanır.
- "Hesaba katılmayanlar" (TRY/İADE/kursuz/hatalı) ayrı katlanabilir bölümde, sebep rozetiyle.
- Ödeme satırında düzenle/sil aksiyonları; devir bakiyesi düzenlenebilir.

### Ödeme formu

- Tarih (takvim, varsayılan bugün) · Cins seçimi (TL / USD) · Tutar · Kur (4 hane) · Açıklama
- TL modunda canlı önizleme: `250.000,00 TL ÷ 41,6440 = 6.003,26 USD`
- USD modunda: `6.003,26 USD × 41,6440 = 250.000,00 TL`

## 9. Excel Export (exceljs)

- Sayfa 1 "Cari Hesap": başlıkta müşteri unvanı/VKN/satıcı/rapor tarihi; ana tablo ile aynı kolonlar;
  ödeme satırları yeşil dolgu, devir gri; altta özet bloğu (toplamlar + kalan bakiye + toplam kur farkı).
- Sayfa 2 "Mahsup Detayı": her mahsup dilimi (ödeme → fatura, USD, iki kur, kur farkı TL) — kur farkı
  faturasının dayanağı olarak muhasebeciye verilebilir.
- Dosya adı: `kur-farki_ORNEK-MUSTERI_2026-07-18.xlsx`
- Sayılar Excel'e **sayı** olarak yazılır (metin değil), biçim Excel sayı formatıyla verilir.

## 10. Teknik Mimari

| Katman | Seçim | Neden |
|---|---|---|
| Framework | Next.js 15 (App Router, `output: 'export'`) | Karar #3; statik çıktı → her yerde barınır, sunucu yok |
| Dil | TypeScript (strict) | |
| UI | Tailwind CSS v4 | hızlı, bağımlılık az |
| Zip | `fflate` | küçük, hızlı, async API |
| XML | `fast-xml-parser` (`removeNSPrefix`) | tarayıcı+Node'da aynı kod, DOM'suz test |
| Ondalık | `big.js` | kayan nokta hatasız para hesabı |
| Kalıcılık | `dexie` (+ `dexie-react-hooks`) | IndexedDB'nin sağlam sarmalayıcısı |
| State | zustand | hafif; workspace/tablo durumu |
| Excel | `exceljs` | MIT lisans, hücre stili (yeşil satır) destekler |
| Test | vitest | motor + parser birim testleri, fikstürle uçtan uca parse testi |

### Proje yapısı

```
app/
  layout.tsx, page.tsx            # ana sayfa: yükleme + son çalışmalar
  workspace/[id]/page.tsx         # çalışma ekranı (client component)
components/
  UploadDropzone.tsx  ImportReport.tsx  CustomerPicker.tsx
  LedgerTable.tsx  LedgerRow.tsx  AllocationDetail.tsx
  PaymentForm.tsx  OpeningBalanceForm.tsx  SummaryBar.tsx  ExcludedList.tsx
lib/
  zip/extract.ts                  # dış zip → xml blob'ları (özyinelemeli)
  parser/ubl.ts                   # xml → Invoice (alan eşlemesi, hata toleransı)
  engine/fifo.ts                  # saf hesap motoru (compute)
  excel/export.ts
  db/schema.ts, db/repo.ts        # dexie
  money.ts                        # Big yardımcıları + tr-TR format/parse
scripts/
  make-fixture.mjs                # docs/invoice_zip_example → test dış zip'i
tests/
  parser.test.ts  fifo.test.ts  extract.test.ts  e2e-fixture.test.ts
docs/
  plan.md (bu dosya)
```

## 11. Geliştirme Fazları

Her faz sonunda çalışır durum + commit:

- [ ] **Faz 0 — İskelet:** Next.js + TS + Tailwind + vitest kurulumu, static export ayarı, boş sayfalar. `npm run dev` ve `npm test` çalışır.
- [ ] **Faz 1 — Parser + Zip:** `lib/zip/extract.ts`, `lib/parser/ubl.ts`, fikstür scripti; 25 gerçek faturayla testler (alan eşlemesi tablodaki örnek değerleri birebir çıkarmalı).
- [ ] **Faz 2 — FIFO motoru:** `lib/engine/fifo.ts` + bölüm 6'daki tüm kenar durum testleri. (UI'sız, saf fonksiyon.)
- [ ] **Faz 3 — Ana akış UI:** yükleme → içe aktarma raporu → müşteri seçimi → tablo (kolonlar, renkler, yürüyen bakiye, satır genişletme) → özet paneli.
- [ ] **Faz 4 — Ödeme & devir:** ödeme formu (TL/USD, canlı önizleme), devir bakiyesi formu, düzenle/sil, anlık yeniden hesap.
- [ ] **Faz 5 — Kalıcılık:** Dexie şeması, workspace kaydet/aç/birleştir (ek zip), ana sayfada son çalışmalar.
- [ ] **Faz 6 — Excel export:** iki sayfalı çıktı, stiller, sayı formatları.
- [ ] **Faz 7 — Cila & doğrulama:** hesaba katılmayanlar bölümü, boş/hata durumları, gerçek fikstürle uçtan uca manuel doğrulama (özet rakamları elle hesaplanıp karşılaştırılır), README.

## 12. Kapsam Dışı (bilinçli)

- EUR veya başka döviz (yalnız USD)
- İade faturası mahsubu (MVP sonrası)
- Dönem sonu değerleme raporu
- Backend, kullanıcı hesabı, çoklu cihaz senkronu
- Kur farkı **faturası düzenleme** (sadece tutarı raporlarız)
- TCMB kurlarını otomatik çekme (kurlar hep belgeden/kullanıcıdan gelir)
