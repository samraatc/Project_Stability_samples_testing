import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ErrorBanner, apiErrorMessage, PageHeader, btnDanger, btnGhost } from '@/components/ui';
import { ConfirmModal } from '@/components/confirm-modal';

interface BackupEntry {
  id: string;
  name: string;
  sizeBytes: number;
  collections: { name: string; count: number }[];
  createdBy: string | null;
  createdAt: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function createAndDownloadBackup(): Promise<void> {
  const res = await api.post<Blob>('/backups', undefined, { responseType: 'blob' });

  const disposition = (res.headers['content-disposition'] as string | undefined) ?? '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match?.[1] ?? `esms-backup-${Date.now()}.json`;

  const url = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function BackupsPage() {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  // Auto-backup configuration state
  const [enabled, setEnabled] = useState(false);
  const [schedule, setSchedule] = useState('daily');
  const [cronExpression, setCronExpression] = useState('0 0 * * *');

  // Custom modal state
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const query = useQuery({
    queryKey: ['backups'],
    queryFn: async () => {
      const res = await api.get<{ data: BackupEntry[] }>('/backups');
      return res.data.data;
    },
  });

  const settingsQuery = useQuery({
    queryKey: ['backup-settings'],
    queryFn: async () => {
      const res = await api.get<{
        data: { enabled: boolean; schedule: string; cronExpression: string };
      }>('/backups/settings');
      return res.data.data;
    },
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setEnabled(settingsQuery.data.enabled);
      setSchedule(settingsQuery.data.schedule);
      setCronExpression(settingsQuery.data.cronExpression);
    }
  }, [settingsQuery.data]);

  const backupMutation = useMutation({
    mutationFn: createAndDownloadBackup,
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
    onError: (error) => setActionError(apiErrorMessage(error)),
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (body: { enabled: boolean; schedule: string; cronExpression: string }) => {
      const res = await api.post('/backups/settings', body);
      return res.data;
    },
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['backup-settings'] });
      alert('Backup configuration saved successfully!');
    },
    onError: (error) => setActionError(apiErrorMessage(error)),
  });

  const downloadBackupMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.get<Blob>(`/backups/${id}/download`, { responseType: 'blob' });
      const disposition = (res.headers['content-disposition'] as string | undefined) ?? '';
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? `esms-backup-${id}.json`;

      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
    onError: (error) => setActionError(apiErrorMessage(error)),
  });

  const deleteBackupMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/backups/${id}`);
    },
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
    onError: (error) => setActionError(apiErrorMessage(error)),
  });

  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccessMsg, setRestoreSuccessMsg] = useState<string | null>(null);

  const restoreBackupMutation = useMutation({
    mutationFn: async (file: File) => {
      setIsRestoring(true);
      setRestoreSuccessMsg(null);
      setActionError(null);
      const text = await file.text();
      const backupData = JSON.parse(text);
      const res = await api.post('/backups/restore-file', { backupData });
      return res.data;
    },
    onSuccess: (res: any) => {
      setIsRestoring(false);
      setRestoreSuccessMsg(res.message || 'Database restored successfully!');
      void queryClient.invalidateQueries();
    },
    onError: (error) => {
      setIsRestoring(false);
      setActionError(apiErrorMessage(error));
    },
  });

  const handleFileRestoreSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setConfirmModal({
      title: 'Restore Database Backup from System',
      message: `⚠️ CAUTION: Restoring database snapshot from "${file.name}" will update existing records in your database. Are you sure you want to proceed with restoration?`,
      onConfirm: () => {
        restoreBackupMutation.mutate(file);
        setConfirmModal(null);
        e.target.value = '';
      },
    });
  };

  return (
    <div className="space-y-6 animate-menu-fade">
      <PageHeader
        title="Database Backups"
        description="Generate and manage database snapshots to safeguard stability study data."
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <label className="px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition duration-150 cursor-pointer shadow-xs flex items-center justify-center gap-1.5">
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFileRestoreSelect}
                disabled={isRestoring}
              />
              <svg
                className="h-4 w-4 text-blue-600 dark:text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              <span>{isRestoring ? '⏳ Restoring Data…' : '📥 Restore from Local System'}</span>
            </label>
            <button
              type="button"
              onClick={() => backupMutation.mutate()}
              disabled={backupMutation.isPending}
              className="px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition duration-150 cursor-pointer shadow-sm shadow-blue-500/10 flex items-center justify-center gap-1.5"
            >
              {backupMutation.isPending ? (
                <>
                  <svg
                    className="animate-spin h-3.5 w-3.5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Creating backup…</span>
                </>
              ) : (
                <>
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  <span>Create Backup</span>
                </>
              )}
            </button>
          </div>
        }
      />

      <ErrorBanner message={actionError} />
      {restoreSuccessMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900/40 p-4 text-xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-2">
          <span>✅</span>
          <span>{restoreSuccessMsg}</span>
        </div>
      )}

      {/* Auto Backup Configuration Card */}
      <div
        className={`p-6 rounded-2xl border bg-white dark:bg-slate-900 shadow-xs relative overflow-hidden transition-all duration-300 ${
          enabled
            ? 'border-slate-200 dark:border-slate-800 border-l-4 border-l-emerald-500 dark:border-l-emerald-500'
            : 'border-slate-200 dark:border-slate-800 border-l-4 border-l-slate-400 dark:border-l-slate-600'
        }`}
      >
        <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
          Auto Backup Scheduler
        </h2>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          Configure automated background backups of the database as a cron job.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setConfirmModal({
              title: 'Modify Auto Backup Settings',
              message: enabled
                ? `Are you sure you want to enable auto backups on a ${schedule} schedule (${cronExpression})?`
                : 'Are you sure you want to disable auto backups?',
              onConfirm: () => {
                updateSettingsMutation.mutate({ enabled, schedule, cronExpression });
                setConfirmModal(null);
              },
            });
          }}
          className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-4 items-end"
        >
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Scheduler Status
            </label>
            <label className="inline-flex items-center cursor-pointer mt-1">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="relative w-11 h-6 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600 dark:peer-checked:bg-emerald-600 transition-all duration-200 shadow-inner"></div>
              <span className="ms-3 text-xs font-bold text-slate-700 dark:text-slate-300 select-none transition-colors duration-200">
                {enabled ? 'Active' : 'Inactive'}
              </span>
            </label>
          </div>

          <div>
            <label htmlFor="b-schedule" className="form-label">
              Backup Schedule
            </label>
            <select
              id="b-schedule"
              value={schedule}
              onChange={(e) => {
                const val = e.target.value;
                setSchedule(val);
                if (val === 'daily') setCronExpression('0 0 * * *');
                else if (val === 'weekly') setCronExpression('0 0 * * 0');
                else if (val === 'monthly') setCronExpression('0 0 1 * *');
              }}
              className="mt-1 w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="custom">Custom (Cron)</option>
            </select>
          </div>

          <div>
            <label htmlFor="b-cron" className="form-label">
              Cron Expression
            </label>
            <input
              id="b-cron"
              type="text"
              value={cronExpression}
              disabled={schedule !== 'custom'}
              onChange={(e) => setCronExpression(e.target.value)}
              className="mt-1 w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={updateSettingsMutation.isPending}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition duration-150 cursor-pointer shadow-sm shadow-blue-500/10 flex items-center justify-center gap-1.5 w-full"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>{updateSettingsMutation.isPending ? 'Saving…' : 'Save Config'}</span>
            </button>
          </div>
        </form>
      </div>

      <div className="table-container">
        <table className="table-admin">
          <thead>
            <tr>
              <th className="px-4 py-3.5">S.N.</th>
              <th className="px-4 py-3.5">Backup Filename</th>
              <th className="px-4 py-3.5">Size</th>
              <th className="px-4 py-3.5">Collections</th>
              <th className="px-4 py-3.5">Created By</th>
              <th className="px-4 py-3.5">Timestamp</th>
              <th className="px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-medium">
                  Loading backup snapshots…
                </td>
              </tr>
            )}
            {query.data?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-medium">
                  No snapshots registered yet. Create your first database backup above.
                </td>
              </tr>
            )}
            {query.data?.map((b, index) => (
              <tr key={b.id} className="group">
                <td className="px-4 py-3.5 text-slate-500 font-medium">{index + 1}</td>
                <td
                  className="px-4 py-3.5 font-medium text-slate-900 dark:text-white truncate max-w-[220px]"
                  title={b.name}
                >
                  <div className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors duration-150"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span>{b.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400 font-medium">
                  {formatSize(b.sizeBytes)}
                </td>
                <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400">
                  <span className="inline-flex items-center rounded-lg bg-blue-50 dark:bg-blue-950/40 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
                    {b.collections.reduce((sum, c) => sum + c.count, 0)} docs
                  </span>
                  <span className="text-[10px] text-slate-400 ml-1.5 font-medium">
                    ({b.collections.length} tables)
                  </span>
                </td>
                <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400 font-mono text-[10px]">
                  {b.createdBy ? (
                    <span className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-bold text-slate-700 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50">
                      👤 {b.createdBy}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                      🤖 automated
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400">
                  {new Date(b.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <div className="flex justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => downloadBackupMutation.mutate(b.id)}
                      disabled={downloadBackupMutation.isPending}
                      className={btnGhost}
                    >
                      <svg
                        className="h-3.5 w-3.5 text-slate-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      <span>Download</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmModal({
                          title: 'Permanently Delete Backup',
                          message: `Are you sure you want to permanently delete backup "${b.name}"? This deletes the metadata and backup files from the server.`,
                          onConfirm: () => {
                            deleteBackupMutation.mutate(b.id);
                            setConfirmModal(null);
                          },
                        });
                      }}
                      disabled={deleteBackupMutation.isPending}
                      className={btnDanger}
                    >
                      <svg
                        className="h-3.5 w-3.5 text-red-500 dark:text-red-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                      <span>Delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
        🛡️ Backups contain the complete encrypted database snapshots, including user settings. Store
        downloaded files securely.
      </p>

      {/* Custom Confirmation Modal */}
      <ConfirmModal
        isOpen={!!confirmModal}
        title={confirmModal?.title || ''}
        message={confirmModal?.message || ''}
        onConfirm={confirmModal?.onConfirm || (() => {})}
        onCancel={() => setConfirmModal(null)}
      />
    </div>
  );
}
