import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { catalogApi } from '@/features/catalog/api';
import {
  SAMPLE_STATUSES,
  STABILITY_TYPES,
  type Sample,
  type IntervalTest,
} from '@/features/catalog/types';
import { useAuth } from '@/features/auth/auth-context';
import { ErrorBanner, apiErrorMessage, btnGhost, btnPrimary, inputClass } from '@/components/ui';

const statusColors: Record<Sample['status'], string> = {
  registered: 'bg-slate-100 text-slate-700 border-slate-200',
  running: 'bg-blue-50 text-blue-700 border-blue-100',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
};

export function RecordsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // State Management
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Combined Advanced Filters
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterChamber, setFilterChamber] = useState<string>('');
  const [filterInterval, setFilterInterval] = useState<string>('');
  const [filterMfgDate, setFilterMfgDate] = useState<string>('');
  const [filterExpDate, setFilterExpDate] = useState<string>('');
  const [filterChargeDate, setFilterChargeDate] = useState<string>('');
  const [filterSampleId, setFilterSampleId] = useState<string>('');
  const [filterProdCode, setFilterProdCode] = useState<string>('');
  const [filterBatchCode, setFilterBatchCode] = useState<string>('');

  // Sort and pagination states
  const [sortField, setSortField] = useState<string>('sampleCode');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  // Dialog States
  const [selectedSample, setSelectedSample] = useState<Sample | null>(null);
  const [editingSample, setEditingSample] = useState<Sample | null>(null);
  const [editForm, setEditForm] = useState({
    quantity: 0,
    remarks: '',
    status: 'registered' as Sample['status'],
    expiryDate: '',
  });
  const [actionError, setActionError] = useState<string | null>(null);

  // Interval Test Dialog States
  const [intervalTestEdit, setIntervalTestEdit] = useState<{
    sample: Sample;
    interval: number;
  } | null>(null);
  const [testForm, setTestForm] = useState({
    status: 'pending' as IntervalTest['status'],
    reportName: '',
    reportData: '',
  });

  const updateIntervalMutation = useMutation({
    mutationFn: ({
      id,
      interval,
      body,
    }: {
      id: string;
      interval: number;
      body: { status: string; reportName?: string; reportData?: string };
    }) => catalogApi.samples.updateInterval(id, interval, body),
    onSuccess: (updatedSample) => {
      setIntervalTestEdit(null);
      void queryClient.invalidateQueries({ queryKey: ['samples'] });
      setActionError(null);
      if (selectedSample && selectedSample._id === updatedSample._id) {
        setSelectedSample(updatedSample);
      }
    },
    onError: (err) => setActionError(apiErrorMessage(err)),
  });

  const suggestionRef = useRef<HTMLDivElement>(null);

  // AuthCheck
  const canManage = user?.permissions.includes('samples:manage') || false;

  // List queries
  const samplesQuery = useQuery({
    queryKey: [
      'samples',
      'records-paginated',
      currentPage,
      itemsPerPage,
      searchTerm,
      filterStatus,
      filterType,
      filterChamber,
      filterInterval,
      filterMfgDate,
      filterExpDate,
      filterChargeDate,
      filterSampleId,
      filterProdCode,
      filterBatchCode,
      sortField,
      sortDirection,
    ],
    queryFn: () =>
      catalogApi.samples.list({
        page: filterInterval ? 1 : currentPage,
        limit: filterInterval ? 1000 : itemsPerPage,
        search: searchTerm || undefined,
        status: filterStatus || undefined,
        excludeStatus: 'registered',
        stabilityType: filterType || undefined,
        chamber: filterChamber || undefined,
        interval: filterInterval ? Number(filterInterval) : undefined,
        mfgDate: filterMfgDate || undefined,
        expDate: filterExpDate || undefined,
        chargeDate: filterChargeDate || undefined,
        sampleId: filterSampleId || undefined,
        prodCode: filterProdCode || undefined,
        batchCode: filterBatchCode || undefined,
        sortBy: sortField,
        sortOrder: sortDirection,
        archived: false,
      }),
  });

  const productsQuery = useQuery({
    queryKey: ['products', 'records-chambers'],
    queryFn: () => catalogApi.products.list({ limit: 1000 }),
  });

  const suggestionsQuery = useQuery({
    queryKey: ['samples', 'suggestions', searchTerm],
    queryFn: () =>
      catalogApi.samples.list({
        search: searchTerm,
        excludeStatus: 'registered',
        archived: false,
        limit: 10,
      }),
    enabled: Boolean(searchTerm.trim()),
  });

  // Mutations
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Partial<Pick<Sample, 'quantity' | 'remarks' | 'status' | 'expiryDate'>>;
    }) => catalogApi.samples.update(id, body),
    onSuccess: () => {
      setEditingSample(null);
      void queryClient.invalidateQueries({ queryKey: ['samples'] });
      setActionError(null);
    },
    onError: (err) => setActionError(apiErrorMessage(err)),
  });

  // Suggestion list
  const suggestions = useMemo(() => {
    const items = suggestionsQuery.data?.items || [];
    const matches: string[] = [];
    const term = searchTerm.toLowerCase();

    items.forEach((s) => {
      if (s.sampleCode.toLowerCase().includes(term) && !matches.includes(s.sampleCode)) {
        matches.push(s.sampleCode);
      }
      if (s.product?.name.toLowerCase().includes(term) && !matches.includes(s.product.name)) {
        matches.push(s.product.name);
      }
      if (s.product?.code.toLowerCase().includes(term) && !matches.includes(s.product.code)) {
        matches.push(s.product.code);
      }
      if (s.batch?.batchCode.toLowerCase().includes(term) && !matches.includes(s.batch.batchCode)) {
        matches.push(s.batch.batchCode);
      }
    });

    return matches.slice(0, 8);
  }, [searchTerm, suggestionsQuery.data]);

  // Click outside listener for suggestions
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (suggestionRef.current && !suggestionRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Unique Chambers for filtering options
  const uniqueChambers = useMemo(() => {
    const chambers: string[] = [];
    const products = productsQuery.data?.items || [];
    products.forEach((p) => {
      const cond = p.storageConditions;
      if (cond && !chambers.includes(cond)) {
        chambers.push(cond);
      }
    });
    return chambers;
  }, [productsQuery.data]);

  // Sorted and Paginated samples
  const sortedSamples = useMemo(() => {
    return samplesQuery.data?.items || [];
  }, [samplesQuery.data]);

  const intervalNum = filterInterval ? Number(filterInterval) : null;

  const isIntervalOverdue = (chargingDateStr: string, intervalMonth: number) => {
    const d = new Date(chargingDateStr);
    d.setMonth(d.getMonth() + intervalMonth);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d.getTime() < today.getTime();
  };

  const { dueSamples, testedSamples } = useMemo(() => {
    if (!intervalNum) {
      return { dueSamples: [], testedSamples: [] };
    }
    const due: Sample[] = [];
    const tested: Sample[] = [];

    sortedSamples.forEach((s) => {
      const test = s.intervalTests?.find((it) => it.interval === intervalNum);
      if (test && test.status === 'completed') {
        tested.push(s);
      } else {
        due.push(s);
      }
    });

    return { dueSamples: due, testedSamples: tested };
  }, [sortedSamples, intervalNum]);

  const overdueCount = useMemo(() => {
    if (!intervalNum) return 0;
    return dueSamples.filter((s) => isIntervalOverdue(s.chargingDate, intervalNum)).length;
  }, [dueSamples, intervalNum]);

  const downloadBase64Report = (base64Data: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = base64Data;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const paginatedSamples = sortedSamples;
  const totalItems = samplesQuery.data?.total || 0;
  const totalPages = samplesQuery.data?.totalPages || 1;

  // Page resets when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    filterStatus,
    filterType,
    filterChamber,
    filterInterval,
    filterSampleId,
    filterProdCode,
    filterBatchCode,
    filterMfgDate,
    filterExpDate,
    filterChargeDate,
  ]);

  // Open filters automatically if any filter has a value
  useEffect(() => {
    if (
      filterStatus ||
      filterType ||
      filterChamber ||
      filterInterval ||
      filterMfgDate ||
      filterExpDate ||
      filterChargeDate ||
      filterSampleId ||
      filterProdCode ||
      filterBatchCode
    ) {
      setShowFilters(true);
    }
  }, [
    filterStatus,
    filterType,
    filterChamber,
    filterInterval,
    filterMfgDate,
    filterExpDate,
    filterChargeDate,
    filterSampleId,
    filterProdCode,
    filterBatchCode,
  ]);

  // Reset all filters
  const resetFilters = () => {
    setSearchTerm('');
    setFilterStatus('');
    setFilterType('');
    setFilterChamber('');
    setFilterInterval('');
    setFilterMfgDate('');
    setFilterExpDate('');
    setFilterChargeDate('');
    setFilterSampleId('');
    setFilterProdCode('');
    setFilterBatchCode('');
  };

  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string; reset: () => void }[] = [];
    if (filterStatus)
      chips.push({
        key: 'status',
        label: `Status: ${filterStatus}`,
        reset: () => setFilterStatus(''),
      });
    if (filterType)
      chips.push({
        key: 'type',
        label: `Condition: ${filterType}`,
        reset: () => setFilterType(''),
      });
    if (filterChamber)
      chips.push({
        key: 'chamber',
        label: `Chamber: ${filterChamber}`,
        reset: () => setFilterChamber(''),
      });
    if (filterInterval)
      chips.push({
        key: 'interval',
        label: `Month ${filterInterval}`,
        reset: () => setFilterInterval(''),
      });
    if (filterSampleId)
      chips.push({
        key: 'sampleId',
        label: `ID: ${filterSampleId}`,
        reset: () => setFilterSampleId(''),
      });
    if (filterProdCode)
      chips.push({
        key: 'prodCode',
        label: `Prod: ${filterProdCode}`,
        reset: () => setFilterProdCode(''),
      });
    if (filterBatchCode)
      chips.push({
        key: 'batchCode',
        label: `Batch: ${filterBatchCode}`,
        reset: () => setFilterBatchCode(''),
      });
    if (filterMfgDate)
      chips.push({ key: 'mfg', label: `Mfg: ${filterMfgDate}`, reset: () => setFilterMfgDate('') });
    if (filterExpDate)
      chips.push({ key: 'exp', label: `Exp: ${filterExpDate}`, reset: () => setFilterExpDate('') });
    if (filterChargeDate)
      chips.push({
        key: 'charge',
        label: `Charged: ${filterChargeDate}`,
        reset: () => setFilterChargeDate(''),
      });
    return chips;
  }, [
    filterStatus,
    filterType,
    filterChamber,
    filterInterval,
    filterSampleId,
    filterProdCode,
    filterBatchCode,
    filterMfgDate,
    filterExpDate,
    filterChargeDate,
  ]);

  // Sort helper
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Date converters
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
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return `${months[d.getMonth()]}/${d.getFullYear()}`;
  };

  const formatDD_MM_YYYY = (dateStr: string | Date | null | undefined) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
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

  // Excel XML Export (Pivoted horizontally with auto-fitted widths)
  const exportExcelReport = async () => {
    try {
      setActionError(null);
      const data = await catalogApi.samples.list({
        limit: 10000,
        search: searchTerm || undefined,
        status: filterStatus || undefined,
        excludeStatus: 'registered',
        stabilityType: filterType || undefined,
        chamber: filterChamber || undefined,
        interval: filterInterval ? Number(filterInterval) : undefined,
        mfgDate: filterMfgDate || undefined,
        expDate: filterExpDate || undefined,
        chargeDate: filterChargeDate || undefined,
        sampleId: filterSampleId || undefined,
        prodCode: filterProdCode || undefined,
        batchCode: filterBatchCode || undefined,
        sortBy: sortField,
        sortOrder: sortDirection,
        archived: false,
      });

      const exportSamples = data.items;
      if (exportSamples.length === 0) {
        setActionError('No records to export');
        return;
      }

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

      const escapeXML = (val: string | number | null | undefined) => {
        if (val === null || val === undefined) return '';
        return String(val)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');
      };

      const allRowValues: any[][] = [];

      exportSamples.forEach((s) => {
        const intervalValues = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36].map((m) => {
          if (s.intervals?.includes(m)) {
            return calculateTargetPullDate(s.chargingDate, m);
          }
          return '';
        });

        const row = [
          s.product?.category || '',
          s.product?.name || '',
          (s.batch as any)?.batchNo || s.batch?.batchCode || '',
          s.sampleCode,
          s.stabilityType,
          s.quantity,
          formatMMM_YYYY(s.manufacturingDate),
          formatMMM_YYYY(s.expiryDate),
          formatDD_MM_YYYY(s.chargingDate),
          ...intervalValues,
          s.status,
          s.remarks || '',
        ];
        allRowValues.push(row);
      });

      const colWidths = headers.map((header, colIdx) => {
        const headerLen = header.length;
        let maxValLen = 0;
        allRowValues.forEach((row) => {
          const valLen = String(row[colIdx] || '').length;
          if (valLen > maxValLen) maxValLen = valLen;
        });
        const maxLen = Math.max(headerLen, maxValLen);
        return Math.max(50, maxLen * 7.5 + 16);
      });

      let xmlContent = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="Stability Study Report">
  <Table>\n`;

      colWidths.forEach((width) => {
        xmlContent += `   <Column ss:Width="${Math.round(width)}"/>\n`;
      });

      xmlContent += `   <Row ss:Height="22">\n`;
      headers.forEach((h) => {
        xmlContent += `    <Cell><Data ss:Type="String">${escapeXML(h)}</Data></Cell>\n`;
      });
      xmlContent += `   </Row>\n`;

      allRowValues.forEach((row) => {
        xmlContent += `   <Row ss:Height="20">\n`;
        row.forEach((val) => {
          const isNum = typeof val === 'number';
          const type = isNum ? 'Number' : 'String';
          xmlContent += `    <Cell><Data ss:Type="${type}">${escapeXML(val)}</Data></Cell>\n`;
        });
        xmlContent += `   </Row>\n`;
      });

      xmlContent += `  </Table>\n </Worksheet>\n</Workbook>`;

      const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Stability_Study_Records.xls`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setActionError(apiErrorMessage(err));
    }
  };

  // CSV Export
  const exportCSVReport = async () => {
    try {
      setActionError(null);
      const data = await catalogApi.samples.list({
        limit: 10000,
        search: searchTerm || undefined,
        status: filterStatus || undefined,
        excludeStatus: 'registered',
        stabilityType: filterType || undefined,
        chamber: filterChamber || undefined,
        interval: filterInterval ? Number(filterInterval) : undefined,
        mfgDate: filterMfgDate || undefined,
        expDate: filterExpDate || undefined,
        chargeDate: filterChargeDate || undefined,
        sampleId: filterSampleId || undefined,
        prodCode: filterProdCode || undefined,
        batchCode: filterBatchCode || undefined,
        sortBy: sortField,
        sortOrder: sortDirection,
        archived: false,
      });

      const exportSamples = data.items;
      if (exportSamples.length === 0) {
        setActionError('No records to export');
        return;
      }

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

      const escapeCSVCell = (val: string | number | null | undefined) => {
        if (val === null || val === undefined) return '""';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const csvRows: string[] = [];
      csvRows.push(headers.join(','));

      exportSamples.forEach((s) => {
        const intervalValues = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36].map((m) => {
          if (s.intervals?.includes(m)) {
            return calculateTargetPullDate(s.chargingDate, m);
          }
          return '';
        });

        const row = [
          escapeCSVCell(s.product?.category || ''),
          escapeCSVCell(s.product?.name || ''),
          escapeCSVCell((s.batch as any)?.batchNo || s.batch?.batchCode || ''),
          escapeCSVCell(s.sampleCode),
          escapeCSVCell(s.stabilityType),
          escapeCSVCell(s.quantity),
          escapeCSVCell(formatMMM_YYYY(s.manufacturingDate)),
          escapeCSVCell(formatMMM_YYYY(s.expiryDate)),
          escapeCSVCell(formatDD_MM_YYYY(s.chargingDate)),
          ...intervalValues.map(escapeCSVCell),
          escapeCSVCell(s.status),
          escapeCSVCell(s.remarks || ''),
        ];
        csvRows.push(row.join(','));
      });

      const csvContent = '\uFEFF' + csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Stability_Study_Records.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setActionError(apiErrorMessage(err));
    }
  };

  // PDF Print dialog
  const printTable = () => {
    window.print();
  };

  const handleEditClick = (sample: Sample) => {
    setEditingSample(sample);
    setActionError(null);
    setEditForm({
      quantity: sample.quantity,
      remarks: sample.remarks || '',
      status: sample.status,
      expiryDate: sample.expiryDate ? sample.expiryDate.slice(0, 10) : '',
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSample) return;
    setActionError(null);
    updateMutation.mutate({
      id: editingSample._id,
      body: {
        quantity: editForm.quantity,
        remarks: editForm.remarks,
        status: editForm.status,
        expiryDate: editForm.expiryDate || null,
      },
    });
  };

  const renderActions = (s: Sample) => {
    const test = s.intervalTests?.find((it) => it.interval === intervalNum);
    return (
      <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
        {/* View Details */}
        <button
          type="button"
          onClick={() => setSelectedSample(s)}
          className="px-2 py-1 rounded-md text-[11px] font-semibold text-slate-700 border border-slate-300 bg-white hover:bg-slate-50 transition cursor-pointer"
          title="View Details"
        >
          View
        </button>

        {/* Update Test Status */}
        {canManage && (
          <button
            type="button"
            onClick={() => {
              setIntervalTestEdit({ sample: s, interval: intervalNum! });
              setTestForm({
                status: test?.status || 'pending',
                reportName: test?.reportName || '',
                reportData: test?.reportData || '',
              });
            }}
            className="px-2 py-1 rounded-md text-[11px] font-semibold text-blue-700 border border-blue-200 bg-blue-50/40 hover:bg-blue-50 transition cursor-pointer"
            title="Update Test Status"
          >
            Status
          </button>
        )}

        {/* Upload Test Report */}
        {canManage && (
          <button
            type="button"
            onClick={() => {
              setIntervalTestEdit({ sample: s, interval: intervalNum! });
              setTestForm({
                status: 'completed',
                reportName: test?.reportName || '',
                reportData: test?.reportData || '',
              });
              setTimeout(() => {
                const fileInput = document.getElementById('report-file-input');
                if (fileInput) fileInput.click();
              }, 100);
            }}
            className="px-2 py-1 rounded-md text-[11px] font-semibold text-indigo-700 border border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50 transition cursor-pointer"
            title="Upload Report"
          >
            Upload
          </button>
        )}

        {/* Download Report */}
        {test?.reportData ? (
          <button
            type="button"
            onClick={() =>
              downloadBase64Report(
                test.reportData!,
                test.reportName || `Report_M${intervalNum}_${s.sampleCode}`,
              )
            }
            className="px-2 py-1 rounded-md text-[11px] font-semibold text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-50 transition cursor-pointer"
            title="Download Report"
          >
            Download
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="px-2 py-1 rounded-md text-[11px] font-semibold text-slate-400 border border-slate-200 bg-slate-50 cursor-not-allowed opacity-50"
            title="No Report Uploaded"
          >
            Download
          </button>
        )}
      </div>
    );
  };

  const renderSampleTable = (samplesList: Sample[], isTestedSection: boolean) => {
    return (
      <div className="table-container max-h-[600px] overflow-y-auto">
        <table className="table-admin">
          <thead className="sticky top-0 z-10 select-none">
            <tr>
              <th className="px-4 py-3.5">S.N.</th>
              <th className="px-4 py-3.5 whitespace-nowrap">Sample ID</th>
              <th className="px-4 py-3.5">Category</th>
              <th className="px-4 py-3.5">Product</th>
              <th className="px-4 py-3.5">Batch No</th>
              <th className="px-4 py-3.5">Chamber Conditions</th>
              <th className="px-4 py-3.5">Charging Date</th>
              <th className="px-4 py-3.5">Target Pull Date</th>
              {isTestedSection && <th className="px-4 py-3.5">Tested Date</th>}
              <th className="px-4 py-3.5">Test Status</th>
              <th className="px-4 py-3.5 text-right no-print">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {samplesList.length === 0 ? (
              <tr>
                <td
                  colSpan={isTestedSection ? 11 : 10}
                  className="px-4 py-8 text-center text-slate-400 font-medium italic"
                >
                  No samples in this section.
                </td>
              </tr>
            ) : (
              samplesList.map((s, index) => {
                const test = s.intervalTests?.find((it) => it.interval === intervalNum);
                const isOverdue =
                  !isTestedSection && isIntervalOverdue(s.chargingDate, intervalNum!);
                const targetPullDateStr = calculateTargetPullDate(s.chargingDate, intervalNum!);

                return (
                  <tr
                    key={s._id}
                    onClick={() => setSelectedSample(s)}
                    className="hover:bg-slate-50/90 hover:translate-x-0.5 hover:shadow-2xs transition-all duration-200 cursor-pointer odd:bg-slate-50/20"
                  >
                    <td className="px-4 py-3.5 text-slate-500 font-medium">{index + 1}</td>
                    <td className="px-4 py-3.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {s.sampleCode}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap font-medium">
                      {s.product?.category || '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-800">{s.product?.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                        {s.product?.code}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap font-medium">
                      {(s.batch as any)?.batchNo || s.batch?.batchCode || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 italic">
                      {s.product?.storageConditions || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap font-medium">
                      {formatDD_MM_YYYY(s.chargingDate)}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap font-medium">
                      <span className={isOverdue ? 'text-rose-600 font-bold' : 'text-slate-700'}>
                        {targetPullDateStr}
                      </span>
                      {isOverdue && (
                        <span className="ml-1.5 inline-block bg-rose-50 border border-rose-200 text-[9px] font-extrabold uppercase text-rose-600 px-1 py-0.25 rounded">
                          Overdue
                        </span>
                      )}
                    </td>
                    {isTestedSection && (
                      <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap font-medium">
                        {test?.testedAt ? formatDD_MM_YYYY(test.testedAt) : '—'}
                      </td>
                    )}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {isTestedSection ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border-emerald-100">
                          Tested
                        </span>
                      ) : test?.status === 'in_progress' ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border-blue-100">
                          In Progress
                        </span>
                      ) : (
                        <span className="inline-block px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border-amber-100">
                          Pending
                        </span>
                      )}
                    </td>
                    <td
                      className="px-4 py-3.5 text-right whitespace-nowrap no-print"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {renderActions(s)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderSummarySection = () => {
    if (!intervalNum) return null;

    const scheduled = sortedSamples.length;
    const tested = testedSamples.length;
    const pending = dueSamples.length;
    const overdue = overdueCount;

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-slate-50 border-t border-slate-200 no-print">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-3xs flex items-center gap-3">
          <div className="p-3 bg-slate-100 rounded-lg text-slate-600 text-lg">📅</div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Total Scheduled
            </div>
            <div className="text-xl font-bold text-slate-800">{scheduled}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-3xs flex items-center gap-3">
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600 text-lg">✅</div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Total Tested
            </div>
            <div className="text-xl font-bold text-emerald-700">{tested}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-3xs flex items-center gap-3">
          <div className="p-3 bg-amber-50 rounded-lg text-amber-600 text-lg">⏳</div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Total Pending
            </div>
            <div className="text-xl font-bold text-amber-700">{pending}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-3xs flex items-center gap-3">
          <div
            className={`p-3 rounded-lg text-lg ${overdue > 0 ? 'bg-rose-50 text-rose-600 animate-pulse' : 'bg-slate-100 text-slate-500'}`}
          >
            🚨
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Total Overdue
            </div>
            <div
              className={`text-xl font-bold ${overdue > 0 ? 'text-rose-600' : 'text-slate-800'}`}
            >
              {overdue}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Dynamic print-friendly CSS */}
      <style>{`
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

          /* Scoped printable areas visibility */
          body:not(.print-card-mode) #print-area {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            overflow: visible !important;
          }

          body.print-card-mode #print-card-area {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            overflow: visible !important;
          }

          /* Ensure proper cross-hiding */
          body:not(.print-card-mode) #print-card-area {
            display: none !important;
          }
          body.print-card-mode #print-area {
            display: none !important;
          }

          /* Override scrolling wrappers so table expands to page width */
          .overflow-x-auto,
          .overflow-hidden {
            overflow: visible !important;
            overflow-x: visible !important;
          }

          /* Formatting the table to look premium and fit on portrait / landscape */
          table {
            width: 100% !important;
            table-layout: auto !important;
            border-collapse: collapse !important;
            page-break-inside: auto !important;
          }

          tr {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }

          thead {
            display: table-header-group !important; /* repeat headers on multi-page print */
          }

          th, td {
            font-size: 8.5px !important;
            padding: 6px 4px !important;
            word-break: break-word !important;
            white-space: normal !important;
            border-bottom: 1px solid #e2e8f0 !important;
          }

          th {
            background-color: #f8fafc !important;
            color: #334155 !important;
            font-weight: 700 !important;
          }

          /* Format status badges for black and white printing */
          span.inline-block {
            background-color: #f1f5f9 !important;
            border: 1px solid #cbd5e1 !important;
            color: #1e293b !important;
            padding: 2px 6px !important;
            font-size: 8px !important;
            border-radius: 4px !important;
          }

          /* Named pages for controlling orientation dynamically */
          #print-area {
            page: landscape-page;
          }

          #print-card-area {
            page: portrait-page;
          }

          @page landscape-page {
            size: landscape;
            margin: 8mm 10mm;
          }

          @page portrait-page {
            size: portrait;
            margin: 10mm;
          }
        }
      `}</style>

      {/* Header and top controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-4 no-print">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            Stability Study Records
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Centralized registry, analytical search, and compliance history logs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Export Buttons */}
          <button
            onClick={exportExcelReport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition cursor-pointer"
          >
            📊 Excel (.xls)
          </button>
          <button
            onClick={exportCSVReport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition cursor-pointer"
          >
            📄 CSV
          </button>
          <button
            onClick={printTable}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition cursor-pointer"
          >
            🖨️ PDF / Print
          </button>
        </div>
      </div>

      <ErrorBanner message={actionError} />

      {/* Search and Autocomplete Panel */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs hover:shadow-md transition-shadow duration-300 space-y-4 no-print">
        <div className="flex flex-col md:flex-row gap-3 items-stretch">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search by Product Name, Code, Batch Code, or Sample Code..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              className="mt-0 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 pl-10 pr-4 py-2.5 text-sm shadow-xs focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 transition-all duration-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
            {/* Auto-suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div
                ref={suggestionRef}
                className="absolute left-0 mt-1.5 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg py-1.5 z-20"
              >
                {suggestions.map((item) => (
                  <button
                    key={item}
                    onClick={() => {
                      setSearchTerm(item);
                      setShowSuggestions(false);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 font-medium transition"
                  >
                    💡 {item}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border text-xs font-semibold shadow-xs transition duration-200 cursor-pointer whitespace-nowrap ${
                showFilters
                  ? 'bg-slate-900 dark:bg-slate-700 border-slate-900 dark:border-slate-600 text-white'
                  : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              ⚙️ {showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
            {(searchTerm || activeFilterChips.length > 0) && (
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-100/60 shadow-xs transition duration-200 cursor-pointer whitespace-nowrap"
              >
                🧹 Reset
              </button>
            )}
          </div>
        </div>

        {/* Multi-Criteria Filters grid */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs animate-menu-fade">
            <div className="space-y-1">
              <label className="block font-semibold text-slate-600">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full rounded-lg border-slate-300 shadow-2xs py-2 px-3 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 bg-white transition duration-150"
              >
                <option value="">All Statuses</option>
                {SAMPLE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block font-semibold text-slate-600">Stability Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full rounded-lg border-slate-300 shadow-2xs py-2 px-3 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 bg-white transition duration-150"
              >
                <option value="">All Conditions</option>
                {STABILITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block font-semibold text-slate-600">Chamber/Condition</label>
              <select
                value={filterChamber}
                onChange={(e) => setFilterChamber(e.target.value)}
                className="w-full rounded-lg border-slate-300 shadow-2xs py-2 px-3 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 bg-white transition duration-150"
              >
                <option value="">All Chambers</option>
                {uniqueChambers.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block font-semibold text-slate-600">Testing Interval</label>
              <select
                value={filterInterval}
                onChange={(e) => setFilterInterval(e.target.value)}
                className="w-full rounded-lg border-slate-300 shadow-2xs py-2 px-3 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 bg-white transition duration-150"
              >
                <option value="">All Intervals</option>
                {[3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36].map((i) => (
                  <option key={i} value={i}>
                    Month {i}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block font-semibold text-slate-600">Mfg Date</label>
              <input
                type="date"
                value={filterMfgDate}
                onChange={(e) => setFilterMfgDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-1.5 px-3 bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-semibold text-slate-600">Exp Date</label>
              <input
                type="date"
                value={filterExpDate}
                onChange={(e) => setFilterExpDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-1.5 px-3 bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-semibold text-slate-600">Charging Date</label>
              <input
                type="date"
                value={filterChargeDate}
                onChange={(e) => setFilterChargeDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-1.5 px-3 bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-semibold text-slate-600">Sample ID</label>
              <input
                type="text"
                placeholder="e.g. STB-2026"
                value={filterSampleId}
                onChange={(e) => setFilterSampleId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-2 px-3 bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-semibold text-slate-600">Product Code</label>
              <input
                type="text"
                placeholder="e.g. PARA-500"
                value={filterProdCode}
                onChange={(e) => setFilterProdCode(e.target.value.toUpperCase())}
                style={{ textTransform: 'uppercase' }}
                className="w-full rounded-lg border border-slate-300 py-2 px-3 bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-semibold text-slate-600">Batch Code</label>
              <input
                type="text"
                placeholder="e.g. B2026"
                value={filterBatchCode}
                onChange={(e) => setFilterBatchCode(e.target.value.toUpperCase())}
                style={{ textTransform: 'uppercase' }}
                className="w-full rounded-lg border border-slate-300 py-2 px-3 bg-white"
              />
            </div>
          </div>
        )}

        {/* Combined Filter Chips */}
        {activeFilterChips.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
            {activeFilterChips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 border border-slate-200/80 shadow-2xs hover:border-slate-300 transition duration-150 cursor-pointer"
              >
                {chip.label}
                <button
                  onClick={chip.reset}
                  className="text-slate-400 hover:text-slate-600 font-extrabold text-[10px] pl-0.5 hover:scale-110 transition duration-150"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Main Records Table Area */}
      <div
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden"
        id="print-area"
      >
        {/* Print Only Title */}
        <div className="hidden print:block p-6 border-b border-slate-200 dark:border-slate-800">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            ESMS - Stability Studies Records List
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Generated: {new Date().toLocaleDateString()}
          </p>
        </div>

        {filterInterval ? (
          <div className="space-y-8 p-6">
            {/* 1. Currently Due for Testing */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Samples Currently Due for Testing (Month {filterInterval})
                </h2>
                <span className="inline-flex items-center rounded-md bg-amber-50 dark:bg-amber-950/50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300 ring-1 ring-inset ring-amber-600/20">
                  {dueSamples.length}
                </span>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs bg-white dark:bg-slate-900">
                {samplesQuery.isLoading ? (
                  <div className="px-4 py-8 text-center text-slate-400 font-medium">
                    Loading stability records…
                  </div>
                ) : (
                  renderSampleTable(dueSamples, false)
                )}
              </div>
            </div>

            {/* 2. Already Tested */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Samples Already Tested (Month {filterInterval})
                </h2>
                <span className="inline-flex items-center rounded-md bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 ring-1 ring-inset ring-emerald-600/20">
                  {testedSamples.length}
                </span>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs bg-white dark:bg-slate-900">
                {samplesQuery.isLoading ? (
                  <div className="px-4 py-8 text-center text-slate-400 font-medium">
                    Loading stability records…
                  </div>
                ) : (
                  renderSampleTable(testedSamples, true)
                )}
              </div>
            </div>

            {/* 3. Summary Section */}
            {renderSummarySection()}
          </div>
        ) : (
          <>
            <div className="table-container max-h-[600px] overflow-y-auto">
              <table className="table-admin">
                <thead className="sticky top-0 z-10 select-none">
                  <tr>
                    <th className="px-4 py-3.5">S.N.</th>
                    <th
                      onClick={() => handleSort('sampleCode')}
                      className="px-4 py-3.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white transition whitespace-nowrap"
                    >
                      Sample ID{' '}
                      {sortField === 'sampleCode' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th className="px-4 py-3.5">Category</th>
                    <th
                      onClick={() => handleSort('productName')}
                      className="px-4 py-3.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white transition whitespace-nowrap"
                    >
                      Product{' '}
                      {sortField === 'productName' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th
                      onClick={() => handleSort('batchCode')}
                      className="px-4 py-3.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white transition whitespace-nowrap"
                    >
                      Batch No{' '}
                      {sortField === 'batchCode' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th className="px-4 py-3.5">Stability Type</th>
                    <th className="px-4 py-3.5">Chamber Conditions</th>
                    <th
                      onClick={() => handleSort('chargingDate')}
                      className="px-4 py-3.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white transition whitespace-nowrap"
                    >
                      Charging Date{' '}
                      {sortField === 'chargingDate' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th
                      onClick={() => handleSort('expiryDate')}
                      className="px-4 py-3.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white transition whitespace-nowrap"
                    >
                      Exp Date{' '}
                      {sortField === 'expiryDate' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th
                      onClick={() => handleSort('status')}
                      className="px-4 py-3.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white transition whitespace-nowrap"
                    >
                      Status {sortField === 'status' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th className="px-4 py-3.5 text-right no-print">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {samplesQuery.isLoading && (
                    <tr>
                      <td colSpan={11} className="px-4 py-8 text-center text-slate-400 font-medium">
                        Loading stability records…
                      </td>
                    </tr>
                  )}
                  {!samplesQuery.isLoading && sortedSamples.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-4 py-8 text-center text-slate-400 font-medium">
                        No stability records matching search criteria.
                      </td>
                    </tr>
                  )}
                  {paginatedSamples.map((s, index) => (
                    <tr
                      key={s._id}
                      onClick={() => setSelectedSample(s)}
                      className="hover:bg-slate-50/90 dark:hover:bg-slate-800/70 hover:translate-x-0.5 hover:shadow-2xs transition-all duration-200 cursor-pointer odd:bg-slate-50/20 dark:odd:bg-slate-800/30"
                    >
                      <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 font-medium">
                        {(currentPage - 1) * itemsPerPage + index + 1}
                      </td>
                      <td className="px-4 py-3.5 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {s.sampleCode}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap font-medium">
                        {s.product?.category || '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {s.product?.name}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-mono">
                          {s.product?.code}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300 whitespace-nowrap font-medium">
                        {(s.batch as any)?.batchNo || s.batch?.batchCode || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                        {s.stabilityType}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300 italic">
                        {s.product?.storageConditions || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap font-medium">
                        {formatDD_MM_YYYY(s.chargingDate)}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap font-medium">
                        {formatMMM_YYYY(s.expiryDate)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${statusColors[s.status]}`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td
                        className="px-4 py-3.5 text-right whitespace-nowrap no-print"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedSample(s)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
                          >
                            View
                          </button>
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => handleEditClick(s)}
                              className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/40 hover:bg-blue-50 dark:hover:bg-blue-900/40 transition cursor-pointer"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            {totalPages > 1 && (
              <div className="border-t border-slate-200 dark:border-slate-800 px-4 py-3 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 no-print">
                <div className="flex items-center gap-4">
                  <span>
                    Showing <b>{currentPage * itemsPerPage - itemsPerPage + 1}</b> to{' '}
                    <b>{Math.min(currentPage * itemsPerPage, totalItems)}</b> of <b>{totalItems}</b>{' '}
                    records
                  </span>
                  <select
                    aria-label="Items per page"
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="rounded border border-slate-300 dark:border-slate-700 px-1 py-0.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-[11px]"
                  >
                    {[10, 15, 25, 50].map((size) => (
                      <option key={size} value={size}>
                        {size} per page
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((c) => c - 1)}
                    className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-slate-700 dark:text-slate-200 disabled:opacity-40 transition font-bold"
                  >
                    ◀ Prev
                  </button>
                  <span className="px-2.5 py-1 font-bold text-slate-800 dark:text-slate-200">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((c) => c + 1)}
                    className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-slate-700 dark:text-slate-200 disabled:opacity-40 transition font-bold"
                  >
                    Next ▶
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* View Detail Dialog Modal overlay */}
      {selectedSample &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto no-print">
            <div className="relative w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-slate-900 shadow-2xl p-6 border border-slate-200 dark:border-slate-800 flex flex-col animate-menu-fade text-slate-900 dark:text-slate-100">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Study Detail Card: {selectedSample.sampleCode}
                </h2>
                <button
                  type="button"
                  onClick={() => setSelectedSample(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-extrabold text-sm"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="col-span-1 sm:col-span-2 p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Category
                    </span>
                    <span className="text-slate-950 dark:text-white font-bold">
                      {selectedSample.product?.category || 'No Category'}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${statusColors[selectedSample.status]}`}
                  >
                    {selectedSample.status}
                  </span>
                </div>

                <div>
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide font-medium">
                    Product Name / Code
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    {selectedSample.product?.name || '—'} ({selectedSample.product?.code || '—'})
                  </span>
                </div>

                <div>
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide font-medium">
                    Batch Code
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {selectedSample.batch?.batchCode || '—'}
                  </span>
                </div>

                <div>
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide font-medium">
                    Stability Type
                  </span>
                  <span className="font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    {selectedSample.stabilityType}
                  </span>
                </div>

                <div>
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide font-medium">
                    Expiry Date
                  </span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {selectedSample.expiryDate
                      ? new Date(selectedSample.expiryDate).toLocaleDateString()
                      : 'N/A'}
                  </span>
                </div>

                <div>
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide font-medium">
                    Storage Condition
                  </span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {selectedSample.product?.storageConditions || '—'}
                  </span>
                </div>

                <div>
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide font-medium">
                    Quantity
                  </span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {selectedSample.quantity} units
                  </span>
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide font-medium">
                    Remarks
                  </span>
                  <p className="text-slate-700 dark:text-slate-300 italic border-l-2 border-slate-200 dark:border-slate-700 pl-2 py-0.5 mt-0.5">
                    {selectedSample.remarks || 'No study remarks log.'}
                  </p>
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide font-semibold mb-2.5">
                    Testing Schedule Plan (Month Progress)
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                    {selectedSample.intervals.map((month, idx) => {
                      const test = selectedSample.intervalTests?.find((t) => t.interval === month);
                      const status = test?.status || 'pending';

                      // Calculate target pull date
                      const targetDate = new Date(selectedSample.chargingDate);
                      targetDate.setMonth(targetDate.getMonth() + month);
                      const targetPullDateStr = formatDD_MM_YYYY(targetDate);

                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const isPast =
                        targetDate.getTime() < today.getTime() && status !== 'completed';

                      // Calculate difference in days
                      const diffTime = targetDate.getTime() - today.getTime();
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                      // Determine styling classes and text for tooltip
                      let colorClasses = '';
                      let statusText = '';
                      let detailText = '';

                      if (status === 'completed') {
                        colorClasses =
                          'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60';
                        statusText = 'Completed';
                        detailText = test?.testedAt
                          ? `Tested on: ${formatDD_MM_YYYY(test.testedAt)}`
                          : 'Completed';
                      } else if (isPast) {
                        colorClasses =
                          'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 animate-pulse';
                        statusText = 'Overdue';
                        detailText = `⚠️ Overdue by ${Math.abs(diffDays)} days`;
                      } else if (status === 'in_progress') {
                        colorClasses =
                          'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60';
                        statusText = 'In Progress';
                        detailText = `⏳ In progress (Due in ${diffDays} days)`;
                      } else {
                        colorClasses =
                          'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700';
                        statusText = 'Pending';
                        detailText = `📅 Upcoming (Due in ${diffDays} days)`;
                      }

                      // Smart popover position to prevent left/right overflow
                      const isLeftEdge = idx % 5 === 0 || idx % 5 === 1;
                      const isRightEdge = idx % 5 === 3 || idx % 5 === 4;

                      const popoverPosClass = isLeftEdge
                        ? 'left-0 translate-x-0'
                        : isRightEdge
                          ? 'right-0 translate-x-0'
                          : 'left-1/2 -translate-x-1/2';

                      const arrowPosClass = isLeftEdge
                        ? 'left-5'
                        : isRightEdge
                          ? 'right-5'
                          : 'left-1/2 -translate-x-1/2';

                      return (
                        <div
                          key={month}
                          className="group relative flex items-center justify-between gap-1.5 bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl p-2 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200"
                        >
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => {
                                setIntervalTestEdit({ sample: selectedSample, interval: month });
                                setTestForm({
                                  status: test?.status || 'pending',
                                  reportName: test?.reportName || '',
                                  reportData: test?.reportData || '',
                                });
                              }}
                              className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold transition-all cursor-pointer shadow-3xs active:scale-95 shrink-0"
                              title="Update status & report"
                            >
                              Action
                            </button>
                          )}
                          <span
                            className={`inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-[11px] font-bold border shadow-3xs transition-all duration-200 cursor-help ${colorClasses}`}
                          >
                            M{month}
                          </span>

                          {/* Premium Glassmorphic Tooltip / Popover */}
                          <div
                            className={`absolute bottom-full z-50 mb-2.5 w-52 scale-0 rounded-xl bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-xs p-3 text-[10px] leading-relaxed text-white opacity-0 transition-all duration-200 ease-out origin-bottom group-hover:scale-100 group-hover:opacity-100 shadow-2xl border border-slate-800 dark:border-slate-700 pointer-events-none ${popoverPosClass}`}
                          >
                            <div className="font-bold text-xs border-b border-slate-700/50 pb-1.5 mb-1.5 flex justify-between items-center">
                              <span>Month {month} Schedule</span>
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase ${
                                  status === 'completed'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : isPast
                                      ? 'bg-rose-500/20 text-rose-300'
                                      : status === 'in_progress'
                                        ? 'bg-blue-500/20 text-blue-300'
                                        : 'bg-slate-500/20 text-slate-300'
                                }`}
                              >
                                {statusText}
                              </span>
                            </div>
                            <div className="space-y-1 text-slate-300 font-medium">
                              <div>
                                <span className="text-slate-400">Target Pull:</span>{' '}
                                {targetPullDateStr}
                              </div>
                              <div>
                                <span className="text-slate-400">State:</span> {detailText}
                              </div>
                              {test?.reportName && (
                                <div className="truncate">
                                  <span className="text-slate-400">Report:</span> 📎{' '}
                                  {test.reportName}
                                </div>
                              )}
                            </div>
                            {/* Tooltip Arrow */}
                            <div
                              className={`absolute top-full h-2 w-2 -translate-y-1 bg-slate-900 border-r border-b border-slate-800 rotate-45 ${arrowPosClass}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    document.body.classList.add('print-card-mode');
                    window.print();
                    document.body.classList.remove('print-card-mode');
                  }}
                  className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs shadow-xs cursor-pointer"
                >
                  🖨️ Print Card
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSample(null)}
                  className="rounded-md bg-slate-900 dark:bg-slate-100 px-4 py-2 font-semibold text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-200 text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Edit Dialog Modal overlay */}
      {editingSample &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto no-print">
            <div className="relative w-[95vw] max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-slate-900 shadow-2xl p-6 border border-slate-200 dark:border-slate-800 flex flex-col animate-menu-fade text-slate-900 dark:text-slate-100">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Edit Study Record: {editingSample.sampleCode}
                </h2>
                <button
                  type="button"
                  onClick={() => setEditingSample(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-extrabold text-sm"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
                <div>
                  <label htmlFor="e-status" className="block font-semibold mb-1">
                    Status
                  </label>
                  <select
                    id="e-status"
                    value={editForm.status}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, status: e.target.value as Sample['status'] }))
                    }
                    className={inputClass}
                  >
                    {SAMPLE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="e-quant" className="block font-semibold mb-1">
                    Quantity
                  </label>
                  <input
                    id="e-quant"
                    type="number"
                    value={editForm.quantity}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, quantity: Number(e.target.value) }))
                    }
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="e-exp" className="block font-semibold mb-1">
                    Expiry Date
                  </label>
                  <input
                    id="e-exp"
                    type="date"
                    value={editForm.expiryDate}
                    onChange={(e) => setEditForm((f) => ({ ...f, expiryDate: e.target.value }))}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="e-obs" className="block font-semibold mb-1">
                    Observations / Remarks
                  </label>
                  <textarea
                    id="e-obs"
                    value={editForm.remarks}
                    onChange={(e) => setEditForm((f) => ({ ...f, remarks: e.target.value }))}
                    className={`${inputClass} h-20 resize-none`}
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                  <button type="button" onClick={() => setEditingSample(null)} className={btnGhost}>
                    Cancel
                  </button>
                  <button type="submit" disabled={updateMutation.isPending} className={btnPrimary}>
                    {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}

      {/* Interval Test Edit Modal overlay */}
      {intervalTestEdit &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto no-print">
            <div className="relative w-[95vw] max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-slate-900 shadow-2xl p-6 border border-slate-200 dark:border-slate-800 flex flex-col animate-menu-fade text-slate-900 dark:text-slate-100">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Update Test: {intervalTestEdit.sample.sampleCode} - Month{' '}
                  {intervalTestEdit.interval}
                </h2>
                <button
                  type="button"
                  onClick={() => setIntervalTestEdit(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-extrabold text-sm"
                >
                  ✕
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  updateIntervalMutation.mutate({
                    id: intervalTestEdit.sample._id,
                    interval: intervalTestEdit.interval,
                    body: testForm,
                  });
                }}
                className="space-y-4 text-xs"
              >
                <div>
                  <label htmlFor="t-status" className="block font-semibold mb-1">
                    Test Status
                  </label>
                  <select
                    id="t-status"
                    value={testForm.status}
                    onChange={(e) =>
                      setTestForm((f) => ({
                        ...f,
                        status: e.target.value as IntervalTest['status'],
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="pending">pending</option>
                    <option value="in_progress">in_progress</option>
                    <option value="completed">completed</option>
                    <option value="missed">missed</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="report-file-input" className="block font-semibold mb-1">
                    Upload Test Report
                  </label>
                  <div className="mt-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100/50 dark:hover:bg-slate-800 transition">
                    <input
                      type="file"
                      id="report-file-input"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            setTestForm((f) => ({
                              ...f,
                              reportName: file.name,
                              reportData: reader.result as string,
                            }));
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <label
                      htmlFor="report-file-input"
                      className="cursor-pointer text-center space-y-1"
                    >
                      <span className="block text-xl">📄</span>
                      <span className="block font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                        {testForm.reportName ? 'Change File' : 'Choose File'}
                      </span>
                      <span className="block text-[10px] text-slate-400 dark:text-slate-500">
                        PDF, Word, or image up to 10MB
                      </span>
                    </label>
                  </div>
                  {testForm.reportName && (
                    <div className="mt-2.5 flex items-center justify-between p-2 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                      <span className="truncate font-medium text-slate-700 dark:text-slate-200 pr-2">
                        📎 {testForm.reportName}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setTestForm((f) => ({ ...f, reportName: '', reportData: '' }))
                        }
                        className="text-red-500 hover:text-red-700 font-bold"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIntervalTestEdit(null)}
                    className={btnGhost}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateIntervalMutation.isPending}
                    className={btnPrimary}
                  >
                    {updateIntervalMutation.isPending ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}

      {/* Print Card Only Area */}
      {selectedSample && (
        <div
          id="print-card-area"
          className="hidden print:block p-8 bg-white text-slate-900 border border-slate-300 rounded-lg max-w-4xl mx-auto"
        >
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-start">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase">
                Stability Study Record Card
              </h1>
              <p className="text-xs text-slate-500 mt-1">Laboratory Information & Compliance Log</p>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-slate-500 uppercase">Printed Date</div>
              <div className="text-xs font-semibold text-slate-800">
                {new Date().toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-xs mb-8">
            <div className="col-span-2 border-b border-slate-100 pb-2 flex justify-between items-center bg-slate-50 p-3 rounded border">
              <div>
                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                  Sample ID
                </span>
                <span className="text-base font-extrabold text-slate-900 font-mono">
                  {selectedSample.sampleCode}
                </span>
              </div>
              <div className="text-right">
                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                  Study Status
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 border px-2 py-0.5 rounded">
                  {selectedSample.status}
                </span>
              </div>
            </div>

            <div className="border-b border-slate-100 pb-2">
              <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                Product Name
              </span>
              <span className="text-xs font-bold text-slate-800">
                {selectedSample.product?.name}
              </span>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                Product Code
              </span>
              <span className="text-xs font-semibold text-slate-800 font-mono">
                {selectedSample.product?.code}
              </span>
            </div>

            <div className="border-b border-slate-100 pb-2">
              <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                Batch Code / No.
              </span>
              <span className="text-xs font-semibold text-slate-800">
                {(selectedSample.batch && (selectedSample.batch as any).batchNo) ||
                  selectedSample.batch?.batchCode ||
                  '—'}
              </span>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                Category
              </span>
              <span className="text-xs font-semibold text-slate-800">
                {selectedSample.product?.category || '—'}
              </span>
            </div>

            <div className="border-b border-slate-100 pb-2">
              <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                Stability Condition Type
              </span>
              <span className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                {selectedSample.stabilityType}
              </span>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                Chamber Conditions
              </span>
              <span className="text-xs font-semibold text-slate-800 italic">
                {selectedSample.product?.storageConditions || '—'}
              </span>
            </div>

            <div className="border-b border-slate-100 pb-2">
              <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                Mfg. Date
              </span>
              <span className="text-xs font-semibold text-slate-800">
                {formatDD_MM_YYYY(selectedSample.manufacturingDate)}
              </span>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                Exp. Date
              </span>
              <span className="text-xs font-semibold text-slate-800">
                {formatDD_MM_YYYY(selectedSample.expiryDate)}
              </span>
            </div>

            <div className="border-b border-slate-100 pb-2">
              <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                Charging Date
              </span>
              <span className="text-xs font-semibold text-slate-800">
                {formatDD_MM_YYYY(selectedSample.chargingDate)}
              </span>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                Quantity Loaded
              </span>
              <span className="text-xs font-semibold text-slate-800">
                {selectedSample.quantity} units
              </span>
            </div>

            <div className="col-span-2 border-b border-slate-100 pb-2">
              <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                Study Remarks Log
              </span>
              <p className="text-xs text-slate-700 italic mt-1 font-serif">
                {selectedSample.remarks || 'No study remarks logged.'}
              </p>
            </div>
          </div>

          {/* Testing Schedule List */}
          <div className="mt-6">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              Stability Testing Schedule & Month Progress
            </h2>
            <table className="min-w-full divide-y divide-slate-200 text-[10px] border border-slate-200/50 dark:border-slate-800/80">
              <thead className="bg-slate-100 dark:bg-slate-800">
                <tr className="text-left font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  <th className="px-4 py-2">Interval</th>
                  <th className="px-4 py-2">Target Pull Date</th>
                  <th className="px-4 py-2">Tested Date</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Report Document</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {selectedSample.intervals.map((month) => {
                  const test = selectedSample.intervalTests?.find((t) => t.interval === month);
                  const status = test?.status || 'pending';

                  const targetDate = new Date(selectedSample.chargingDate);
                  targetDate.setMonth(targetDate.getMonth() + month);
                  const targetPullDateStr = formatDD_MM_YYYY(targetDate);

                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const isPast = targetDate.getTime() < today.getTime() && status !== 'completed';

                  return (
                    <tr key={month} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2 font-bold text-slate-900">Month {month}</td>
                      <td className="px-4 py-2 text-slate-700">{targetPullDateStr}</td>
                      <td className="px-4 py-2 text-slate-700">
                        {test?.testedAt ? formatDD_MM_YYYY(test.testedAt) : '—'}
                      </td>
                      <td className="px-4 py-2 font-semibold">
                        <span
                          className={
                            status === 'completed'
                              ? 'text-emerald-700'
                              : isPast
                                ? 'text-rose-700 font-extrabold'
                                : status === 'in_progress'
                                  ? 'text-blue-700'
                                  : 'text-slate-500'
                          }
                        >
                          {status === 'completed'
                            ? 'Completed'
                            : isPast
                              ? 'Overdue'
                              : status === 'in_progress'
                                ? 'In Progress'
                                : 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-500 italic truncate max-w-[150px]">
                        {test?.reportName ? `📎 ${test.reportName}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Signature Sections for paper compliance */}
          <div className="mt-16 grid grid-cols-2 gap-16 text-center text-xs">
            <div className="border-t border-slate-400 pt-3">
              <span className="block font-semibold text-slate-800">Prepared / Recorded By</span>
              <span className="block text-[10px] text-slate-400 mt-1">Signature & Date</span>
            </div>
            <div className="border-t border-slate-400 pt-3">
              <span className="block font-semibold text-slate-800">Reviewed / Approved By</span>
              <span className="block text-[10px] text-slate-400 mt-1">Signature & Date</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
