'use client';

import { useUser } from '@/hooks/useUser';

type Props = {
  minRang?: number;
  permission?: string;
  badgeRequis?: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
};

export function PermissionGate({ minRang, permission, fallback = null, children }: Props) {
  const { hasRang, hasPermission } = useUser();

  if (minRang && !hasRang(minRang)) return <>{fallback}</>;
  if (permission && !hasPermission(permission)) return <>{fallback}</>;

  return <>{children}</>;
}
