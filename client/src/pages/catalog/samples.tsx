import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { catalogApi } from '@/features/catalog/api';
import { sampleFormSchema, type SampleFormValues } from '@/features/catalog/schemas';
import {
  SAMPLE_STATUSES,
  STABILITY_TYPES,
  DEFAULT_INTERVALS_BY_TYPE,
  STABILITY_TYPE_INFO,
  isSampleFullyCompleted,
  type Sample,
} from '@/features/catalog/types';
import { Combobox } from '@/components/combobox';
import {
  ErrorBanner,
  Pager,
  PageHeader,
  apiErrorMessage,
  btnGhost,
  btnPrimary,
  inputClass,
} from '@/components/ui';

const statusStyle: Record<Sample['status'], string> = {
  registered: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400',
  running: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400',
  completed: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400',
};

export function SamplesPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [pendingValues, setPendingValues] = useState<SampleFormValues | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ quantity: 0, remarks: '', expiryDate: '' });

  useEffect(() => {
    if (searchParams.get('openCreate') === 'true') {
      setShowCreate(true);
    }
  }, [searchParams]);

  const query = useQuery({
    queryKey: ['samples', page, statusFilter, showArchived],
    queryFn: () =>
      catalogApi.samples.list({
        page,
        limit: 10,
        status: statusFilter || undefined,
        archived: showArchived,
      }),
  });
  const productsQuery = useQuery({
    queryKey: ['products', 'all'],
    queryFn: () => catalogApi.products.list({ limit: 100 }),
  });
  const categoriesQuery = useQuery({
    queryKey: ['categories', 'all'],
    queryFn: () => catalogApi.categories.list({ limit: 100 }),
  });

  const productOptions = useMemo(() => {
    return (productsQuery.data?.items || []).map((p) => ({
      value: p._id,
      label: p.name,
      subLabel: p.code,
    }));
  }, [productsQuery.data]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SampleFormValues>({
    resolver: zodResolver(sampleFormSchema),
    defaultValues: {
      productId: '',
      batchId: '',
      sectionId: '',
      stabilityType: 'long-term',
      manufacturingDate: '',
      expiryDate: '',
      chargingDate: '',
      quantity: 0,
      remarks: '',
    },
  });

  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showValidationErrorModal, setShowValidationErrorModal] = useState(false);
  const [selectedIntervals, setSelectedIntervals] = useState<number[]>([3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36]);
  const [customMonthInput, setCustomMonthInput] = useState<string>('');

  const selectedProductId = watch('productId');
  const selectedBatchId = watch('batchId');
  const selectedStabilityType = watch('stabilityType');

  // Auto-set recommended intervals whenever stability type changes
  useEffect(() => {
    if (selectedStabilityType) {
      const defaults = DEFAULT_INTERVALS_BY_TYPE[selectedStabilityType] || [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36];
      setSelectedIntervals(defaults);
    }
  }, [selectedStabilityType]);

  const batchesQuery = useQuery({
    queryKey: ['batches', 'for-product', selectedProductId],
    queryFn: () => catalogApi.batches.list({ productId: selectedProductId, limit: 100 }),
    enabled: Boolean(selectedProductId),
  });

  useEffect(() => {
    if (selectedBatchId && batchesQuery.data?.items) {
      const selectedBatch = batchesQuery.data.items.find((b) => b._id === selectedBatchId);
      if (selectedBatch?.manufacturingDate) {
        const formattedDate = selectedBatch.manufacturingDate.slice(0, 10);
        setValue('manufacturingDate', formattedDate);
      }
    }
  }, [selectedBatchId, batchesQuery.data, setValue]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['samples'] });
  const onError = (error: unknown) => setActionError(apiErrorMessage(error));

  const createMutation = useMutation({
    mutationFn: (values: SampleFormValues) =>
      catalogApi.samples.create({
        ...values,
        sectionId: values.sectionId || undefined,
        expiryDate: values.expiryDate || undefined,
        intervals: selectedIntervals.length > 0 ? selectedIntervals : undefined,
      }),
    onSuccess: () => {
      setShowCreate(false);
      reset();
      void invalidate();
    },
    onError,
  });
  const cloneMutation = useMutation({
    mutationFn: (id: string) => catalogApi.samples.clone(id),
    onSuccess: () => void invalidate(),
    onError,
  });
  const archiveMutation = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      archived ? catalogApi.samples.restore(id) : catalogApi.samples.archive(id),
    onSuccess: () => void invalidate(),
    onError,
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Sample['status'] }) =>
      catalogApi.samples.update(id, { status }),
    onSuccess: () => void invalidate(),
    onError,
  });
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Partial<Pick<Sample, 'quantity' | 'remarks' | 'expiryDate'>>;
    }) =>
      catalogApi.samples.update(id, {
        ...body,
        expiryDate: body.expiryDate ? body.expiryDate : null,
      }),
    onSuccess: () => {
      setEditingId(null);
      void invalidate();
    },
    onError,
  });

  const selectedProduct = productsQuery.data?.items.find((p) => p._id === selectedProductId);

  const onFormSubmit = (v: SampleFormValues) => {
    if (!v.expiryDate) {
      setPendingValues(v);
      setShowWarningModal(true);
    } else {
      createMutation.mutate(v);
    }
  };

  const handleConfirmWarning = () => {
    if (pendingValues) {
      createMutation.mutate(pendingValues);
      setPendingValues(null);
    }
    setShowWarningModal(false);
  };

  const handleCancelWarning = () => {
    setPendingValues(null);
    setShowWarningModal(false);
  };

  const getCategoryColor = (categoryName?: string) => {
    if (!categoryName) return '#475569';
    const cat = categoriesQuery.data?.items.find(
      (c) => c.name.toLowerCase() === categoryName.toLowerCase(),
    );
    return cat?.color || '#475569';
  };

  const data = query.data;

  return (
    <div className="space-y-6">
      <style>{`
        @keyframes modalScaleIn {
          0% { transform: scale(0.95); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes backdropFadeIn {
          0% { opacity: 0; }
          100% { opacity: 0.6; }
        }
        .animate-modal-scale {
          animation: modalScaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-backdrop-fade {
          animation: backdropFadeIn 0.2s ease-out forwards;
        }
      `}</style>

      <PageHeader
        title="Stability Studies Database"
        count={query.data?.total}
        description="Comprehensive list of all registered stability test samples and pull protocols."
        actions={
          <div className="flex items-center gap-3">
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
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-white"
            >
              <option value="">All statuses</option>
              {SAMPLE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setShowCreate((v) => !v)} className={btnPrimary}>
              Register Sample
            </button>
          </div>
        }
      />

      <ErrorBanner message={actionError} />

      {/* Large Registration Modal */}
      {showCreate &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-[95vw] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 shadow-2xl p-4 sm:p-6 border border-slate-100 dark:border-slate-800 flex flex-col animate-modal-scale">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3 mb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Register Stability Sample
                </h2>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form
                onSubmit={handleSubmit(onFormSubmit)}
                noValidate
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-left"
              >
                <div>
                  <label htmlFor="s-product" className="form-label">
                    Assigned Product *
                  </label>
                  <Combobox
                    id="s-product"
                    options={productOptions}
                    value={selectedProductId || ''}
                    onChange={(val) => {
                      setValue('productId', val, { shouldValidate: true });
                      setValue('batchId', '');
                    }}
                    placeholder="Search product by name or code…"
                  />
                  {errors.productId && (
                    <p className="mt-1 text-[11px] text-red-600 font-semibold">
                      {errors.productId.message}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="s-batch" className="form-label">
                    Manufacturing Batch *
                  </label>
                  <select
                    id="s-batch"
                    className={inputClass}
                    disabled={!selectedProductId}
                    {...register('batchId')}
                  >
                    <option value="">
                      {selectedProductId ? 'Select batch…' : 'Pick a product first'}
                    </option>
                    {batchesQuery.data?.items.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.batchCode}
                      </option>
                    ))}
                  </select>
                  {errors.batchId && (
                    <p className="mt-1 text-[11px] text-red-655 font-semibold">
                      {errors.batchId.message}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="s-category" className="form-label">
                    Category (Auto-Selected)
                  </label>
                  <input
                    id="s-category"
                    type="text"
                    className={`${inputClass} bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 cursor-not-allowed`}
                    value={selectedProduct?.category || '—'}
                    disabled
                    readOnly
                    placeholder="Auto-selected from product"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="s-type" className="form-label mb-0">
                      Stability Study Type *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowInfoModal(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      title="View Study Type Info & ICH Guidelines"
                    >
                      ℹ️ Info & Guidelines
                    </button>
                  </div>
                  <select id="s-type" className={inputClass} {...register('stabilityType')}>
                    {STABILITY_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.toUpperCase()} ({STABILITY_TYPE_INFO[t]?.period || ''})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Interactive Testing Month Intervals Section */}
                <div className="sm:col-span-2 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                        Testing Month Intervals (Testing Period)
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                        Auto-assigned for <span className="font-bold text-blue-600 dark:text-blue-400">{selectedStabilityType?.toUpperCase()}</span> ({STABILITY_TYPE_INFO[selectedStabilityType]?.period || ''}). Click to customize.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const defaults = DEFAULT_INTERVALS_BY_TYPE[selectedStabilityType] || [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36];
                        setSelectedIntervals(defaults);
                      }}
                      className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      🔄 Reset Defaults
                    </button>
                  </div>

                  {/* Interval Checkboxes */}
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(new Set([1, 2, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, ...selectedIntervals]))
                      .sort((a, b) => a - b)
                      .map((m) => {
                        const isSelected = selectedIntervals.includes(m);
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                if (selectedIntervals.length > 1) {
                                  setSelectedIntervals(selectedIntervals.filter((i) => i !== m));
                                }
                              } else {
                                setSelectedIntervals([...selectedIntervals, m].sort((a, b) => a - b));
                              }
                            }}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition border cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {isSelected ? '✓ ' : ''}{m}M
                          </button>
                        );
                      })}
                  </div>

                  {/* Custom Month Adder */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="number"
                      min={1}
                      max={120}
                      placeholder="Add Custom Month (e.g. 4, 8, 48)..."
                      value={customMonthInput}
                      onChange={(e) => setCustomMonthInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = Number(customMonthInput);
                          if (val > 0 && !selectedIntervals.includes(val)) {
                            setSelectedIntervals([...selectedIntervals, val].sort((a, b) => a - b));
                            setCustomMonthInput('');
                          }
                        }
                      }}
                      className="w-56 text-xs px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = Number(customMonthInput);
                        if (val > 0 && !selectedIntervals.includes(val)) {
                          setSelectedIntervals([...selectedIntervals, val].sort((a, b) => a - b));
                          setCustomMonthInput('');
                        }
                      }}
                      className="px-3 py-1 rounded-lg bg-slate-800 dark:bg-slate-700 text-white text-xs font-semibold hover:bg-slate-700 transition cursor-pointer"
                    >
                      ➕ Add Custom Month
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="s-mfg" className="form-label">
                    Manufacturing Date *
                  </label>
                  <input
                    id="s-mfg"
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
                  <label htmlFor="s-exp" className="form-label">
                    Expiry Date (Optional)
                  </label>
                  <input
                    id="s-exp"
                    type="date"
                    className={inputClass}
                    {...register('expiryDate')}
                  />
                  {errors.expiryDate && (
                    <p className="mt-1 text-[11px] text-red-600 font-semibold">
                      {errors.expiryDate.message}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="s-charge" className="form-label">
                    Charging Date *
                  </label>
                  <input
                    id="s-charge"
                    type="date"
                    className={inputClass}
                    {...register('chargingDate')}
                  />
                  {errors.chargingDate && (
                    <p className="mt-1 text-[11px] text-red-600 font-semibold">
                      {errors.chargingDate.message}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="s-qty" className="form-label">
                    Quantity (Units) *
                  </label>
                  <input
                    id="s-qty"
                    type="number"
                    min={0}
                    className={inputClass}
                    placeholder="e.g. 500"
                    {...register('quantity')}
                  />
                  {errors.quantity && (
                    <p className="mt-1 text-[11px] text-red-600 font-semibold">
                      {errors.quantity.message}
                    </p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="s-remarks" className="form-label">
                    Remarks / Observations
                  </label>
                  <input
                    id="s-remarks"
                    className={inputClass}
                    {...register('remarks')}
                    placeholder="e.g. Initial registration for 36-month stability study..."
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 sm:col-span-2">
                  <button type="button" onClick={() => setShowCreate(false)} className={btnGhost}>
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmitting} className={btnPrimary}>
                    Register Sample
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}

      {/* Expiry Warning popup modal overlay */}
      {showWarningModal &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-2xl p-6 border border-slate-100 dark:border-slate-800 flex flex-col animate-modal-scale text-left">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-amber-50 dark:bg-amber-950/20 flex items-center justify-center text-amber-600 dark:text-amber-450 text-lg">
                  ⚠️
                </div>
                <div className="mt-1">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Missing Expiry Date
                  </h3>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    The Expiry Date is empty. Do you want to submit the sample registration without
                    an Expiry Date? You can update this later.
                  </p>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button type="button" onClick={handleCancelWarning} className={btnGhost}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmWarning}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition"
                >
                  Yes, Submit
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Information Modal for Stability Study Types */}
      {showInfoModal &&
        createPortal(
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 shadow-2xl p-6 border border-slate-200 dark:border-slate-800 flex flex-col text-left space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">ℹ️</span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Stability Study Types & ICH Guidelines
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInfoModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-xs">
                {Object.entries(STABILITY_TYPE_INFO).map(([key, info]) => (
                  <div
                    key={key}
                    className={`p-3.5 rounded-xl border ${
                      selectedStabilityType === key
                        ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 ring-2 ring-blue-400/20'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900 dark:text-white uppercase text-xs">
                        {info.title}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-extrabold text-[10px]">
                        {info.period}
                      </span>
                    </div>
                    <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
                      🌡️ Condition: {info.condition}
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed mb-1.5">
                      {info.description}
                    </p>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 italic border-l-2 border-slate-300 dark:border-slate-700 pl-2 py-0.5">
                      {info.ichGuideline}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowInfoModal(false)}
                  className={btnPrimary}
                >
                  Got It
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <div className="table-container">
        <table className="table-admin">
          <thead>
            <tr>
              <th className="px-4 py-3">S.N.</th>
              <th className="px-4 py-3">Sample Code & Category</th>
              <th className="px-4 py-3">Product / Batch</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Charged</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Remarks</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-400 font-medium">
                  Loading samples database…
                </td>
              </tr>
            )}
            {data?.items.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-400 font-medium">
                  No samples found.
                </td>
              </tr>
            )}
            {data?.items.map((s, index) => (
              <tr key={s._id}>
                <td className="px-4 py-3 text-slate-500 font-medium">
                  {(page - 1) * 10 + index + 1}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Link
                    to={`/samples/${s._id}`}
                    className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-medium text-slate-900 dark:text-white shadow-xs hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition duration-150 cursor-pointer"
                  >
                    <span className="font-mono text-xs text-slate-900 dark:text-white tracking-tight font-semibold">
                      {s.sampleCode}
                    </span>
                    <span className="h-3.5 w-px bg-slate-200 dark:bg-slate-800" />
                    <span
                      className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border"
                      style={{
                        color: getCategoryColor(s.product?.category),
                        backgroundColor: getCategoryColor(s.product?.category) + '12',
                        borderColor: getCategoryColor(s.product?.category) + '25',
                      }}
                    >
                      {s.product?.category || 'No Category'}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-800 dark:text-slate-300">
                    {s.product?.name}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                    {s.batch?.batchCode}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">
                  {s.stabilityType}
                </td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                  {new Date(s.chargingDate).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                  {editingId === s._id ? (
                    <input
                      type="date"
                      value={editForm.expiryDate}
                      onChange={(e) => setEditForm((f) => ({ ...f, expiryDate: e.target.value }))}
                      className="w-32 text-xs rounded-lg border border-slate-200 dark:border-slate-800 px-2 py-1.5 bg-white dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  ) : s.expiryDate ? (
                    new Date(s.expiryDate).toLocaleDateString()
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-semibold">
                  {editingId === s._id ? (
                    <input
                      type="number"
                      min={0}
                      value={editForm.quantity}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, quantity: Number(e.target.value) }))
                      }
                      className="w-20 text-xs rounded-lg border border-slate-200 dark:border-slate-800 px-2 py-1.5 bg-white dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  ) : (
                    s.quantity
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                  {editingId === s._id ? (
                    <input
                      value={editForm.remarks}
                      onChange={(e) => setEditForm((f) => ({ ...f, remarks: e.target.value }))}
                      className="w-28 text-xs rounded-lg border border-slate-200 dark:border-slate-800 px-2 py-1.5 bg-white dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  ) : (
                    s.remarks || '—'
                  )}
                </td>
                <td className="px-4 py-3">
                  <select
                    aria-label={`Status for ${s.sampleCode}`}
                    value={isSampleFullyCompleted(s) ? 'completed' : s.status}
                    onChange={(e) => {
                      const newStatus = e.target.value as Sample['status'];
                      if (newStatus === 'completed' && !isSampleFullyCompleted(s)) {
                        setShowValidationErrorModal(true);
                        return;
                      }
                      setActionError(null);
                      statusMutation.mutate({
                        id: s._id,
                        status: newStatus,
                      });
                    }}
                    className={`rounded-full border-0 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusStyle[isSampleFullyCompleted(s) ? 'completed' : s.status]}`}
                  >
                    {SAMPLE_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
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
                          setEditForm({
                            quantity: s.quantity,
                            remarks: s.remarks || '',
                            expiryDate: s.expiryDate ? s.expiryDate.slice(0, 10) : '',
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
                          cloneMutation.mutate(s._id);
                        }}
                        className={btnGhost}
                      >
                        Clone
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActionError(null);
                          archiveMutation.mutate({ id: s._id, archived: s.isArchived });
                        }}
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

      <Pager data={data} page={page} onPage={setPage} />

      {/* Validation Error Modal */}
      {showValidationErrorModal &&
        createPortal(
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto no-print">
            <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-2xl p-6 border border-slate-200 dark:border-slate-800 flex flex-col text-left space-y-4 animate-menu-fade">
              <div className="flex items-start gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold text-xl">
                  ⚠️
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Cannot mark this test as Completed
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Completion requirements not fulfilled.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                Required testing is still incomplete. Please complete all required month-wise tests and ensure all required results are successful before marking the sample as Completed.
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowValidationErrorModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs hover:bg-slate-800 dark:hover:bg-slate-200 transition cursor-pointer"
                >
                  Understood
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
