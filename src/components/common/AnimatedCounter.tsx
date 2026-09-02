import React, { useEffect, useState, useRef } from 'react';

interface AnimatedCounterProps {
  value: number;
  duration?: number; // duration in ms
  formatter?: (val: number) => string;
  className?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 800,
  formatter,
  className = '',
}) => {
  const [displayValue, setDisplayValue] = useState<number>(value);
  const prevValueRef = useRef<number>(value);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startValue = prevValueRef.current;
    const endValue = value;

    if (startValue === endValue) {
      setDisplayValue(endValue);
      return;
    }

    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // easeOutExpo function
      const easeOut = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.round(startValue + (endValue - startValue) * easeOut);
      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(step);
      } else {
        prevValueRef.current = endValue;
      }
    };

    animationFrameId = window.requestAnimationFrame(step);

    return () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
      prevValueRef.current = endValue;
    };
  }, [value, duration]);

  const output = formatter ? formatter(displayValue) : displayValue.toString();

  return <span className={className}>{output}</span>;
};
