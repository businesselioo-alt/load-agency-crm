'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PlanningRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/marketing'); }, [router]);
  return null;
}
