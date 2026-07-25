import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { fetchRoles, updateRolePermissions } from '@/features/admin/api';
import type { RoleInfo } from '@/features/admin/types';
import { PageHeader, btnPrimary } from '@/components/ui';

function RoleCard({ role, catalog }: { role: RoleInfo; catalog: string[] }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set(role.permissions));
  const [dirty, setDirty] = useState(false);

  const mutation = useMutation({
    mutationFn: () => updateRolePermissions(role.id, [...selected]),
    onSuccess: () => {
      setDirty(false);
      void queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  });

  const locked = role.name === 'super-admin';

  const toggle = (permission: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(permission)) {
        next.delete(permission);
      } else {
        next.add(permission);
      }
      return next;
    });
    setDirty(true);
  };

  return (
    <section className="card-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/60 pb-4 mb-4">
        <div>
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <span>{role.name}</span>
            <span className="text-[10px] font-bold lowercase tracking-wider bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200/50 dark:border-slate-700/50 text-slate-500 dark:text-slate-400">
              {role.userCount} users
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{role.description}</p>
        </div>
        {locked ? (
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/40 px-2.5 py-1 rounded-lg">
            Always holds all privileges
          </span>
        ) : (
          <button
            type="button"
            disabled={!dirty || mutation.isPending}
            onClick={() => mutation.mutate()}
            className={btnPrimary}
          >
            {mutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {catalog.map((permission) => {
          const isChecked = locked || selected.has(permission);
          return (
            <label
              key={permission}
              className={`flex items-center gap-2.5 text-xs rounded-xl border p-2.5 cursor-pointer select-none transition-all duration-150 ${
                isChecked
                  ? 'border-blue-200 dark:border-blue-900 bg-blue-50/20 dark:bg-blue-950/10 text-slate-900 dark:text-slate-200'
                  : 'border-slate-100 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-900/10 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/20'
              } ${locked ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              <input
                type="checkbox"
                disabled={locked}
                checked={isChecked}
                onChange={() => toggle(permission)}
                className="h-4 w-4 rounded-lg border-slate-300 dark:border-slate-800 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
              />
              <code className="text-[11px] font-mono font-semibold">{permission}</code>
            </label>
          );
        })}
      </div>

      {mutation.isError && (
        <p role="alert" className="mt-3 text-xs font-semibold text-rose-650 dark:text-rose-450">
          ⚠️{' '}
          {isAxiosError(mutation.error) &&
          typeof mutation.error.response?.data?.message === 'string'
            ? (mutation.error.response.data.message as string)
            : 'Failed to save permissions.'}
        </p>
      )}
    </section>
  );
}

export function RolesPage() {
  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: fetchRoles });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Privileges"
        description="Configure the permission matrix. Access privileges apply to affected users on their next session request."
      />

      <div className="space-y-4">
        {rolesQuery.isLoading && (
          <p className="text-xs text-slate-400 italic">Loading permissions matrix…</p>
        )}
        {rolesQuery.data?.roles.map((role) => (
          <RoleCard key={role.id} role={role} catalog={rolesQuery.data.catalog} />
        ))}
      </div>
    </div>
  );
}
