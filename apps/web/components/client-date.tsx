'use client';

import { useEffect, useState } from 'react';

export function ClientDate({ fallback = '...' }: { fallback?: string }) {
  const [year, setYear] = useState<number | null>(null);

  useEffect(() => {
    setYear(new Date().getFullYear());
  }, []);

  if (year === null) return <>{fallback}</>;
  return <>{year}</>;
}
