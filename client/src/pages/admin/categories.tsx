import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ConfirmModal } from '@/components/confirm-modal';
import { catalogApi } from '@/features/catalog/api';
import {
  ErrorBanner,
  Pager,
  PageHeader,
  apiErrorMessage,
  btnGhost,
  btnPrimary,
  btnDanger,
  inputClass,
} from '@/components/ui';

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const query = useQuery({
    queryKey: ['categories', page],
    queryFn: () => catalogApi.categories.list({ page, limit: 10 }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['categories'] });

  const createMutation = useMutation({
    mutationFn: () => catalogApi.categories.create({ name: name.trim(), description }),
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
      archived ? catalogApi.categories.restore(id) : catalogApi.categories.archive(id),
    onSuccess: () => void invalidate(),
    onError: (error) => setActionError(apiErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => catalogApi.categories.remove(id),
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
    }) => catalogApi.categories.update(id, body),
    onSuccess: () => {
      setEditingId(null);
      void invalidate();
    },
    onError: (error) => setActionError(apiErrorMessage(error)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Categories"
        count={query.data?.total}
        description="Configure product classifications and categories for stability study designs."
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
          <label htmlFor="category-name" className="form-label">
            Category Name
          </label>
          <input
            id="category-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="e.g. Tablet / Liquid / Ointment"
          />
        </div>
        <div className="min-w-64 flex-1">
          <label htmlFor="category-desc" className="form-label">
            Description
          </label>
          <input
            id="category-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
            placeholder="e.g. Oral solid dosage forms under stability protocols"
          />
        </div>
        <button
          type="submit"
          disabled={!name.trim() || createMutation.isPending}
          className={btnPrimary}
        >
          Add category
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
                  Loading categories…
                </td>
              </tr>
            )}
            {query.data?.items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  No categories registered.
                </td>
              </tr>
            )}
            {query.data?.items.map((c, index) => (
              <tr key={c._id}>
                <td className="px-4 py-3 text-slate-500 font-medium">
                  {(page - 1) * 10 + index + 1}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                  {editingId === c._id ? (
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      className={inputClass}
                    />
                  ) : (
                    c.name
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                  {editingId === c._id ? (
                    <input
                      value={editForm.description}
                      onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                      className={inputClass}
                    />
                  ) : (
                    c.description || '—'
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {editingId === c._id ? (
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActionError(null);
                          updateMutation.mutate({ id: c._id, body: editForm });
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
                          setEditingId(c._id);
                          setEditForm({ name: c.name, description: c.description || '' });
                        }}
                        className={btnGhost}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          archiveMutation.mutate({ id: c._id, archived: c.isArchived })
                        }
                        className={btnGhost}
                      >
                        {c.isArchived ? 'Restore' : 'Archive'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActionError(null);
                          setConfirmModal({
                            title: 'Delete Category',
                            message: `Are you sure you want to permanently delete category "${c.name}"?`,
                            onConfirm: () => {
                              deleteMutation.mutate(c._id);
                              setConfirmModal(null);
                            },
                          });
                        }}
                        className={btnDanger}
                      >
                        Delete
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
