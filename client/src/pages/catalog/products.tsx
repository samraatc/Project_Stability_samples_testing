import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ConfirmModal } from '@/components/confirm-modal';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { catalogApi } from '@/features/catalog/api';
import { productFormSchema, type ProductFormValues } from '@/features/catalog/schemas';
import type { Category, Product } from '@/features/catalog/types';
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

export function ProductsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    code: '',
    category: '',
    dosageForm: '',
    strength: '',
    storageConditions: '',
  });

  const query = useQuery({
    queryKey: ['products', page, search, showArchived],
    queryFn: () => catalogApi.products.list({ page, limit: 10, search, archived: showArchived }),
  });

  const categoriesQuery = useQuery({
    queryKey: ['categories', 'all'],
    queryFn: () => catalogApi.categories.list({ limit: 100 }),
  });
  const categories: Category[] = categoriesQuery.data?.items ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['products'] });
  const onError = (error: unknown) => setActionError(apiErrorMessage(error));

  const createMutation = useMutation({
    mutationFn: (values: ProductFormValues) => catalogApi.products.create(values),
    onSuccess: () => {
      setShowCreate(false);
      reset();
      void invalidate();
    },
  });
  const archiveMutation = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      archived ? catalogApi.products.restore(id) : catalogApi.products.archive(id),
    onSuccess: () => void invalidate(),
    onError,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => catalogApi.products.remove(id),
    onSuccess: () => void invalidate(),
    onError,
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Product> }) =>
      catalogApi.products.update(id, body),
    onSuccess: () => {
      setEditingId(null);
      void invalidate();
    },
    onError,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: '',
      code: '',
      category: '',
      dosageForm: '',
      strength: '',
      storageConditions: '',
    },
  });

  const data = query.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products Registry"
        count={query.data?.total}
        description="Register and administer pharmaceutical products under stability protocols."
        actions={
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-start sm:justify-end">
            <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => {
                  setShowArchived(e.target.checked);
                  setPage(1);
                }}
                className="h-4 w-4 rounded-lg border-slate-300 dark:border-slate-800 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
              />
              Show Archived
            </label>
            <input
              type="search"
              placeholder="Search products…"
              aria-label="Search products"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full sm:w-52 text-xs rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-1.5 bg-white dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button type="button" onClick={() => setShowCreate((v) => !v)} className={btnPrimary}>
              {showCreate ? 'Close Form' : 'New Product'}
            </button>
          </div>
        }
      />

      <ErrorBanner message={actionError} />

      {showCreate && (
        <form
          onSubmit={handleSubmit((v) => createMutation.mutate(v))}
          noValidate
          className="card-panel grid grid-cols-1 gap-4 sm:grid-cols-3 mt-4"
        >
          {(
            [
              ['name', 'Product Name'],
              ['code', 'Product Code'],
              ['dosageForm', 'Dosage Form'],
              ['strength', 'Strength'],
              ['storageConditions', 'Storage Conditions'],
            ] as const
          ).map(([field, label]) => (
            <div key={field}>
              <label htmlFor={`p-${field}`} className="form-label">
                {label}
              </label>
              <input
                id={`p-${field}`}
                className={inputClass}
                style={field === 'code' ? { textTransform: 'uppercase' } : undefined}
                {...register(
                  field,
                  field === 'code'
                    ? {
                      onChange: (e) => {
                        e.target.value = e.target.value.toUpperCase();
                      },
                    }
                    : undefined,
                )}
              />
              {errors[field] && (
                <p className="mt-1 text-[11px] text-red-650 dark:text-red-400 font-semibold">
                  {errors[field]?.message}
                </p>
              )}
            </div>
          ))}
          <div>
            <label htmlFor="p-category" className="form-label">
              Category
            </label>
            <select id="p-category" className={inputClass} {...register('category')}>
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c._id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.category && (
              <p className="mt-1 text-[11px] text-red-650 dark:text-red-400 font-semibold">
                {errors.category?.message}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 items-end sm:col-span-3 pt-2 border-t border-slate-100 dark:border-slate-800 w-full">
            <button type="submit" disabled={isSubmitting} className={btnPrimary}>
              {isSubmitting ? 'Creating…' : 'Create Product'}
            </button>
            {createMutation.isError && (
              <p
                role="alert"
                className="ml-4 text-xs font-semibold text-rose-650 dark:text-rose-450"
              >
                ⚠️ {apiErrorMessage(createMutation.error)}
              </p>
            )}
          </div>
        </form>
      )}

      <div className="table-container">
        <table className="table-admin">
          <thead>
            <tr>
              <th className="px-4 py-3">S.N.</th>
              <th className="px-4 py-3">Product Name & Code</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Dosage Form</th>
              <th className="px-4 py-3">Strength</th>
              <th className="px-4 py-3">Storage Conditions</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-medium">
                  Loading product items…
                </td>
              </tr>
            )}
            {data?.items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-medium">
                  No products registered.
                </td>
              </tr>
            )}
            {data?.items.map((p, index) => (
              <tr key={p._id}>
                <td className="px-4 py-3 text-slate-500 font-medium">
                  {(page - 1) * 10 + index + 1}
                </td>
                <td className="px-4 py-3">
                  {editingId === p._id ? (
                    <div className="space-y-2">
                      <input
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        className={inputClass}
                        placeholder="Product Name"
                      />
                      <input
                        value={editForm.code}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
                        }
                        className={inputClass}
                        style={{ textTransform: 'uppercase' }}
                        placeholder="Product Code"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{p.name}</span>
                        {p.isArchived && (
                          <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50">
                            archived
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                        {p.code}
                      </div>
                    </>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">
                  {editingId === p._id ? (
                    <select
                      value={editForm.category}
                      onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                      className={inputClass}
                    >
                      <option value="">Select category</option>
                      {categories.map((c) => (
                        <option key={c._id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    p.category || '—'
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                  {editingId === p._id ? (
                    <input
                      value={editForm.dosageForm}
                      onChange={(e) => setEditForm((f) => ({ ...f, dosageForm: e.target.value }))}
                      className={inputClass}
                    />
                  ) : (
                    p.dosageForm || '—'
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                  {editingId === p._id ? (
                    <input
                      value={editForm.strength}
                      onChange={(e) => setEditForm((f) => ({ ...f, strength: e.target.value }))}
                      className={inputClass}
                    />
                  ) : (
                    p.strength || '—'
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                  {editingId === p._id ? (
                    <input
                      value={editForm.storageConditions}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, storageConditions: e.target.value }))
                      }
                      className={inputClass}
                    />
                  ) : (
                    p.storageConditions || '—'
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {editingId === p._id ? (
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActionError(null);
                          updateMutation.mutate({ id: p._id, body: editForm });
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
                          setEditingId(p._id);
                          setEditForm({
                            name: p.name,
                            code: p.code,
                            category: p.category || '',
                            dosageForm: p.dosageForm || '',
                            strength: p.strength || '',
                            storageConditions: p.storageConditions || '',
                          });
                        }}
                        className={btnGhost}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActionError(null);
                          archiveMutation.mutate({ id: p._id, archived: p.isArchived });
                        }}
                        className={btnGhost}
                      >
                        {p.isArchived ? 'Restore' : 'Archive'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActionError(null);
                          setConfirmModal({
                            title: 'Delete Product Registration',
                            message: `Are you sure you want to permanently delete product "${p.code}"? This will delete linked batch metadata.`,
                            onConfirm: () => {
                              deleteMutation.mutate(p._id);
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

      <Pager data={data} page={page} onPage={setPage} />

      <ConfirmModal
        isOpen={!!confirmModal}
        title={confirmModal?.title || ''}
        message={confirmModal?.message || ''}
        onConfirm={confirmModal?.onConfirm || (() => { })}
        onCancel={() => setConfirmModal(null)}
      />
    </div>
  );
}
