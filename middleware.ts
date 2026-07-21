import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/env";

const MFA_CHALLENGE_PATH = "/mfa-challenge";
const ADMIN_PREFIX = "/admin";
// Kullanıcı yokken de erişilebilir olması gereken yollar. /set-password'ü
// buraya almamızın nedeni: davet/şifre sıfırlama linkiyle gelen kullanıcının
// henüz rolü/MFA durumu belirsizdir — rol/MFA kontrolünden muaf tutulur
// (bkz. aşağıdaki "isSetPassword her zaman geç" dalı).
const PRE_AUTH_PATHS = ["/sign-in", "/set-password"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser(): çerezdeki JWT'yi Supabase'e doğrulatır (sadece decode etmez)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isSignIn = path.startsWith("/sign-in");
  const isMfaChallenge = path.startsWith(MFA_CHALLENGE_PATH);
  const isSetPassword = path.startsWith("/set-password");
  const isAdminPath = path.startsWith(ADMIN_PREFIX);
  const isPreAuthPath = PRE_AUTH_PATHS.some((p) => path.startsWith(p));

  if (!user) {
    if (isPreAuthPath) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // Davet/şifre sıfırlama linkiyle yeni gelen kullanıcının henüz rolü/MFA
  // durumu yok — rol/MFA kapılarından tamamen muaf.
  if (isSetPassword) return response;

  const isSuperAdmin = user.app_metadata?.role === "super-admin";

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (isSuperAdmin) {
    // Admin için MFA KOŞULSUZ zorunlu. Supabase'in kendi `nextLevel`
    // hesaplamasına güvenilmez — sıfır faktörlü bir admin'de nextLevel hep
    // "aal1" kalır ve hiçbir zaman "aal2" olmaz, bu yüzden normal kullanıcı
    // mantığındaki `needsMfa` kontrolü admin'i asla /mfa-challenge'a
    // göndermez. Bunun yerine burada bilinçli olarak ezilir: aal2
    // sağlanana kadar (faktör olsun ya da olmasın) hiçbir /admin sayfası
    // açılmaz.
    const mfaSatisfied = aal?.currentLevel === "aal2";

    if (!mfaSatisfied) {
      if (isMfaChallenge) return response; // sayfa kendi içinde enroll/challenge karar verir
      const url = request.nextUrl.clone();
      url.pathname = MFA_CHALLENGE_PATH;
      url.search = "";
      url.searchParams.set("next", isAdminPath ? path : ADMIN_PREFIX);
      return NextResponse.redirect(url);
    }

    if (isSignIn || isMfaChallenge || !isAdminPath) {
      const url = request.nextUrl.clone();
      url.pathname = ADMIN_PREFIX;
      url.search = "";
      return NextResponse.redirect(url);
    }
    return response;
  }

  // Admin olmayan bir kullanıcı /admin altına asla giremez.
  if (isAdminPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Normal kullanıcı için mevcut opsiyonel-MFA mantığı (değişmedi):
  // Kullanıcı MFA (TOTP) kaydettiyse, oturum aal2'ye yükselene kadar
  // /mfa-challenge dışındaki hiçbir korumalı sayfaya erişim verilmez.
  // NOT: Bu kontrol yalnızca bu middleware/UI katmanında uygulanır;
  // Postgres RLS politikaları aal2 zorunluluğu içermez (bkz. plan).
  const needsMfa =
    aal?.nextLevel === "aal2" && aal.currentLevel !== aal.nextLevel;

  if (needsMfa && isSignIn) {
    const url = request.nextUrl.clone();
    const next = request.nextUrl.searchParams.get("next") || "/";
    url.pathname = MFA_CHALLENGE_PATH;
    url.search = "";
    url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }

  if (needsMfa && isMfaChallenge) {
    return response;
  }

  if (needsMfa) {
    const url = request.nextUrl.clone();
    url.pathname = MFA_CHALLENGE_PATH;
    url.search = "";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (isSignIn || isMfaChallenge) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
