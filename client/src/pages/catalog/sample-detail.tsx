import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { catalogApi } from '@/features/catalog/api';
import type { Product, Batch } from '@/features/catalog/types';
import { ErrorBanner, apiErrorMessage, btnGhost, inputClass } from '@/components/ui';

export function SampleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [expiryDateInput, setExpiryDateInput] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  const sampleQuery = useQuery({
    queryKey: ['samples', 'detail', id],
    queryFn: () => catalogApi.samples.get(id!),
    enabled: Boolean(id),
  });

  const updateMutation = useMutation({
    mutationFn: (body: { expiryDate: string | null }) => catalogApi.samples.update(id!, body),
    onSuccess: () => {
      setIsEditingDates(false);
      void queryClient.invalidateQueries({ queryKey: ['samples', 'detail', id] });
      void queryClient.invalidateQueries({ queryKey: ['samples'] });
    },
    onError: (err) => setActionError(apiErrorMessage(err)),
  });

  const sample = sampleQuery.data;

  if (sampleQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-400 dark:text-slate-500 animate-pulse text-sm">
          Loading sample details…
        </div>
      </div>
    );
  }

  if (sampleQuery.isError || !sample) {
    return (
      <div className="space-y-4">
        <ErrorBanner
          message={actionError || 'Failed to load sample details or sample not found.'}
        />
        <button onClick={() => navigate('/samples')} className={btnGhost}>
          ← Back to Samples
        </button>
      </div>
    );
  }

  // Helper to calculate target pull date for each month interval
  const calculateTargetDate = (chargingDateStr: string, intervalMonth: number) => {
    const d = new Date(chargingDateStr);
    d.setMonth(d.getMonth() + intervalMonth);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // Helper to format date string to YYYY-MM-DD
  const formatDateForInput = (dateStr: string | null) => {
    if (!dateStr) return '';
    return dateStr.slice(0, 10);
  };

  const handleStartEdit = () => {
    setExpiryDateInput(formatDateForInput(sample.expiryDate));
    setIsEditingDates(true);
  };

  const handleSaveDates = () => {
    setActionError(null);
    updateMutation.mutate({
      expiryDate: expiryDateInput || null,
    });
  };

  const product = (sample.product && typeof sample.product === 'object'
    ? sample.product
    : null) as unknown as Product | null;
  const batch = (sample.batch && typeof sample.batch === 'object'
    ? sample.batch
    : null) as unknown as Batch | null;

  const exportToPDF = () => {
    window.print();
  };

  const exportToExcel = () => {
    const headers = [
      'Category',
      'Name of the Product',
      'Batch No',
      'Sample Code',
      'Stability Type',
      'Quantity',
      'Mfg Date',
      'Exp Date',
      'Charging',
      '3Month',
      '6Month',
      '9Month',
      '12Month',
      '15Month',
      '18Month',
      '21Month',
      '24Month',
      '27Month',
      '30Month',
      '33Month',
      '36Month',
      'Status',
      'Remarks',
    ];

    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    const formatMMM_YYYY = (dateStr: string | Date | null | undefined) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return `${months[d.getMonth()]}/${d.getFullYear()}`;
    };

    const formatDD_MM_YYYY = (dateStr: string | Date | null | undefined) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const formatMMM_YYYY_Space = (dateStr: string | Date | null | undefined) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return `${months[d.getMonth()]} ${d.getFullYear()}`;
    };

    const calculateTargetPullDate = (chargingDateStr: string, intervalMonth: number) => {
      const d = new Date(chargingDateStr);
      d.setMonth(d.getMonth() + intervalMonth);
      return formatMMM_YYYY_Space(d);
    };

    const escapeCSVCell = (val: string | number | null | undefined) => {
      if (val === null || val === undefined) return '""';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const intervalValues = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36].map((m) => {
      if (sample.intervals.includes(m)) {
        return calculateTargetPullDate(sample.chargingDate, m);
      }
      return '';
    });

    const row = [
      escapeCSVCell(product?.category || ''),
      escapeCSVCell(product?.name || ''),
      escapeCSVCell(batch?.batchNo || batch?.batchCode || ''),
      escapeCSVCell(sample.sampleCode),
      escapeCSVCell(sample.stabilityType),
      escapeCSVCell(sample.quantity),
      escapeCSVCell(formatMMM_YYYY(sample.manufacturingDate)),
      escapeCSVCell(formatMMM_YYYY(sample.expiryDate)),
      escapeCSVCell(formatDD_MM_YYYY(sample.chargingDate)),
      ...intervalValues.map(escapeCSVCell),
      escapeCSVCell(sample.status),
      escapeCSVCell(sample.remarks || ''),
    ];

    const csvRows = [headers.join(','), row.join(',')];
    const csvContent = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Stability_Sample_${sample.sampleCode}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToSVG = () => {
    const width = 800;
    const height = 220;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="background-color: #fafafa; font-family: sans-serif;">`;
    svg += `<rect width="100%" height="100%" fill="#ffffff" rx="8" />`;
    svg += `<text x="30" y="40" font-size="16" font-weight="bold" fill="#0f172a">Stability Study Timeline: ${sample.sampleCode}</text>`;
    svg += `<text x="30" y="60" font-size="12" fill="#64748b">Product: ${product?.name || ''} | Batch: ${batch?.batchCode || ''}</text>`;

    svg += `<line x1="60" y1="130" x2="740" y2="130" stroke="#cbd5e1" stroke-width="4" />`;

    svg += `<circle cx="60" cy="130" r="8" fill="#0f766e" />`;
    svg += `<text x="60" y="110" font-size="10" font-weight="bold" fill="#0f766e" text-anchor="middle">Month 0</text>`;
    svg += `<text x="60" y="155" font-size="9" fill="#0f766e" text-anchor="middle">${new Date(sample.chargingDate).toLocaleDateString()}</text>`;

    const totalPoints = sample.intervals.length;
    sample.intervals.forEach((month, idx) => {
      const cx = 60 + ((idx + 1) * (740 - 60)) / (totalPoints + 1);
      svg += `<circle cx="${cx}" cy="130" r="8" fill="#1e293b" stroke="#38bdf8" stroke-width="2" />`;
      svg += `<text x="${cx}" y="110" font-size="10" font-weight="bold" fill="#1e293b" text-anchor="middle">Month ${month}</text>`;
      svg += `<text x="${cx}" y="155" font-size="9" fill="#64748b" text-anchor="middle">${calculateTargetDate(sample.chargingDate, month)}</text>`;
    });

    svg += `</svg>`;
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    const link = document.createElement('a');
    link.href = svgUrl;
    link.download = `Stability_Timeline_${sample.sampleCode}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 text-left" id="printable-area">
      <style>{`
        @keyframes menuFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-menu-fade {
          animation: menuFadeIn 0.15s ease-out forwards;
        }
        @media print {
          /* Hide non-printable elements */
          header,
          nav,
          .no-print,
          .no-print * {
            display: none !important;
          }

          /* Reset layout containers to allow full-width natural document flow */
          html, body {
            background: #fff !important;
            color: #000 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            font-family: system-ui, -apple-system, sans-serif !important;
          }

          /* Force min-h-screen wrapper to expand and remove its background */
          .min-h-screen {
            min-height: auto !important;
            background: transparent !important;
          }

          /* Reset main flex wrapper and limiters */
          .mx-auto.flex.max-w-6xl {
            display: block !important;
            max-width: none !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          main {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
          }

          #printable-area {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            overflow: visible !important;
          }

          /* Ensure table scrolls are turned off and all contents are visible */
          .overflow-x-auto,
          .overflow-hidden {
            overflow: visible !important;
            overflow-x: visible !important;
          }

          table {
            width: 100% !important;
            table-layout: auto !important;
            border-collapse: collapse !important;
          }

          th, td {
            padding: 6px 4px !important;
            word-break: break-word !important;
            white-space: normal !important;
            font-size: 10px !important;
          }

          th {
            background-color: #f8fafc !important;
            color: #334155 !important;
            font-weight: 700 !important;
          }

          @page {
            size: portrait;
            margin: 10mm;
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div className="space-y-1">
          <Link
            to="/samples"
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-300 flex items-center gap-1 transition no-print"
          >
            ← Back to Samples list
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Study Protocol: {sample.sampleCode}
            </h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                sample.status === 'completed'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30'
                  : sample.status === 'running'
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50'
              }`}
            >
              {sample.status}
            </span>
          </div>
        </div>

        {/* Download Menu */}
        <div className="relative no-print">
          <button
            onClick={() => setShowDownloadMenu(!showDownloadMenu)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 shadow-sm transition cursor-pointer"
          >
            ⬇️ Export Report options
          </button>
          {showDownloadMenu && (
            <div className="absolute right-0 mt-1.5 w-48 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-lg py-1.5 z-10 animate-menu-fade">
              <button
                onClick={() => {
                  setShowDownloadMenu(false);
                  exportToPDF();
                }}
                className="w-full text-left px-4 py-2.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 transition font-medium"
              >
                📄 Print Protocol Card
              </button>
              <button
                onClick={() => {
                  setShowDownloadMenu(false);
                  exportToExcel();
                }}
                className="w-full text-left px-4 py-2.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 transition font-medium"
              >
                📊 Export as CSV / Excel
              </button>
              <button
                onClick={() => {
                  setShowDownloadMenu(false);
                  exportToSVG();
                }}
                className="w-full text-left px-4 py-2.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 transition font-medium"
              >
                📈 Export timeline SVG
              </button>
            </div>
          )}
        </div>
      </div>

      <ErrorBanner message={actionError} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Side: Product and Batch Cards */}
        <div className="lg:col-span-2 space-y-6">
          {/* Product Details Card */}
          <div className="card-panel space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Product Profile
              </h2>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700/50">
                {product?.category || 'No Category'}
              </span>
            </div>
            {product ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Product Name
                  </span>
                  <span className="text-sm font-bold text-slate-850 dark:text-slate-200">
                    {product.name}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Product Code
                  </span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-300 font-mono">
                    {product.code}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Dosage Form
                  </span>
                  <span className="text-sm text-slate-750 dark:text-slate-300">
                    {product.dosageForm || '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Strength
                  </span>
                  <span className="text-sm text-slate-755 dark:text-slate-300">
                    {product.strength || '—'}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Chamber Conditions
                  </span>
                  <span className="text-sm text-slate-755 dark:text-slate-300 font-semibold">
                    {product.storageConditions || '—'}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Description
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    {product.description || 'No description provided.'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">No product details available.</p>
            )}
          </div>

          {/* Batch Details Card */}
          <div className="card-panel space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Batch Specifications
              </h2>
            </div>
            {batch ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Batch Code
                  </span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white font-mono">
                    {batch.batchCode}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Batch Number
                  </span>
                  <span className="text-sm font-semibold text-slate-850 dark:text-slate-200 font-mono">
                    {batch.batchNo || '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Batch Mfg. Date
                  </span>
                  <span className="text-sm text-slate-755 dark:text-slate-300">
                    {batch.manufacturingDate
                      ? new Date(batch.manufacturingDate).toLocaleDateString()
                      : '—'}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Notes
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    {batch.notes || 'No batch notes recorded.'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">No batch details available.</p>
            )}
          </div>

          {/* Stability Testing Schedule (Intervals) */}
          <div className="card-panel space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Stability Testing Schedule ({sample.stabilityType})
              </h2>
            </div>
            <div className="table-container">
              <table className="table-admin">
                <thead>
                  <tr>
                    <th className="px-4 py-2">Interval</th>
                    <th className="px-4 py-2">Target Pull Date</th>
                    <th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sample.intervals.map((month) => {
                    const targetDateObj = new Date(sample.chargingDate);
                    targetDateObj.setMonth(targetDateObj.getMonth() + month);
                    // Compare target date (midnight of that day) with current date
                    const isPassed = targetDateObj.getTime() <= Date.now();

                    return (
                      <tr key={month}>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                          Month {month}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                          {calculateTargetDate(sample.chargingDate, month)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              isPassed
                                ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30'
                                : 'bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/30'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${isPassed ? 'bg-emerald-500' : 'bg-blue-500'}`}
                            />
                            {isPassed ? 'PASSED' : 'UPCOMING'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side: Sample Metadata & Expiry Updates */}
        <div className="space-y-6">
          <div className="card-panel space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Study Metadata</h2>
            </div>
            <div className="space-y-4 text-sm">
              <div>
                <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Stability Study Type
                </span>
                <span className="font-bold text-slate-800 dark:text-white uppercase tracking-wide text-xs">
                  {sample.stabilityType}
                </span>
              </div>
              <div>
                <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Quantity
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {sample.quantity} Units
                </span>
              </div>
              <hr className="border-slate-100 dark:border-slate-800" />
              <div>
                <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Mfg. Date
                </span>
                <span className="text-slate-800 dark:text-slate-300 font-medium">
                  {new Date(sample.manufacturingDate).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Charging Date
                </span>
                <span className="text-slate-800 dark:text-slate-300 font-medium">
                  {new Date(sample.chargingDate).toLocaleDateString()}
                </span>
              </div>
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Expiry Date
                  </span>
                  {!isEditingDates && (
                    <button
                      onClick={handleStartEdit}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 font-bold cursor-pointer"
                    >
                      Update
                    </button>
                  )}
                </div>
                {isEditingDates ? (
                  <div className="space-y-2">
                    <input
                      type="date"
                      value={expiryDateInput}
                      onChange={(e) => setExpiryDateInput(e.target.value)}
                      className={inputClass}
                    />
                    <div className="flex justify-end gap-1.5 pt-1">
                      <button
                        onClick={() => setIsEditingDates(false)}
                        className="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveDates}
                        disabled={updateMutation.isPending}
                        className="rounded-lg bg-blue-605 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                      >
                        {updateMutation.isPending ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <span className="block text-sm font-bold text-slate-800 dark:text-white">
                    {sample.expiryDate
                      ? new Date(sample.expiryDate).toLocaleDateString()
                      : 'Not Set (Pending measurement)'}
                  </span>
                )}
              </div>
              <div>
                <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Remarks / Conditions
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-400 italic mt-0.5 leading-relaxed">
                  {sample.remarks || 'No remarks added.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
