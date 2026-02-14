import { useEffect, useMemo, useState } from "react";

interface TimerProps {
  phaseEndsAt: number | null;
}

export const Timer = ({ phaseEndsAt }: TimerProps) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!phaseEndsAt) {
      return;
    }

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 100);

    return () => clearInterval(interval);
  }, [phaseEndsAt]);

  const remainingMs = useMemo(() => {
    if (!phaseEndsAt) {
      return 0;
    }
    return Math.max(0, phaseEndsAt - now);
  }, [now, phaseEndsAt]);

  const remainingSeconds = (remainingMs / 1000).toFixed(1);

  return <span className="timer">{remainingSeconds}s</span>;
};
