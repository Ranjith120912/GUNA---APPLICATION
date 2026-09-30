'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, UserRole } from '@/lib/auth';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
}

export function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const router = useRouter();
  const currentUser = getCurrentUser();

  useEffect(() => {
    if (!currentUser) {
      router.replace('/');
      return;
    }

    if (requiredRole && currentUser.role !== requiredRole) {
      router.replace(currentUser.role === 'admin' ? '/admin' : '/dashboard');
    }
  }, [currentUser, requiredRole, router]);

  if (!currentUser) return null;
  if (requiredRole && currentUser.role !== requiredRole) return null;

  return <>{children}</>;
}
