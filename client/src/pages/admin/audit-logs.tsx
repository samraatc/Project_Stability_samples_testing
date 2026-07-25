import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAuditLogs } from '@/features/admin/api';
import { PageHeader, Pager } from '@/components/ui';

export function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['audit-logs', page],
    queryFn: () => fetchAuditLogs({ page }),
  });

  const data = query.data;

  return (
    <div>
      <PageHeader
        title="Laboratory Audit Logs"
        count={data?.total}
        description="Comprehensive audit trail logs tracking all stability operations and data mutations."
      />

      <div className="table-container">
        <table className="table-admin">
          <thead>
            <tr>
              <th className="px-4 py-3">S.N.</th>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Actor Email</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Target Resource</th>
              <th className="px-4 py-3">IP Address</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Loading audit data…
                </td>
              </tr>
            )}
            {data?.items.map((entry, index) => (
              <tr key={entry.id}>
                <td className="px-4 py-3 text-slate-500 font-medium">
                  {(page - 1) * 10 + index + 1}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                  {new Date(entry.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">
                  {entry.actorEmail ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <code className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-purple-600 dark:text-purple-400 font-semibold border border-slate-200/40 dark:border-slate-700/50">
                    {entry.action}
                  </code>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {entry.resource}
                  {entry.resourceId ? ` · ${entry.resourceId.slice(-6)}` : ''}
                </td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-[10px]">
                  {entry.ip || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pager data={data} page={page} onPage={setPage} />
    </div>
  );
}
