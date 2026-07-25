import type { ReactNode } from 'react';
import { useAuth } from '@/features/auth/auth-context';

export function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const { user } = useAuth();

  if (!user?.permissions.includes(permission)) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        You do not have permission to view this page.
      </div>
    );
  }

  return <>{children}</>;
}
