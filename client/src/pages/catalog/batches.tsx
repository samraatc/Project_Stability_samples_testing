import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ConfirmModal } from '@/components/confirm-modal';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { catalogApi } from '@/features/catalog/api';
import { batchFormSchema, type BatchFormValues } from '@/features/catalog/schemas';
import type { Batch } from '@/features/catalog/types';
import { Combobox } from '@/components/combobox';
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

export function BatchesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [productFilter, setProductFilter] = useState('');

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const productsQuery = useQuery({
    queryKey: ['products', 'all'],
    queryFn: () => catalogApi.products.list({ limit: 100 }),
  });

  const productOptions = useMemo(() => {
    return (productsQuery.data?.items || []).map((p) => ({
      value: p._id,
      label: p.name,
      subLabel: p.code,
    }));
  }, [productsQuery.data]);

  const query = useQuery({
    queryKey: ['batches', page, productFilter],
    queryFn: () =>
      catalogApi.batches.list({ page, limit: 10, productId: productFilter || undefined }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['batches'] });

  const createMutation = useMutation({
    mutationFn: (values: BatchFormValues) => catalogApi.batches.create(values),
    onSuccess: () => {
      setShowModal(false);
      reset();
      void invalidate();
    },
    onError: (error) => setActionError(apiErrorMessage(error)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Omit<Batch, '_id' | 'product'>> }) =>
      catalogApi.batches.update(id, body),
    onSuccess: () => {
      setShowModal(false);
      setEditingBatch(null);
      reset();
      void invalidate();
    },
    onError: (error) => setActionError(apiErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => catalogApi.batches.remove(id),
    onSuccess: () => void invalidate(),
    onError: (error) => setActionError(apiErrorMessage(error)),
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<BatchFormValues>({
    resolver: zodResolver(batchFormSchema),
    defaultValues: {
      batchNo: '',
      batchCode: '',
      productId: '',
      manufacturingDate: '',
      notes: '',
    },
  });

  const selectedProductId = watch('productId');

  const openCreateModal = () => {
    setEditingBatch(null);
    setActionError(null);
    reset({
      batchNo: '',
      batchCode: '',
      productId: '',
      manufacturingDate: '',
      notes: '',
    });
    setShowModal(true);
  };

  const openEditModal = (batch: Batch) => {
    setEditingBatch(batch);
    setActionError(null);
    const prodId =
      typeof batch.product === 'object' && batch.product
        ? batch.product._id
        : typeof batch.product === 'string'
          ? batch.product
          : '';
    reset({
      batchNo: batch.batchNo || '',
      batchCode: batch.batchCode,
      productId: prodId,
      manufacturingDate: batch.manufacturingDate ? batch.manufacturingDate.slice(0, 10) : '',
      notes: batch.notes || '',
    });
    setShowModal(true);
  };

  const onSubmit = (values: BatchFormValues) => {
    setActionError(null);
    if (editingBatch) {
      updateMutation.mutate({ id: editingBatch._id, body: values });
    } else {
      createMutation.mutate(values);
    }
  };

  const data = query.data;
  const productName = (batch: Batch) =>
    typeof batch.product === 'object' && batch.product
      ? `${batch.product.name} (${batch.product.code})`
      : '—';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manufacturing Batches"
        count={query.data?.total}
        description="Configure product batches and manufacturing details to charge stability studies."
        actions={
          <div className="flex items-center gap-3">
            <select
              aria-label="Filter by product"
              value={productFilter}
              onChange={(e) => {
                setProductFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">All products</option>
              {productsQuery.data?.items.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
            <button type="button" onClick={openCreateModal} className={btnPrimary}>
              New Batch
            </button>
          </div>
        }
      />

      <ErrorBanner message={actionError} />

      {/* Batches Table */}
      <div className="table-container">
        <table className="table-admin">
          <thead>
            <tr>
              <th className="px-4 py-3">S.N.</th>
              <th className="px-4 py-3">Batch Number</th>
              <th className="px-4 py-3">Batch Code</th>
              <th className="px-4 py-3">Linked Product</th>
              <th className="px-4 py-3">Mfg Date</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-medium">
                  Loading batches data…
                </td>
              </tr>
            )}
            {data?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-medium">
                  No batches configured yet.
                </td>
              </tr>
            )}
            {data?.items.map((b, index) => (
              <tr key={b._id}>
                <td className="px-4 py-3 text-slate-500 font-medium">
                  {(page - 1) * 10 + index + 1}
                </td>
                <td className="px-4 py-3 text-slate-605 dark:text-slate-400 font-medium">
                  {b.batchNo || '—'}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white font-mono">
                  {b.batchCode}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">
                  {productName(b)}
                </td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                  {b.manufacturingDate ? new Date(b.manufacturingDate).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => openEditModal(b)} className={btnGhost}>
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActionError(null);
                        setConfirmModal({
                          title: 'Delete Batch',
                          message: `Are you sure you want to permanently delete batch "${b.batchCode}"?`,
                          onConfirm: () => {
                            deleteMutation.mutate(b._id);
                            setConfirmModal(null);
                          },
                        });
                      }}
                      className={btnDanger}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pager data={data} page={page} onPage={setPage} />

      {/* Popup Form Modal */}
      {showModal &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-fade-in">
            <div className="relative w-[95vw] max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 shadow-2xl p-6 border border-slate-100 dark:border-slate-800 flex flex-col text-slate-900 dark:text-slate-100">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3 mb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editingBatch
                    ? `Edit Batch: ${editingBatch.batchCode}`
                    : 'New Batch Registration'}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 text-left">
                <div>
                  <label htmlFor="b-code" className="form-label">
                    Batch Code *
                  </label>
                  <input
                    id="b-code"
                    className={inputClass}
                    style={{ textTransform: 'uppercase' }}
                    {...register('batchCode', {
                      onChange: (e) => {
                        e.target.value = e.target.value.toUpperCase();
                      },
                    })}
                    placeholder="e.g. B2026-001"
                  />
                  {errors.batchCode && (
                    <p className="mt-1 text-[11px] text-red-600 font-semibold">
                      {errors.batchCode.message}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="b-no" className="form-label">
                    Batch Number
                  </label>
                  <input
                    id="b-no"
                    className={inputClass}
                    style={{ textTransform: 'uppercase' }}
                    {...register('batchNo', {
                      onChange: (e) => {
                        e.target.value = e.target.value.toUpperCase();
                      },
                    })}
                    placeholder="e.g. BN1029"
                  />
                  {errors.batchNo && (
                    <p className="mt-1 text-[11px] text-red-600 font-semibold">
                      {errors.batchNo.message}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="b-product" className="form-label">
                    Assigned Product *
                  </label>
                  <Combobox
                    id="b-product"
                    options={productOptions}
                    value={selectedProductId || ''}
                    onChange={(val) => setValue('productId', val, { shouldValidate: true })}
                    placeholder="Search product by name or code…"
                    disabled={!!editingBatch}
                  />
                  {errors.productId && (
                    <p className="mt-1 text-[11px] text-red-600 font-semibold">
                      {errors.productId.message}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="b-mfg" className="form-label">
                    Manufacturing Date *
                  </label>
                  <input
                    id="b-mfg"
                    type="date"
                    className={inputClass}
                    {...register('manufacturingDate')}
                  />
                  {errors.manufacturingDate && (
                    <p className="mt-1 text-[11px] text-red-600 font-semibold">
                      {errors.manufacturingDate.message}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="b-notes" className="form-label">
                    Notes / Observations
                  </label>
                  <textarea
                    id="b-notes"
                    className={`${inputClass} h-20 resize-none`}
                    {...register('notes')}
                    placeholder="Optional notes about this batch..."
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                  <button type="button" onClick={() => setShowModal(false)} className={btnGhost}>
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmitting} className={btnPrimary}>
                    {isSubmitting ? 'Saving…' : 'Save Batch'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
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
