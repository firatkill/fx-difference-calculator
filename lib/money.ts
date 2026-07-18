import Big from "big.js";

/**
 * Parasal yardımcılar: big.js sarmalayıcıları + tr-TR biçimleme/ayrıştırma.
 * Tutarlar uygulama genelinde nokta ondalıklı string olarak taşınır.
 */

// Big.js yuvarlama: yarımlar yukarı (ticari yuvarlama)
Big.RM = Big.roundHalfUp;

export function big(value: string | number | Big): Big {
  return new Big(value);
}

/** 2 haneye yuvarlanmış string (USD/TL tutarları için) */
export function round2(value: Big): string {
  return value.round(2).toFixed(2);
}

const usdFmt = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const tlFmt = usdFmt;
const rateFmt = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

export function formatUsd(value: string | Big): string {
  return `${usdFmt.format(Number(big(value).toFixed(2)))} $`;
}

export function formatTl(value: string | Big): string {
  return `${tlFmt.format(Number(big(value).toFixed(2)))} ₺`;
}

export function formatRate(value: string | Big): string {
  return rateFmt.format(Number(big(value).toFixed(4)));
}

/** İşaretli kur farkı gösterimi: +5.000,00 ₺ / −1.250,00 ₺ */
export function formatTlSigned(value: string | Big): string {
  const v = big(value);
  const abs = formatTl(v.abs());
  if (v.gt(0)) return `+${abs}`;
  if (v.lt(0)) return `−${abs}`;
  return abs;
}

/**
 * Kullanıcı girişini nokta ondalıklı stringe çevirir.
 * Kabul edilenler: "1.234,56" (tr), "1234,56", "1234.56", "1234".
 * Geçersizse null döner.
 */
export function parseNumberInput(input: string): string | null {
  const s = input.trim().replace(/\s/g, "");
  if (!s) return null;

  let normalized: string;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    // Son görülen ayraç ondalıktır, diğeri binliktir
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      normalized = s.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    if ((s.match(/,/g) ?? []).length > 1) return null;
    normalized = s.replace(",", ".");
  } else if (hasDot) {
    // "1.234" veya "1.234.567" → binlik; "1234.56" → ondalık
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
      normalized = s.replace(/\./g, "");
    } else {
      if ((s.match(/\./g) ?? []).length > 1) return null;
      normalized = s;
    }
  } else {
    normalized = s;
  }

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  try {
    return new Big(normalized).toString();
  } catch {
    return null;
  }
}
