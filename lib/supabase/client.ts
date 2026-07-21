"use client";

import { createBrowserClient } from "@supabase/ssr";
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
  browserClient = createBrowserClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookieOptions: persist
        ? { path: "/", sameSite: "lax", maxAge: PERSIST_MAX_AGE }
        : { path: "/", sameSite: "lax" },
      auth: {
        // PKCE, isteği başlatan tarayıcıda bir code_verifier saklar; davet
        // (admin tarafından, farklı bir tarayıcıdan gönderilir) ve şifre
        // sıfırlama (farklı cihaz/tarayıcıdan açılabilir) bağlantıları bu
        // yüzden "aynı tarayıcı" gerektirir. Ayrıca inviteUserByEmail zaten
        // PKCE desteklemez ve implicit (hash-fragment token) bağlantı
        // üretir — istemci pkce beklerken bunu tip uyuşmazlığı olarak
        // reddediyordu. implicit'e geçmek her iki e-posta bağlantısını da
        // tarayıcıdan bağımsız, kendi kendine yeten hale getiriyor.
        flowType: "implicit",
      },
    },
  );
  return browserClient;
}
