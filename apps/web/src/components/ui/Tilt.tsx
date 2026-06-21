'use client';
import { useRef, type CSSProperties, type ReactNode } from 'react';

type Props = { children: ReactNode; max?: number; style?: CSSProperties };

export function Tilt({ children, max = 7, style }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${-py * max}deg) rotateY(${px * max}deg)`;
  };

  const reset = () => {
    if (ref.current) {
      ref.current.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg)';
    }
  };

  return (
    <div
      ref={ref}
      onPointerMove={move}
      onPointerLeave={reset}
      style={{ transition: 'transform 0.25s ease-out', transformStyle: 'preserve-3d', ...style }}
    >
      {children}
    </div>
  );
}
