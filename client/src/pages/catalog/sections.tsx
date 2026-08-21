import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogApi } from '@/features/catalog/api';
import {
  ErrorBanner,
  Pager,
  PageHeader,
  apiErrorMessage,
  btnGhost,
  btnPrimary,
  inputClass,
} from '@/components/ui';

export function SectionsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '' });

  const query = useQuery({
    queryKey: ['sections', page],
    queryFn: () => catalogApi.sections.list({ page, limit: 10 }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['sections'] });

  const createMutation = useMutation({
    mutationFn: () => catalogApi.sections.create({ name: name.trim(), description }),
    onSuccess: () => {
      setName('');
      setDescription('');
      setActionError(null);
      void invalidate();
    },
    onError: (error) => setActionError(apiErrorMessage(error)),
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      archived ? catalogApi.sections.restore(id) : catalogApi.sections.archive(id),
    onSuccess: () => void invalidate(),
    onError: (error) => setActionError(apiErrorMessage(error)),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Partial<{ name: string; description: string }>;
    }) => catalogApi.sections.update(id, body),
    onSuccess: () => {
      setEditingId(null);
      void invalidate();
    },
    onError: (error) => setActionError(apiErrorMessage(error)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laboratory Sections"
        count={query.data?.total}
        description="Manage different laboratory departments and physical sections for stability tests."
      />
      <ErrorBanner message={actionError} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) createMutation.mutate();
        }}
        className="card-panel flex flex-wrap items-end gap-4"
      >
        <div className="min-w-48 flex-1 sm:flex-none">
          <label htmlFor="section-name" className="form-label">
            Section Name
          </label>
          <input
            id="section-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="e.g. Oral Solids Lab / Analytical QC"
          />
        </div>
        <div className="min-w-64 flex-1">
          <label htmlFor="section-desc" className="form-label">
            Description
          </label>
          <input
            id="section-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
            placeholder="e.g. Physical testing & stability chamber monitoring"
          />
        </div>
        <button
          type="submit"
          disabled={!name.trim() || createMutation.isPending}
          className={btnPrimary}
        >
          Add section
        </button>
      </form>

      <div className="table-container">
        <table className="table-admin">
          <thead>
            <tr>
              <th className="px-4 py-3">S.N.</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  Loading laboratory sections…
                </td>
              </tr>
            )}
            {query.data?.items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  No sections yet.
                </td>
              </tr>
            )}
            {query.data?.items.map((s, index) => (
              <tr key={s._id}>
                <td className="px-4 py-3 text-slate-500 font-medium">
                  {(page - 1) * 10 + index + 1}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                  {editingId === s._id ? (
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      className={inputClass}
                    />
                  ) : (
                    s.name
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                  {editingId === s._id ? (
                    <input
                      value={editForm.description}
                      onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                      className={inputClass}
                    />
                  ) : (
                    s.description || '—'
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {editingId === s._id ? (
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActionError(null);
                          updateMutation.mutate({ id: s._id, body: editForm });
                        }}
                        className={btnPrimary}
                      >
                        Save
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className={btnGhost}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(s._id);
                          setEditForm({ name: s.name, description: s.description || '' });
                        }}
                        className={btnGhost}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          archiveMutation.mutate({ id: s._id, archived: s.isArchived })
                        }
                        className={btnGhost}
                      >
                        {s.isArchived ? 'Restore' : 'Archive'}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pager data={query.data} page={page} onPage={setPage} />
    </div>
  );
}
