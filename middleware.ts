import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/env";

const PUBLIC_PATHS = ["/sign-in"];
const MFA_CHALLENGE_PATH = "/mfa-challenge";

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

  const isSignIn = request.nextUrl.pathname.startsWith("/sign-in");
  const isMfaChallenge = request.nextUrl.pathname.startsWith(
    MFA_CHALLENGE_PATH,
  );
  const isPublicPath = PUBLIC_PATHS.some((p) =>
    request.nextUrl.pathname.startsWith(p),
  );

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (!user) {
    return response;
  }

  // Kullanıcı MFA (TOTP) kaydettiyse, oturum aal2'ye yükselene kadar
  // /mfa-challenge dışındaki hiçbir korumalı sayfaya erişim verilmez.
  // NOT: Bu kontrol yalnızca bu middleware/UI katmanında uygulanır;
  // Postgres RLS politikaları aal2 zorunluluğu içermez (bkz. plan).
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
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
