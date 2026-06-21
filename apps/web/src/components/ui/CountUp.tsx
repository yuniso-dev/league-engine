'use client';
import { useState, useEffect } from 'react';

type Props = { end: number; suffix?: string; dur?: number };

export function CountUp({ end, suffix = '', dur = 1000 }: Props) {
  const [v, setV] = useState(0);

  useEffect(() => {
    let raf: number;
    let start: number | undefined;

    const step = (t: number) => {
      if (!start) start = t;
      const p = Math.min((t - start) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setV(end * e);
      if (p < 1) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [end, dur]);

  return <>{Math.round(v)}{suffix}</>;
}
