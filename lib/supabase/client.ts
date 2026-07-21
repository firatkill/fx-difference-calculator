"use client";

import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/env";

/**
 * Tarayıcı Supabase istemcisi (tek örnek — modül başına bir tane, aksi halde
 * her çağrı ayrı bir GoTrue oturum dinleyicisi oluşturur). Oturum çerezi
 * olarak tutulur (middleware'in okuyabilmesi için); "beni hatırla" tercihine
 * göre ilk oluşturulduğunda çerez ömrü ayarlanır: işaretliyse kalıcı (400 gün,
 * Supabase varsayımı), değilse oturum çerezi (tarayıcı kapanınca silinir).
 */

const REMEMBER_KEY = "dviz-remember-me";
const PERSIST_MAX_AGE = 60 * 60 * 24 * 400;

function shouldPersist(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(REMEMBER_KEY) !== "0";
}

/** Sign-in ekranındaki "Beni hatırla" seçimini sonraki çerezler için kaydeder */
export function setRememberMe(remember: boolean): void {
  window.localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
}

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (browserClient) return browserClient;
  const persist = shouldPersist();
  // NOT: @supabase/ssr'nin createBrowserClient'ı auth.flowType'ı burada ne
  // verilirse verilsin dahili olarak "pkce" ile EZER (bkz.
  // node_modules/@supabase/ssr/dist/module/createBrowserClient.js) — bu
  // yüzden davet/şifre sıfırlama bağlantılarının implicit (hash-fragment)
  // token'larını bu istemciyle otomatik algılatmak mümkün değil. Bu
  // istemci normal parola ile girişte ve oturumun çerezde tutulmasında
  // kullanılmaya devam ediyor; imzalı bağlantıların işlenmesi
  // components/SetPasswordScreen.tsx'te elle (setSession ile) yapılıyor.
  browserClient = createBrowserClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookieOptions: persist
        ? { path: "/", sameSite: "lax", maxAge: PERSIST_MAX_AGE }
        : { path: "/", sameSite: "lax" },
    },
  );
  return browserClient;
}

/**
 * Yalnızca resetPasswordForEmail çağrısı için: @supabase/ssr'nin tarayıcı
 * istemcisi flowType'ı her zaman "pkce" yapar (yukarıdaki not), bu da
 * bağlantıyı isteği başlatan tarayıcıya kilitler. Bu tek seferlik, çerezsiz
 * istemci flowType'ı gerçekten "implicit" yapabildiğinden GoTrue davet
 * bağlantısıyla aynı, kendi kendine yeten hash-fragment token'ı üretir.
 */
export function createPasswordResetRequestClient() {
  return createSupabaseClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    auth: {
      flowType: "implicit",
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
