import { useEffect, useMemo, useState } from "react";

const formatSegment = (value: number) => value.toString().padStart(2, "0");

export const useCountdown = (target: bigint | null) => {
  const [remaining, setRemaining] = useState<number>(() => {
    if (!target) return 0;
    const millis = Number(target) * 1000 - Date.now();
    return Math.max(millis, 0);
  });

  useEffect(() => {
    if (!target) {
      setRemaining(0);
      return;
    }

    const interval = setInterval(() => {
      const millis = Number(target) * 1000 - Date.now();
      setRemaining(Math.max(millis, 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [target]);

  const breakdown = useMemo(() => {
    const seconds = Math.floor(remaining / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return {
      totalMilliseconds: remaining,
      days,
      hours,
      minutes,
      seconds: secs,
      label: `${days > 0 ? `${days}d ` : ""}${formatSegment(
        hours
      )}:${formatSegment(minutes)}:${formatSegment(secs)}`,
    };
  }, [remaining]);

  return breakdown;
};

