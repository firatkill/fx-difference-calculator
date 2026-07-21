/** Supabase auth hata mesajlarını kullanıcıya gösterilecek Türkçeye çevirir */
export function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "E-posta veya şifre hatalı.";
  }
  if (m.includes("email not confirmed")) {
    return "E-posta adresi doğrulanmamış.";
  }
  if (
    m.includes("invalid mfa factor") ||
    m.includes("invalid factor") ||
    m.includes("factor not found")
  ) {
    return "Doğrulama başarısız. Kod hatalı olabilir.";
  }
  if (
    m.includes("invalid token") ||
    m.includes("invalid otp") ||
    m.includes("invalid totp") ||
    m.includes("token has expired") ||
    m.includes("otp expired")
  ) {
    return "Kod hatalı veya süresi dolmuş. Tekrar deneyin.";
  }
  if (m.includes("already registered") || m.includes("already in use")) {
    return "Bu e-posta adresi zaten kullanılıyor.";
  }
  if (m.includes("friendly name")) {
    return "Bu isimde bir authenticator zaten var. Farklı bir isim seçin.";
  }
  if (m.includes("too many requests") || m.includes("rate limit")) {
    return "Çok fazla deneme yapıldı. Lütfen biraz bekleyip tekrar deneyin.";
  }
  if (m.includes("network")) {
    return "Bağlantı hatası. İnternet bağlantınızı kontrol edin.";
  }
  return "İşlem başarısız oldu. Bilgilerinizi kontrol edip tekrar deneyin.";
}
