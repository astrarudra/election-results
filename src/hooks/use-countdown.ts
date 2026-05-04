import { useEffect, useState } from "react";

export function useCountdown(lastUpdatedAt: number, refreshMs: number) {
  const [remainingMs, setRemainingMs] = useState(refreshMs);

  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - lastUpdatedAt;
      setRemainingMs(Math.max(refreshMs - elapsed, 0));
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [lastUpdatedAt, refreshMs]);

  return Math.ceil(remainingMs / 1000);
}
