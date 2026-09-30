"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const DAY_MS = 86_400_000;
const SINGAPORE_OFFSET_MS = 8 * 60 * 60 * 1000;

export function DailyQuoteRefresh() {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const now = Date.now() + SINGAPORE_OFFSET_MS;
      const nextMidnight = (Math.floor(now / DAY_MS) + 1) * DAY_MS;
      timer = setTimeout(
        () => {
          router.refresh();
          schedule();
        },
        nextMidnight - now + 1000,
      );
    };
    schedule();
    return () => clearTimeout(timer);
  }, [router]);

  return null;
}
