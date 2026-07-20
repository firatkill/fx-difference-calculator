"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/env";

/**
 * Tarayıcı Supabase istemcisi. Oturum çerezi olarak tutulur (middleware'in
 * okuyabilmesi için); "beni hatırla" tercihine göre çerez ömrü ayarlanır:
 * işaretliyse kalıcı (400 gün, Supabase varsayımı), değilse oturum çerezi
 * (tarayıcı kapanınca silinir).
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

export function createClient() {
  const persist = shouldPersist();
  return createBrowserClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookieOptions: persist
      ? { path: "/", sameSite: "lax", maxAge: PERSIST_MAX_AGE }
      : { path: "/", sameSite: "lax" },
  });
}
