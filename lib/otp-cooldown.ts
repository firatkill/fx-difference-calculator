"use client";

import { useEffect, useRef, useState } from "react";

const COOLDOWN_SECONDS = 60;

/**
 * Basit, bileşen ömürlü geri sayım — OTP yeniden gönderme kısıtlaması için.
 * lib/login-throttle.ts'ten kasıtlı olarak ayrı: o sign-in'e özgü,
 * cezalandırıcı ve localStorage tabanlı bir kilit; bu ise sadece
 * "N saniye sonra tekrar gönderebilirsin" bilgisi, kalıcı olmasına gerek yok.
 */
export function useOtpCooldown() {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function start() {
    setSeconds(COOLDOWN_SECONDS);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1 && intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        return Math.max(0, s - 1);
      });
    }, 1000);
  }

  return { seconds, start };
}
