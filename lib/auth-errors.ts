/** Supabase auth hata mesajlarını kullanıcıya gösterilecek Türkçeye çevirir */
export function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "E-posta veya şifre hatalı.";
  }
  if (m.includes("email not confirmed")) {
    return "E-posta adresi doğrulanmamış.";
  }
  if (m.includes("too many requests") || m.includes("rate limit")) {
    return "Çok fazla deneme yapıldı. Lütfen biraz bekleyip tekrar deneyin.";
  }
  if (m.includes("network")) {
    return "Bağlantı hatası. İnternet bağlantınızı kontrol edin.";
  }
  return "Giriş yapılamadı. Bilgilerinizi kontrol edip tekrar deneyin.";
}
