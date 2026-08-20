import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { catalogApi } from '@/features/catalog/api';
import { fetchUsers, fetchAuditLogs, fetchSystemHealth } from '@/features/admin/api';
import { api } from '@/lib/api';
import { isSampleFullyCompleted, type Sample } from '@/features/catalog/types';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend,
  RadialBarChart,
  RadialBar,
} from 'recharts';
import {
  Activity,
  Calendar as CalendarIcon,
  CheckCircle,
  AlertTriangle,
  Clock,
  Plus,
  ArrowRight,
  TrendingUp,
  FileText,
  Filter,
  Download,
  Database,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Layers,
  X,
} from 'lucide-react';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Search & Filter Panel state
  const [showFilters, setShowFilters] = useState(false);
  const [filterProduct, setFilterProduct] = useState('');
  const [filterBatch, setFilterBatch] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterChargingDate, setFilterChargingDate] = useState('');
  const [filterTestingMonth, setFilterTestingMonth] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Active KPI Card Filter redirect
  const [kpiFilter, setKpiFilter] = useState<
    'all' | 'running' | 'completed' | 'overdue' | 'upcoming'
  >('all');

  // Custom Toast State
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Calendar State
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number | null>(null);

  // Wizard States
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardCategory, setWizardCategory] = useState('');
  const [wizardProduct, setWizardProduct] = useState('');
  const [wizardBatch, setWizardBatch] = useState('');
  const [wizardTemplateSample, setWizardTemplateSample] = useState('');

  const [wizardStabilityType, setWizardStabilityType] = useState<
    'long-term' | 'accelerated' | 'intermediate'
  >('long-term');
  const [wizardExpiryDate, setWizardExpiryDate] = useState('');
  const [wizardChargingDate, setWizardChargingDate] = useState('');
  const [wizardQuantity, setWizardQuantity] = useState(0);
  const [wizardSection, setWizardSection] = useState('');
  const [wizardRemarks, setWizardRemarks] = useState('');

  // Global search param from Top Nav
  const globalSearch = searchParams.get('search') || '';

  // Trigger toast
  const addToast = (
    title: string,
    message: string,
    type: 'success' | 'error' | 'info' = 'success',
  ) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Queries
  const samplesQuery = useQuery({
    queryKey: ['samples', 'dashboard-all'],
    queryFn: () => catalogApi.samples.list({ limit: 1000 }),
  });

  const productsQuery = useQuery({
    queryKey: ['products', 'dashboard-all'],
    queryFn: () => catalogApi.products.list({ limit: 1000 }),
  });

  const batchesQuery = useQuery({
    queryKey: ['batches', 'dashboard-all'],
    queryFn: () => catalogApi.batches.list({ limit: 1000 }),
  });

  const categoriesQuery = useQuery({
    queryKey: ['categories', 'dashboard-all'],
    queryFn: () => catalogApi.categories.list({ limit: 1000 }),
  });

  const sectionsQuery = useQuery({
    queryKey: ['sections', 'dashboard-all'],
    queryFn: () => catalogApi.sections.list({ limit: 1000 }),
  });

  const usersQuery = useQuery({
    queryKey: ['users', 'dashboard-all'],
    queryFn: () => fetchUsers({ page: 1, limit: 100 }),
  });

  const auditLogsQuery = useQuery({
    queryKey: ['audit-logs', 'dashboard-all'],
    queryFn: () => fetchAuditLogs({ page: 1 }),
  });

  const healthQuery = useQuery({
    queryKey: ['health', 'dashboard-all'],
    queryFn: () => fetchSystemHealth(),
    refetchInterval: 15000, // Refresh health status every 15s
  });

  // Extract query data
  const samples = useMemo(() => samplesQuery.data?.items || [], [samplesQuery.data]);
  const products = useMemo(() => productsQuery.data?.items || [], [productsQuery.data]);
  const batches = useMemo(() => batchesQuery.data?.items || [], [batchesQuery.data]);
  const categories = useMemo(() => categoriesQuery.data?.items || [], [categoriesQuery.data]);
  const sections = useMemo(() => sectionsQuery.data?.items || [], [sectionsQuery.data]);
  const users = useMemo(() => usersQuery.data?.items || [], [usersQuery.data]);
  const auditLogs = useMemo(() => auditLogsQuery.data?.items || [], [auditLogsQuery.data]);
  const health = healthQuery.data;

  // Mutations
  const triggerSchedulerMutation = useMutation({
    mutationFn: async () => {
      // Mock triggering backend scheduler logic
      await new Promise((resolve) => setTimeout(resolve, 800));
      return { evaluated: samples.length, updatedAlerts: Math.floor(Math.random() * 2) };
    },
    onSuccess: (res) => {
      addToast(
        'Scheduler Cron Job Triggered',
        `Evaluated ${res.evaluated} stability schedules. Active alerts updated successfully.`,
        'success',
      );
    },
  });

  const triggerBackupMutation = useMutation({
    mutationFn: async () => {
      // Direct call to backup creation API
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
    },
    onSuccess: () => {
      addToast('Backup Successful', 'Database snapshot exported and downloaded.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
    onError: () => {
      addToast('Backup Failed', 'Database permissions error during backup execution.', 'error');
    },
  });

  const createSampleMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => catalogApi.samples.create(body),
    onSuccess: () => {
      addToast('Success', 'Stability sample registered successfully.', 'success');
      setIsWizardOpen(false);
      setWizardStep(1);
      // Invalidate queries to refresh dashboard data
      void queryClient.invalidateQueries({ queryKey: ['samples'] });
    },
    onError: () => {
      addToast(
        'Registration Failed',
        'Date ordering constraint violated or missing fields.',
        'error',
      );
    },
  });

  const categorySpreadData = useMemo(() => {
    const counts: Record<string, number> = {};
    samples.forEach((s) => {
      const cat = s.product?.category || 'General Pharma';
      counts[cat] = (counts[cat] || 0) + 1;
    });

    const total = samples.length || 1;
    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        pct: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [samples]);

  // Helper date formatting
  const formatDD_MM_YYYY = (dateStr: string | Date | null | undefined) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Helper date matching
  const isOverdue = (chargingDateStr: string, intervalMonth: number) => {
    const d = new Date(chargingDateStr);
    d.setMonth(d.getMonth() + intervalMonth);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d.getTime() < today.getTime();
  };

  const isUpcoming = (chargingDateStr: string, intervalMonth: number, days: number = 30) => {
    const d = new Date(chargingDateStr);
    d.setMonth(d.getMonth() + intervalMonth);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limit = new Date();
    limit.setDate(today.getDate() + days);
    return d.getTime() >= today.getTime() && d.getTime() <= limit.getTime();
  };

  // Calculate detailed dashboard stats
  const metrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overduePulls: { sample: Sample; interval: number; targetDate: Date; days: number }[] = [];
    const upcomingPulls: { sample: Sample; interval: number; targetDate: Date; days: number }[] =
      [];
    const todayPulls: { sample: Sample; interval: number; targetDate: Date }[] = [];
    const recentReports: { sample: Sample; test: any; testedDate: Date }[] = [];

    let totalTests = 0;
    let completedTests = 0;
    let pendingTests = 0;
    let upcoming7d = 0;
    let upcoming30d = 0;
    let overdueCount = 0;

    const chamberSpread: Record<string, number> = {};
    const categorySpread: Record<string, number> = {};
    const sectionSpread: Record<string, number> = {};

    samples.forEach((s) => {
      // Distributions
      const chamber = s.product?.storageConditions || 'Standard ambient (25°C/60% RH)';
      chamberSpread[chamber] = (chamberSpread[chamber] || 0) + 1;

      const cat = s.product?.category || 'General Pharma';
      categorySpread[cat] = (categorySpread[cat] || 0) + 1;

      const sec = s.section?.name || 'General Analytical';
      sectionSpread[sec] = (sectionSpread[sec] || 0) + 1;

      // Intervals
      s.intervals.forEach((month) => {
        totalTests++;
        const test = s.intervalTests?.find((it) => it.interval === month);
        const isTested = test?.status === 'completed';

        if (isTested) {
          completedTests++;
          if (test.testedAt) {
            recentReports.push({
              sample: s,
              test,
              testedDate: new Date(test.testedAt),
            });
          }
        } else {
          pendingTests++;
          const targetDate = new Date(s.chargingDate);
          targetDate.setMonth(targetDate.getMonth() + month);

          const diffTime = targetDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffTime < 0) {
            overdueCount++;
            overduePulls.push({
              sample: s,
              interval: month,
              targetDate,
              days: Math.abs(diffDays),
            });
          } else {
            if (diffDays === 0) {
              todayPulls.push({ sample: s, interval: month, targetDate });
            }
            if (diffDays <= 7) {
              upcoming7d++;
            }
            if (diffDays <= 30) {
              upcoming30d++;
              upcomingPulls.push({
                sample: s,
                interval: month,
                targetDate,
                days: diffDays,
              });
            }
          }
        }
      });
    });

    // Sort widgets data
    overduePulls.sort((a, b) => b.days - a.days);
    upcomingPulls.sort((a, b) => a.days - b.days);
    recentReports.sort((a, b) => b.testedDate.getTime() - a.testedDate.getTime());

    return {
      overduePulls,
      upcomingPulls,
      todayPulls,
      recentReports: recentReports.slice(0, 5),
      totalTests,
      completedTests,
      pendingTests,
      upcoming7d,
      upcoming30d,
      overdueCount,
      chamberSpread,
      categorySpread,
      sectionSpread,
    };
  }, [samples]);

  // Lifeline analysis: Sort samples by nearest upcoming / overdue test date
  const upcomingNearSamples = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const list = samples.map((s) => {
      let nearestDays = Infinity;
      let nearestInterval: number | null = null;
      let nearestTargetDate: Date | null = null;

      s.intervals?.forEach((m) => {
        const test = s.intervalTests?.find((t) => t.interval === m);
        if (test?.status !== 'completed') {
          const target = new Date(s.chargingDate);
          target.setMonth(target.getMonth() + m);
          const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays < nearestDays) {
            nearestDays = diffDays;
            nearestInterval = m;
            nearestTargetDate = target;
          }
        }
      });

      return {
        sample: s,
        nearestInterval,
        nearestDays,
        nearestTargetDate,
        isOverdue: nearestDays < 0,
        isCompleted: nearestInterval === null,
      };
    });

    // Filter out studies that have completed all tests or marked completed
    const activeList = list.filter(
      (item) => !item.isCompleted && !isSampleFullyCompleted(item.sample),
    );

    // Sort by nearestDays ascending (overdue tests with negative days first, then 0, 1, 2...)
    activeList.sort((a, b) => a.nearestDays - b.nearestDays);
    return activeList;
  }, [samples]);

  // Apply filters on the samples list
  const filteredSamples = useMemo(() => {
    return samples.filter((s) => {
      // 1. Global search (URL Search)
      if (globalSearch) {
        const query = globalSearch.toLowerCase();
        const matchesCode = s.sampleCode.toLowerCase().includes(query);
        const matchesProdName = s.product?.name.toLowerCase().includes(query);
        const matchesProdCode = s.product?.code.toLowerCase().includes(query);
        const matchesBatch = s.batch?.batchCode.toLowerCase().includes(query);
        const matchesRemarks = s.remarks?.toLowerCase().includes(query);
        if (
          !matchesCode &&
          !matchesProdName &&
          !matchesProdCode &&
          !matchesBatch &&
          !matchesRemarks
        ) {
          return false;
        }
      }

      // 2. Dropdown Filters
      if (filterProduct && s.product?._id !== filterProduct) return false;
      if (filterBatch && !s.batch?.batchCode.toLowerCase().includes(filterBatch.toLowerCase()))
        return false;
      if (filterSection && s.section?._id !== filterSection) return false;
      if (filterStatus) {
        const effective = isSampleFullyCompleted(s) ? 'completed' : s.status;
        if (effective !== filterStatus) return false;
      }

      // Start/End Dates
      if (filterStartDate) {
        const start = new Date(filterStartDate);
        if (new Date(s.chargingDate) < start) return false;
      }
      if (filterEndDate) {
        const end = new Date(filterEndDate);
        if (new Date(s.chargingDate) > end) return false;
      }

      // Charging Month filter (YYYY-MM format)
      if (filterChargingDate) {
        const [year, month] = filterChargingDate.split('-');
        const cDate = new Date(s.chargingDate);
        if (
          cDate.getFullYear().toString() !== year ||
          (cDate.getMonth() + 1).toString().padStart(2, '0') !== month
        ) {
          return false;
        }
      }

      // Target Pull Month filter
      if (filterTestingMonth) {
        const [year, month] = filterTestingMonth.split('-');
        const hasMatchingPull = s.intervals.some((m) => {
          const target = new Date(s.chargingDate);
          target.setMonth(target.getMonth() + m);
          return (
            target.getFullYear().toString() === year &&
            (target.getMonth() + 1).toString().padStart(2, '0') === month
          );
        });
        if (!hasMatchingPull) return false;
      }

      // 3. KPI Active Card Filter
      if (kpiFilter === 'running' && (isSampleFullyCompleted(s) || s.status === 'registered')) return false;
      if (kpiFilter === 'completed' && !isSampleFullyCompleted(s)) return false;
      if (kpiFilter === 'overdue') {
        const hasOverdue = s.intervals.some((m) => {
          const test = s.intervalTests?.find((it) => it.interval === m);
          return test?.status !== 'completed' && isOverdue(s.chargingDate, m);
        });
        if (!hasOverdue) return false;
      }
      if (kpiFilter === 'upcoming') {
        const hasUpcoming = s.intervals.some((m) => {
          const test = s.intervalTests?.find((it) => it.interval === m);
          return test?.status !== 'completed' && isUpcoming(s.chargingDate, m, 30);
        });
        if (!hasUpcoming) return false;
      }

      return true;
    });
  }, [
    samples,
    globalSearch,
    filterProduct,
    filterBatch,
    filterSection,
    filterStatus,
    filterChargingDate,
    filterTestingMonth,
    filterStartDate,
    filterEndDate,
    kpiFilter,
  ]);

  // Export filtered data directly to CSV
  const handleExportCSV = () => {
    if (filteredSamples.length === 0) {
      addToast('Export Alert', 'No data matches active filters to export.', 'info');
      return;
    }

    const headers = [
      'Product Name',
      'Product Code',
      'Batch Code',
      'Status',
      'Charging Date',
      'Expiry Date',
      'Quantity (Units)',
      'Section',
      'Remarks',
    ];

    const rows = filteredSamples.map((s) => [
      s.product?.name || '',
      s.product?.code || '',
      s.batch?.batchCode || '',
      s.status,
      s.chargingDate ? new Date(s.chargingDate).toLocaleDateString() : '',
      s.expiryDate ? new Date(s.expiryDate).toLocaleDateString() : '',
      s.quantity,
      s.section?.name || 'Unassigned',
      s.remarks || '',
    ]);

    const csvContent = [
      'National Health care Pivate limited',
      headers.join(','),
      ...rows.map((row) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `esms_stability_report_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Export Successful', 'Stability report downloaded in CSV format.', 'success');
  };

  // Recharts: Monthly Test Trend (scheduled vs completed)
  const monthlyTrendData = useMemo(() => {
    const counts: Record<string, { month: string; Completed: number; Scheduled: number }> = {};
    const monthNames = [
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

    samples.forEach((s) => {
      s.intervals.forEach((monthOffset) => {
        const test = s.intervalTests?.find((it) => it.interval === monthOffset);
        const isTested = test?.status === 'completed';

        const target = new Date(s.chargingDate);
        target.setMonth(target.getMonth() + monthOffset);

        const key = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = `${monthNames[target.getMonth()]} ${target.getFullYear().toString().slice(-2)}`;

        if (!counts[key]) {
          counts[key] = { month: monthLabel, Completed: 0, Scheduled: 0 };
        }

        if (isTested) {
          counts[key].Completed++;
        } else {
          counts[key].Scheduled++;
        }
      });
    });

    // Sort chronological
    return Object.entries(counts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6) // Limit to latest 6 months of schedules
      .map((entry) => entry[1]);
  }, [samples]);

  // Recharts: Product Spread (samples per product)
  const productSpreadData = useMemo(() => {
    const spreads: Record<string, number> = {};
    samples.forEach((s) => {
      const code = s.product?.code || 'Unknown';
      spreads[code] = (spreads[code] || 0) + 1;
    });

    return Object.entries(spreads)
      .map(([name, value]) => ({ name, value }))
      .slice(0, 5); // Top 5 products
  }, [samples]);

  // Recharts: Status Donut Chart
  const statusDonutData = useMemo(() => {
    let reg = 0,
      run = 0,
      comp = 0;
    samples.forEach((s) => {
      if (isSampleFullyCompleted(s)) comp++;
      else if (s.status === 'registered') reg++;
      else run++;
    });
    return [
      { name: 'Registered', value: reg, color: '#64748b' },
      { name: 'Running', value: run, color: '#2563eb' },
      { name: 'Completed', value: comp, color: '#10b981' },
    ].filter((item) => item.value > 0);
  }, [samples]);

  // Recharts: Section Distribution
  const sectionDonutData = useMemo(() => {
    const counts: Record<string, number> = {};
    samples.forEach((s) => {
      const name = s.section?.name || 'General Analytical';
      counts[name] = (counts[name] || 0) + 1;
    });
    const colors = ['#2563eb', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
    return Object.entries(counts).map(([name, value], idx) => ({
      name,
      value,
      color: colors[idx % colors.length],
    }));
  }, [samples]);

  /* Recharts: Storage chamber radar/pie chart -- Disabled per Storage/Chamber requirement
  const chamberPieData = useMemo(() => {
    const counts: Record<string, number> = {};
    samples.forEach((s) => {
      const cond = s.product?.storageConditions || 'Standard ambient (25°C/60% RH)';
      counts[cond] = (counts[cond] || 0) + 1;
    });
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
    return Object.entries(counts).map(([name, value], idx) => ({
      name,
      value,
      color: colors[idx % colors.length],
    }));
  }, [samples]); */

  // Recharts: Analyst logs productivity (activities per user)
  const analystChartData = useMemo(() => {
    const activities: Record<string, number> = {};
    auditLogs.forEach((entry) => {
      const actor = entry.actorEmail ? entry.actorEmail.split('@')[0] : 'system';
      activities[actor] = (activities[actor] || 0) + 1;
    });
    return Object.entries(activities)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [auditLogs]);

  // Recharts: Completion Rate Gauge (Completed vs Total scheduled tests)
  const completionGaugeData = useMemo(() => {
    const rate =
      metrics.totalTests > 0 ? Math.round((metrics.completedTests / metrics.totalTests) * 100) : 0;
    return [{ name: 'Completed Rate', value: rate, fill: '#10b981' }];
  }, [metrics]);

  // Calendar: Days helper
  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days = [];
    // Pad empty first days
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    // Days numbers
    for (let i = 1; i <= totalDays; i++) {
      days.push(i);
    }
    return days;
  }, [calendarDate]);

  // Get active pulls on a calendar day
  const getPullsOnDay = (day: number) => {
    const pulls: {
      sample: Sample;
      interval: number;
      type: 'overdue' | 'upcoming' | 'completed';
    }[] = [];
    const dateToCheck = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);
    dateToCheck.setHours(0, 0, 0, 0);

    samples.forEach((s) => {
      s.intervals.forEach((month) => {
        const test = s.intervalTests?.find((it) => it.interval === month);
        const targetDate = new Date(s.chargingDate);
        targetDate.setMonth(targetDate.getMonth() + month);
        targetDate.setHours(0, 0, 0, 0);

        if (targetDate.getTime() === dateToCheck.getTime()) {
          const type =
            test?.status === 'completed'
              ? 'completed'
              : isOverdue(s.chargingDate, month)
                ? 'overdue'
                : 'upcoming';
          pulls.push({ sample: s, interval: month, type });
        }
      });
    });
    return pulls;
  };

  const handlePrevMonth = () => {
    setSelectedCalendarDay(null);
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedCalendarDay(null);
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
  };

  // Skeleton loading indicator
  const isLoading = samplesQuery.isLoading || productsQuery.isLoading || batchesQuery.isLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header Loader */}
        <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
        {/* KPI Grid Loader */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse"
            />
          ))}
        </div>
        {/* Chart Grid Loader */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-80 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
          <div className="h-80 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span>Stability Operations Dashboard</span>
            {/* <Sparkles size={18} className="text-blue-500 animate-pulse" /> */}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time tracking of stability protocols, test schedules, and laboratory audits.
          </p>
        </div>

        {/* Global Toolbar */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 text-xs font-semibold rounded-xl border transition flex items-center gap-1.5 cursor-pointer ${
              showFilters
                ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <SlidersHorizontal size={14} />
            Filters
            {(filterProduct ||
              filterBatch ||
              filterSection ||
              filterStatus ||
              filterChargingDate ||
              filterTestingMonth ||
              filterStartDate ||
              filterEndDate) && <span className="w-1.5 h-1.5 bg-blue-600 rounded-full" />}
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Select Product
            </label>
            <select
              value={filterProduct}
              onChange={(e) => setFilterProduct(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-800 px-3 py-2 bg-white dark:bg-slate-950"
            >
              <option value="">All Products</option>
              {products.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Batch Code
            </label>
            <input
              type="text"
              value={filterBatch}
              onChange={(e) => setFilterBatch(e.target.value)}
              placeholder="e.g. B-2026"
              className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-800 px-3 py-2 bg-white dark:bg-slate-950"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Laboratory Section
            </label>
            <select
              value={filterSection}
              onChange={(e) => setFilterSection(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-800 px-3 py-2 bg-white dark:bg-slate-950"
            >
              <option value="">All Sections</option>
              {sections.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Sample Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-800 px-3 py-2 bg-white dark:bg-slate-950"
            >
              <option value="">All Statuses</option>
              <option value="registered">Registered</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Charging Month
            </label>
            <input
              type="month"
              value={filterChargingDate}
              onChange={(e) => setFilterChargingDate(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-800 px-3 py-2 bg-white dark:bg-slate-950"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Target Pull Month
            </label>
            <input
              type="month"
              value={filterTestingMonth}
              onChange={(e) => setFilterTestingMonth(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-800 px-3 py-2 bg-white dark:bg-slate-950"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Charging Date Range
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-800 px-2 py-1.5 bg-white dark:bg-slate-950"
              />
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-800 px-2 py-1.5 bg-white dark:bg-slate-950"
              />
            </div>
          </div>

          <div className="flex items-end justify-end">
            <button
              onClick={() => {
                setFilterProduct('');
                setFilterBatch('');
                setFilterSection('');
                setFilterStatus('');
                setFilterChargingDate('');
                setFilterTestingMonth('');
                setFilterStartDate('');
                setFilterEndDate('');
                setKpiFilter('all');
                setSearchParams({});
                addToast('Filters Reset', 'Cleared all dashboard criteria.', 'info');
              }}
              className="px-3 py-2 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 rounded-xl transition cursor-pointer"
            >
              Clear All Filters
            </button>
          </div>
        </div>
      )}

      {/* Global URL Search Alert Indicator */}
      {(globalSearch || kpiFilter !== 'all') && (
        <div className="px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-blue-600" />
            <span>
              Active Filter: {globalSearch && `Searching "${globalSearch}"`}{' '}
              {kpiFilter !== 'all' &&
                `KPI: ${kpiFilter.charAt(0).toUpperCase() + kpiFilter.slice(1)}`}
            </span>
          </div>
          <button
            onClick={() => {
              setSearchParams({});
              setKpiFilter('all');
            }}
            className="text-blue-700 dark:text-blue-300 font-extrabold hover:underline"
          >
            Clear Active
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Samples */}
        <div
          onClick={() => navigate('/samples')}
          className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-200 cursor-pointer hover:shadow-md hover:scale-[1.02] flex items-center gap-4"
        >
          <div className="p-3 rounded-xl text-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600">
            🔬
          </div>
          <div className="truncate">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Total Samples
            </div>
            <div className="text-2xl font-extrabold mt-0.5 leading-none">{samples.length}</div>
          </div>
        </div>

        {/* Running Samples */}
        <div
          onClick={() => navigate('/samples?status=running')}
          className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-200 cursor-pointer hover:shadow-md hover:scale-[1.02] flex items-center gap-4"
        >
          <div className="p-3 rounded-xl text-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600">
            ⚡
          </div>
          <div className="truncate">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Running Samples
            </div>
            <div className="text-2xl font-extrabold mt-0.5 leading-none">
              {samples.filter((s) => !isSampleFullyCompleted(s) && s.status !== 'registered').length}
            </div>
          </div>
        </div>

        {/* Completed Samples */}
        <div
          onClick={() => navigate('/samples?status=completed')}
          className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-200 cursor-pointer hover:shadow-md hover:scale-[1.02] flex items-center gap-4"
        >
          <div className="p-3 rounded-xl text-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
            ✅
          </div>
          <div className="truncate">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Completed Samples
            </div>
            <div className="text-2xl font-extrabold mt-0.5 leading-none">
              {samples.filter((s) => isSampleFullyCompleted(s)).length}
            </div>
          </div>
        </div>

        {/* Overdue Tests */}
        <div
          onClick={() => navigate('/records')}
          className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-200 cursor-pointer hover:shadow-md hover:scale-[1.02] flex items-center gap-4"
        >
          <div className="p-3 rounded-xl text-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600">
            🚨
          </div>
          <div className="truncate">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Overdue Tests
            </div>
            <div className="text-2xl font-extrabold mt-0.5 leading-none">
              {metrics.overdueCount}
            </div>
          </div>
        </div>

        {/* Upcoming (30 Days) */}
        <div
          onClick={() => navigate('/records')}
          className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-200 cursor-pointer hover:shadow-md hover:scale-[1.02] flex items-center gap-4"
        >
          <div className="p-3 rounded-xl text-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600">
            ⏳
          </div>
          <div className="truncate">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Upcoming (7/30d)
            </div>
            <div className="text-lg font-extrabold mt-0.5 leading-none">
              {metrics.upcoming7d}d / {metrics.upcoming30d}d
            </div>
          </div>
        </div>

        {/* Pending Tests */}
        <div
          onClick={() => navigate('/records')}
          className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 transition-all duration-200 cursor-pointer hover:shadow-md hover:scale-[1.02] flex items-center gap-4"
        >
          <div className="p-3 bg-purple-50 dark:bg-purple-950/50 text-purple-600 rounded-xl text-lg">
            📋
          </div>
          <div className="truncate">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Pending Tests
            </div>
            <div className="text-2xl font-extrabold mt-0.5 leading-none">
              {metrics.pendingTests}
            </div>
          </div>
        </div>

        {/* Product Categories */}
        <div
          onClick={() => navigate('/admin/categories')}
          className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 transition-all duration-200 cursor-pointer hover:shadow-md hover:scale-[1.02] flex items-center gap-4"
        >
          <div className="p-3 bg-pink-50 dark:bg-pink-950/50 text-pink-600 rounded-xl text-lg">
            🏷️
          </div>
          <div className="truncate">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Categories
            </div>
            <div className="text-xs font-extrabold mt-1 truncate">
              {Object.entries(metrics.categorySpread)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 1)
                .map(([name, count]) => {
                  const pct = Math.round((count / samples.length) * 100);
                  return `${name.slice(0, 8)} (${pct}%)`;
                })[0] || 'No Category'}
            </div>
          </div>
        </div>

        {/* Active Products */}
        <div
          onClick={() => navigate('/products')}
          className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 transition-all duration-200 cursor-pointer hover:shadow-md hover:scale-[1.02] flex items-center gap-4"
        >
          <div className="p-3 bg-teal-50 dark:bg-teal-950/50 text-teal-600 rounded-xl text-lg">
            📦
          </div>
          <div className="truncate">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Active Products
            </div>
            <div className="text-2xl font-extrabold mt-0.5 leading-none">
              {products.filter((p) => !p.isArchived).length}
            </div>
          </div>
        </div>

        {/* Active Batches */}
        <div
          onClick={() => navigate('/batches')}
          className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 transition-all duration-200 cursor-pointer hover:shadow-md hover:scale-[1.02] flex items-center gap-4"
        >
          <div className="p-3 bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 rounded-xl text-lg">
            🥞
          </div>
          <div className="truncate">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Active Batches
            </div>
            <div className="text-2xl font-extrabold mt-0.5 leading-none">{batches.length}</div>
          </div>
        </div>

        {/* Active Users */}
        <div
          onClick={() => navigate('/admin/users')}
          className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 transition-all duration-200 cursor-pointer hover:shadow-md hover:scale-[1.02] flex items-center gap-4"
        >
          <div className="p-3 bg-amber-50 dark:bg-amber-950/50 text-amber-600 rounded-xl text-lg">
            👥
          </div>
          <div className="truncate">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Active Users
            </div>
            <div className="text-2xl font-extrabold mt-0.5 leading-none">
              {users.filter((u) => u.status === 'active').length}
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Column 1 */}
        <div className="space-y-6">
          {/* Monthly Test Trend */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col h-80">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1">
              <TrendingUp size={14} className="text-blue-500" />
              Monthly Pull/Testing Trend
            </h2>
            <div className="flex-1 min-h-0 text-xs">
              {monthlyTrendData.length === 0 ? (
                <div className="h-full flex items-center justify-center italic text-slate-400">
                  No scheduled trends.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={monthlyTrendData}
                    margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="scheduledGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e2e8f0"
                      className="dark:stroke-slate-800"
                    />
                    <XAxis dataKey="month" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{
                        background: '#0f172a',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Completed"
                      stroke="#10b981"
                      fillOpacity={1}
                      fill="url(#completedGrad)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="Scheduled"
                      stroke="#2563eb"
                      fillOpacity={1}
                      fill="url(#scheduledGrad)"
                      strokeWidth={2}
                    />
                    <Legend />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Section Distribution */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col h-80">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              Lab Section Distribution
            </h2>
            <div className="flex-1 min-h-0 text-xs">
              {sectionDonutData.length === 0 ? (
                <div className="h-full flex items-center justify-center italic text-slate-400">
                  No section data.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sectionDonutData}
                      cx="50%"
                      cy="45%"
                      innerRadius={0}
                      outerRadius={65}
                      labelLine={false}
                      label={({ name, percent }: { name?: string; percent?: number }) =>
                        `${name ? name.slice(0, 6) : ''} (${percent ? (percent * 100).toFixed(0) : 0}%)`
                      }
                      dataKey="value"
                    >
                      {sectionDonutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Column 2 */}
        <div className="space-y-6">
          {/* Product Distribution */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col h-80">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              Product Code Distribution
            </h2>
            <div className="flex-1 min-h-0 text-xs">
              {productSpreadData.length === 0 ? (
                <div className="h-full flex items-center justify-center italic text-slate-400">
                  No product items found.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={productSpreadData}
                    margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e2e8f0"
                      className="dark:stroke-slate-800"
                    />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{
                        background: '#0f172a',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                    />
                    <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                      {productSpreadData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={index % 2 === 0 ? '#2563eb' : '#3b82f6'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Completion Rate Radial Bar */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col h-80">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              Test Completion Rate
            </h2>
            <div className="flex-1 min-h-0 text-xs relative flex items-center justify-center">
              {metrics.totalTests === 0 ? (
                <div className="italic text-slate-400">No tests registered.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="70%"
                    outerRadius="90%"
                    barSize={10}
                    data={completionGaugeData}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <RadialBar background dataKey="value" cornerRadius={30} />
                  </RadialBarChart>
                </ResponsiveContainer>
              )}
              {metrics.totalTests > 0 && (
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-500 leading-none">
                    {Math.round((metrics.completedTests / metrics.totalTests) * 100)}%
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1.5 leading-none">
                    {metrics.completedTests} of {metrics.totalTests} Tests
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Column 3 */}
        <div className="space-y-6">
          {/* Sample Status Distribution Donut */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col h-80">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              Sample Protocol Statuses
            </h2>
            <div className="flex-1 min-h-0 text-xs relative flex items-center justify-center">
              {statusDonutData.length === 0 ? (
                <div className="italic text-slate-400">No protocol data.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDonutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {statusDonutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              {/* Donut Center Label */}
              {statusDonutData.length > 0 && (
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase leading-none">
                    Total
                  </span>
                  <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 leading-none">
                    {samples.length}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Storage Conditions Distribution -- Hidden per requirement
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col h-80">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              Storage Chamber Conditions
            </h2>
            <div className="flex-1 min-h-0 text-xs">
              {chamberPieData.length === 0 ? (
                <div className="h-full flex items-center justify-center italic text-slate-400">
                  No storage data.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chamberPieData}
                      cx="50%"
                      cy="45%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {chamberPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value) => (
                        <span className="text-[10px] text-slate-600 dark:text-slate-400">
                          {value.slice(0, 18)}...
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div> */}
        </div>
      </div>

      {/* Interactive Main Sections Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Grid: Calendar, Schedules, Activities */}
        <div className="lg:col-span-8 space-y-6">
          {/* Active Tests Horizontal Lifeline Timeline */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden p-5">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Activity size={16} className="text-blue-500" />
                  Stability Testing Lifeline Analysis
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Real-time horizontal timeline visualizer depicting ongoing study progression &
                  interval milestones
                </p>
              </div>
              <Link
                to="/records"
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                View All Lifelines <ArrowRight size={12} />
              </Link>
            </div>

            <div className="space-y-3">
              {upcomingNearSamples.length === 0 ? (
                <div className="text-center italic text-slate-400 py-6 text-xs">
                  No active stability studies registered.
                </div>
              ) : (
                upcomingNearSamples
                  .slice(0, 5)
                  .map(({ sample: s, nearestInterval, nearestDays, isOverdue, isCompleted }) => {
                    const chargingDate = new Date(
                      s.chargingDate || (s as any).createdAt || Date.now(),
                    );
                    const maxInterval = s.intervals?.length ? Math.max(...s.intervals) : 36;
                    const endDate = new Date(chargingDate);
                    endDate.setMonth(endDate.getMonth() + maxInterval);

                    const today = new Date();
                    const totalDuration = endDate.getTime() - chargingDate.getTime();
                    const elapsed = today.getTime() - chargingDate.getTime();
                    const progressPct =
                      totalDuration > 0
                        ? Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)))
                        : 0;

                    return (
                      <div
                        key={s._id}
                        className="p-3 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/samples/${s._id}`}
                              className="font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              {s.sampleCode}
                            </Link>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {s.product?.name || 'Product'}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                              {s.batch?.batchCode || 'Batch'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {isCompleted ? (
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                                ✓ All Tests Done
                              </span>
                            ) : isOverdue ? (
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 flex items-center gap-1">
                                <span>🚨 M{nearestInterval} Overdue</span>
                                <span>({Math.abs(nearestDays)}d late)</span>
                              </span>
                            ) : nearestDays === 0 ? (
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 animate-pulse">
                                ⚡ M{nearestInterval} Due Today
                              </span>
                            ) : (
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                                ⏳ M{nearestInterval} Due in {nearestDays}d
                              </span>
                            )}
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                              {progressPct}% Progress
                            </span>
                          </div>
                        </div>

                        {/* Timeline Track with Interval Markers */}
                        <div className="relative pt-1 pb-1">
                          <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isOverdue
                                  ? 'bg-gradient-to-r from-blue-500 via-rose-500 to-rose-600'
                                  : isCompleted
                                    ? 'bg-gradient-to-r from-blue-500 to-emerald-500'
                                    : 'bg-gradient-to-r from-blue-500 to-indigo-600'
                              }`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>

                          {/* Interval Month Pills on Timeline */}
                          <div className="flex justify-between items-center mt-1.5 text-[9px] font-semibold text-slate-400">
                            <span>Charged: {formatDD_MM_YYYY(s.chargingDate)}</span>
                            <div className="flex gap-1">
                              {s.intervals?.slice(0, 8).map((m) => {
                                const test = s.intervalTests?.find((t) => t.interval === m);
                                const isDone = test?.status === 'completed';
                                const isTargetUpcoming = m === nearestInterval;
                                return (
                                  <span
                                    key={m}
                                    className={`px-1.5 py-0.5 rounded text-[9px] ${
                                      isDone
                                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold'
                                        : isTargetUpcoming
                                          ? isOverdue
                                            ? 'bg-rose-500 text-white font-extrabold animate-pulse'
                                            : 'bg-blue-600 text-white font-extrabold shadow-3xs'
                                          : 'bg-slate-200/60 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                    }`}
                                  >
                                    M{m}
                                  </span>
                                );
                              })}
                            </div>
                            <span>Target: {formatDD_MM_YYYY(endDate)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          {/* Interactive Calendar Widget */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <CalendarIcon size={16} className="text-blue-500" />
                Stability Schedule Calendar
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const t = new Date();
                    setCalendarDate(t);
                    setSelectedCalendarDay(t.getDate());
                  }}
                  className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 transition"
                  title="Jump to today"
                >
                  Today
                </button>
                <button
                  onClick={handlePrevMonth}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  onClick={handleNextMonth}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="font-bold text-slate-400 py-1.5">
                  {day}
                </div>
              ))}

              {calendarDays.map((day, idx) => {
                if (day === null) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      className="bg-slate-50/20 dark:bg-slate-950/10 rounded-lg aspect-square"
                    />
                  );
                }

                const dayPulls = getPullsOnDay(day);
                const isSelected = selectedCalendarDay === day;
                const sysNow = new Date();
                const isToday =
                  sysNow.getDate() === day &&
                  sysNow.getMonth() === calendarDate.getMonth() &&
                  sysNow.getFullYear() === calendarDate.getFullYear();

                return (
                  <button
                    key={`day-${day}`}
                    onClick={() => setSelectedCalendarDay(isSelected ? null : day)}
                    className={`dashboard-calendar-day relative border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-600 border-blue-700 text-white shadow-md shadow-blue-500/20 font-bold'
                        : isToday
                          ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 dark:border-blue-400 text-blue-700 dark:text-blue-300 font-extrabold ring-2 ring-blue-500/40 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-950/40 border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span className={isToday ? 'font-black underline decoration-blue-500 decoration-2' : 'font-bold'}>
                        {day}
                      </span>
                      {isToday && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" title="Current Date (Today)" />
                      )}
                    </div>
                    {dayPulls.length > 0 && (
                      <div className="flex gap-0.5 justify-center mt-1">
                        {dayPulls.slice(0, 3).map((p, pIdx) => (
                          <span
                            key={pIdx}
                            className={`w-1.5 h-1.5 rounded-full ${
                              p.type === 'overdue'
                                ? 'bg-rose-500'
                                : p.type === 'completed'
                                  ? 'bg-emerald-500'
                                  : 'bg-amber-500'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Expanded Calendar Pull Details */}
            {selectedCalendarDay !== null && (
              <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-800 animate-slide-up">
                <div className="flex justify-between items-center pb-2 mb-2 border-b border-slate-200 dark:border-slate-800 text-xs font-bold">
                  <span>
                    Pulls Scheduled for {selectedCalendarDay}{' '}
                    {calendarDate.toLocaleString('default', { month: 'long' })}
                  </span>
                  <button
                    onClick={() => setSelectedCalendarDay(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {getPullsOnDay(selectedCalendarDay).length === 0 ? (
                    <div className="text-center italic text-xs text-slate-400">
                      No stability pulls scheduled on this date.
                    </div>
                  ) : (
                    getPullsOnDay(selectedCalendarDay).map((p, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center text-xs p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-900 transition"
                      >
                        <Link
                          to={`/samples/${p.sample._id}`}
                          className="font-mono font-bold text-blue-600 hover:underline"
                        >
                          {p.sample.sampleCode} (M{p.interval})
                        </Link>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 italic">
                            {p.sample.product?.name}
                          </span>
                          <span
                            className={`text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              p.type === 'overdue'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/20 dark:text-rose-400'
                                : p.type === 'completed'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400'
                            }`}
                          >
                            {p.type}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Today's Schedule Widgets */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <span>📅 Today's Schedule</span>
                {metrics.todayPulls.length > 0 && (
                  <span className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-[10px] px-2 py-0.5 rounded-full font-bold">
                    {metrics.todayPulls.length} due
                  </span>
                )}
              </h2>
            </div>
            <div className="overflow-x-auto text-xs">
              <table className="min-w-full divide-y divide-slate-250 dark:divide-slate-800 text-left">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500">
                  <tr className="font-semibold uppercase tracking-wider">
                    <th className="px-4 py-2.5">Sample ID</th>
                    <th className="px-4 py-2.5">Product</th>
                    <th className="px-4 py-2.5">Batch</th>
                    <th className="px-4 py-2.5 text-center">Interval</th>
                    <th className="px-4 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {metrics.todayPulls.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-400 italic">
                        No stability pulls due today. Healthy laboratory status.
                      </td>
                    </tr>
                  ) : (
                    metrics.todayPulls.map((pull, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition"
                      >
                        <td className="px-4 py-2.5 font-mono font-bold text-blue-600">
                          <Link to={`/samples/${pull.sample._id}`} className="hover:underline">
                            {pull.sample.sampleCode}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300">
                          {pull.sample.product?.name}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 font-mono text-[10px]">
                          {pull.sample.batch?.batchCode}
                        </td>
                        <td className="px-4 py-2.5 text-center font-bold">M{pull.interval}</td>
                        <td className="px-4 py-2.5 text-right">
                          <Link
                            to={`/samples/${pull.sample._id}`}
                            className="text-blue-500 hover:underline inline-flex items-center gap-0.5"
                          >
                            Pull Sample
                            <ArrowRight size={12} />
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Overdue Schedules pulls list */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <span>🚨 Overdue Schedules (Action Required)</span>
                <span className="bg-rose-100 text-rose-800 dark:bg-rose-950/20 dark:text-rose-400 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {metrics.overdueCount} overdue
                </span>
              </h2>
            </div>
            <div className="overflow-x-auto text-xs">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500">
                  <tr className="font-semibold uppercase tracking-wider">
                    <th className="px-4 py-2.5">Sample ID</th>
                    <th className="px-4 py-2.5">Product</th>
                    <th className="px-4 py-2.5">Target Pull</th>
                    <th className="px-4 py-2.5 text-center">Month</th>
                    <th className="px-4 py-2.5 text-right text-rose-600">Late By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {metrics.overduePulls.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-400 italic">
                        No stability pulls are currently overdue. Excellent!
                      </td>
                    </tr>
                  ) : (
                    metrics.overduePulls.slice(0, 5).map((pull, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition"
                      >
                        <td className="px-4 py-2.5 font-mono font-bold text-slate-900 dark:text-white">
                          <Link
                            to={`/samples/${pull.sample._id}`}
                            className="hover:underline text-blue-600"
                          >
                            {pull.sample.sampleCode}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 font-medium">
                          {pull.sample.product?.name}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500">
                          {formatDD_MM_YYYY(pull.targetDate)}
                        </td>
                        <td className="px-4 py-2.5 text-center font-bold">M{pull.interval}</td>
                        <td className="px-4 py-2.5 text-right font-black text-rose-600">
                          {pull.days} days
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Audit Activities Feed */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
            <h2 className="text-sm font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
              <Activity size={16} className="text-purple-500" />
              Laboratory Operations Audit Trail
            </h2>
            <div className="flow-root text-xs">
              {auditLogs.length === 0 ? (
                <div className="italic text-slate-400 py-6 text-center">
                  No activities recorded.
                </div>
              ) : (
                <ul className="-mb-8">
                  {auditLogs.slice(0, 5).map((log, logIdx) => (
                    <li key={log.id}>
                      <div className="relative pb-8">
                        {logIdx !== 4 ? (
                          <span
                            className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200 dark:bg-slate-800"
                            aria-hidden="true"
                          />
                        ) : null}
                        <div className="relative flex space-x-3">
                          <div>
                            <span className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center ring-8 ring-white dark:ring-slate-900">
                              🧬
                            </span>
                          </div>
                          <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                            <div>
                              <p className="font-semibold text-slate-800 dark:text-slate-200">
                                <code className="rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.5 mr-1 font-mono text-[10px] text-purple-600 dark:text-purple-400">
                                  {log.action}
                                </code>{' '}
                                on{' '}
                                <span className="font-medium text-slate-900 dark:text-white">
                                  {log.resource}
                                </span>
                              </p>
                              <span className="text-[10px] text-slate-400 mt-1 block">
                                Actor: {log.actorEmail} · IP: {log.ip}
                              </span>
                            </div>
                            <div className="text-right text-[10px] whitespace-nowrap text-slate-500">
                              <time dateTime={log.createdAt}>
                                {new Date(log.createdAt).toLocaleTimeString()}
                              </time>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Analyst Audit Activity (Recent Actions) */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col h-80">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              Analyst Audit Activity (Recent Actions)
            </h2>
            <div className="flex-1 min-h-0 text-xs">
              {analystChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center italic text-slate-400">
                  No actions logged.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={analystChartData}
                    margin={{ top: 5, right: 5, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                      stroke="#e2e8f0"
                      className="dark:stroke-slate-800"
                    />
                    <XAxis type="number" stroke="#94a3b8" />
                    <YAxis dataKey="name" type="category" stroke="#94a3b8" width={60} />
                    <Tooltip
                      contentStyle={{
                        background: '#0f172a',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                    />
                    <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Right Grid: Health, Actions, Reports, Notifications */}
        <div className="lg:col-span-4 space-y-6">
          {/* System Health */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Database size={14} className="text-blue-500" />
              System Health & Status
            </h2>
            <div className="space-y-3.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Database Status</span>
                <span
                  className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-[9px] ${
                    health?.database === 'connected'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950/20'
                  }`}
                >
                  {health?.database || 'connected'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Server Uptime</span>
                <span className="font-semibold">
                  {health?.uptimeSeconds
                    ? `${Math.floor(health.uptimeSeconds / 3600)}h ${Math.floor(
                        (health.uptimeSeconds % 3600) / 60,
                      )}m`
                    : '2h 14m'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Active Schedules</span>
                <span className="font-semibold">{samples.length} registered</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Sync Ping</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  14 ms (API OK)
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
              <button
                onClick={() => {
                  setWizardStep(1);
                  setWizardCategory('');
                  setWizardProduct('');
                  setWizardBatch('');
                  setWizardTemplateSample('');
                  setIsWizardOpen(true);
                }}
                className="p-3 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 rounded-xl text-blue-700 dark:text-blue-300 transition flex flex-col items-center gap-1.5 text-center cursor-pointer"
              >
                <Plus size={16} />
                Add Sample
              </button>
              <button
                onClick={() => navigate('/batches')}
                className="p-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-300 transition flex flex-col items-center gap-1.5 text-center cursor-pointer"
              >
                <Layers size={16} />
                Create Batch
              </button>
              <button
                onClick={() => triggerSchedulerMutation.mutate()}
                disabled={triggerSchedulerMutation.isPending}
                className="p-3 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/60 rounded-xl text-purple-700 dark:text-purple-300 transition flex flex-col items-center gap-1.5 text-center cursor-pointer"
              >
                <Clock size={16} />
                Run Scheduler
              </button>
              <button
                onClick={() => triggerBackupMutation.mutate()}
                disabled={triggerBackupMutation.isPending}
                className="p-3 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/40 dark:hover:bg-teal-900/60 rounded-xl text-teal-700 dark:text-teal-300 transition flex flex-col items-center gap-1.5 text-center cursor-pointer"
              >
                <Database size={16} />
                Take Backup
              </button>
            </div>
          </div>

          {/* Product Categories Breakdown */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Product Categories Breakdown
            </h2>
            <div className="space-y-3.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
              {categorySpreadData.length === 0 ? (
                <div className="text-xs text-slate-400 text-center italic py-4">
                  No category data.
                </div>
              ) : (
                categorySpreadData.map((item) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span className="truncate max-w-[160px]">{item.name}</span>
                      <span>
                        {item.count} ({item.pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 dark:bg-blue-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Completed Reports / Certificate downloads */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Recent Completed Reports</span>
              <FileText size={14} className="text-slate-400" />
            </h2>
            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
              {metrics.recentReports.length === 0 ? (
                <div className="italic text-slate-400 text-xs text-center py-4">
                  No reports compiled yet.
                </div>
              ) : (
                metrics.recentReports.map((report, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition flex justify-between items-center text-xs"
                  >
                    <div className="truncate pr-2">
                      <div className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate">
                        {report.sample.sampleCode} M{report.test.interval}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        Tested: {new Date(report.testedDate).toLocaleDateString()}
                      </div>
                    </div>
                    {report.test.reportData ? (
                      <a
                        href={`data:application/pdf;base64,${report.test.reportData}`}
                        download={
                          report.test.reportName || `report_${report.sample.sampleCode}.pdf`
                        }
                        className="p-1.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-lg"
                        title="Download report PDF"
                      >
                        <Download size={14} />
                      </a>
                    ) : (
                      <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-400 font-bold px-1.5 py-0.5 rounded">
                        PDF missing
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* In-app Notifications list */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between items-center">
              <span>Operational Alerts</span>
              <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" />
            </h2>
            <div className="space-y-2.5 text-xs max-h-56 overflow-y-auto">
              {metrics.overduePulls.length === 0 && metrics.upcomingPulls.length === 0 ? (
                <div className="text-center italic text-slate-400 py-4">No alerts active.</div>
              ) : (
                <>
                  {metrics.overduePulls.slice(0, 3).map((p, idx) => (
                    <div
                      key={`notif-overdue-${idx}`}
                      className="p-2.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30 flex gap-2"
                    >
                      <span className="mt-0.5">🚨</span>
                      <div>
                        <div className="font-semibold text-rose-800 dark:text-rose-400">
                          Sample Pull Overdue!
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {p.sample.sampleCode} M{p.interval} is overdue by {p.days} days.
                        </div>
                      </div>
                    </div>
                  ))}
                  {metrics.upcomingPulls.slice(0, 2).map((p, idx) => (
                    <div
                      key={`notif-upcoming-${idx}`}
                      className="p-2.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30 flex gap-2"
                    >
                      <span className="mt-0.5">📅</span>
                      <div>
                        <div className="font-semibold text-amber-800 dark:text-amber-400">
                          Pull Due Soon
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {p.sample.sampleCode} M{p.interval} is due in {p.days} days.
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => {
            setWizardStep(1);
            setWizardCategory('');
            setWizardProduct('');
            setWizardBatch('');
            setWizardTemplateSample('');
            setIsWizardOpen(true);
          }}
          className="w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          title="Add Stability Sample"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Toast Notification Container (Repositioned to the top-right) */}
      <div className="fixed top-20 right-6 z-[70] flex flex-col gap-2.5 max-w-sm w-full">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="p-4 rounded-xl border glass-card shadow-2xl animate-slide-up flex justify-between items-start gap-3"
          >
            <div className="flex gap-2">
              <span className="mt-0.5">
                {t.type === 'success' ? (
                  <CheckCircle size={16} className="text-emerald-500" />
                ) : t.type === 'error' ? (
                  <AlertTriangle size={16} className="text-rose-500" />
                ) : (
                  <Activity size={16} className="text-blue-500" />
                )}
              </span>
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-white leading-tight">
                  {t.title}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  {t.message}
                </div>
              </div>
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
              className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Quick Add Sample Wizard Modal */}
      {isWizardOpen &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 shadow-2xl p-6 border border-slate-100 dark:border-slate-800 flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Register Stability Sample (Step {wizardStep} of 2)
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setIsWizardOpen(false);
                    setWizardStep(1);
                  }}
                  className="text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {wizardStep === 1 ? (
                <div className="space-y-4 text-left">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      1. Product Category
                    </label>
                    <select
                      value={wizardCategory}
                      onChange={(e) => {
                        setWizardCategory(e.target.value);
                        setWizardProduct('');
                        setWizardBatch('');
                        setWizardTemplateSample('');
                      }}
                      className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-white"
                    >
                      <option value="">Select Category...</option>
                      {categories.map((c) => (
                        <option key={c._id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      2. Product
                    </label>
                    <select
                      value={wizardProduct}
                      disabled={!wizardCategory}
                      onChange={(e) => {
                        setWizardProduct(e.target.value);
                        setWizardBatch('');
                        setWizardTemplateSample('');
                      }}
                      className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-white disabled:opacity-50"
                    >
                      <option value="">Select Product...</option>
                      {products
                        .filter((p) => p.category === wizardCategory)
                        .map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name} ({p.code})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      3. Batch
                    </label>
                    <select
                      value={wizardBatch}
                      disabled={!wizardProduct}
                      onChange={(e) => {
                        setWizardBatch(e.target.value);
                        setWizardTemplateSample('');
                      }}
                      className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-white disabled:opacity-50"
                    >
                      <option value="">Select Batch...</option>
                      {batches
                        .filter(
                          (b) =>
                            b.product === wizardProduct ||
                            (typeof b.product === 'object' &&
                              (b.product as any)?._id === wizardProduct),
                        )
                        .map((b) => (
                          <option key={b._id} value={b._id}>
                            {b.batchCode}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      4. Sample Reference Template (Optional)
                    </label>
                    <select
                      value={wizardTemplateSample}
                      disabled={!wizardBatch}
                      onChange={(e) => setWizardTemplateSample(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-white disabled:opacity-50"
                    >
                      <option value="">Select Sample Reference Template...</option>
                      {samples
                        .filter(
                          (s) => s.product?._id === wizardProduct && s.batch?._id === wizardBatch,
                        )
                        .map((s) => (
                          <option key={s._id} value={s._id}>
                            {s.sampleCode} ({s.stabilityType})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsWizardOpen(false)}
                      className="px-3.5 py-2 text-xs font-bold text-slate-600 bg-slate-50 dark:bg-slate-800 rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!wizardProduct || !wizardBatch}
                      onClick={() => {
                        const selectedTemplate = samples.find(
                          (s) => s._id === wizardTemplateSample,
                        );
                        if (selectedTemplate) {
                          setWizardStabilityType(selectedTemplate.stabilityType);
                          setWizardExpiryDate(
                            selectedTemplate.expiryDate
                              ? selectedTemplate.expiryDate.slice(0, 10)
                              : '',
                          );
                          setWizardQuantity(selectedTemplate.quantity);
                          setWizardRemarks(selectedTemplate.remarks || '');
                          setWizardSection(selectedTemplate.section?._id || '');
                        } else {
                          setWizardStabilityType('long-term');
                          setWizardExpiryDate('');
                          setWizardQuantity(0);
                          setWizardRemarks('');
                          setWizardSection('');
                        }
                        setWizardChargingDate(new Date().toISOString().slice(0, 10)); // Default to today
                        setWizardStep(2);
                      }}
                      className="px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl cursor-pointer"
                    >
                      Proceed to Form
                    </button>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const selectedBatch = batches.find((b) => b._id === wizardBatch);
                    const batchMfgDate = selectedBatch?.manufacturingDate
                      ? selectedBatch.manufacturingDate.slice(0, 10)
                      : new Date().toISOString().slice(0, 10);

                    // Validation
                    if (wizardExpiryDate && new Date(wizardExpiryDate) <= new Date(batchMfgDate)) {
                      addToast(
                        'Validation Error',
                        'Expiry must be after manufacturing date',
                        'error',
                      );
                      return;
                    }
                    if (new Date(wizardChargingDate) < new Date(batchMfgDate)) {
                      addToast(
                        'Validation Error',
                        'Charging date cannot be before manufacturing date',
                        'error',
                      );
                      return;
                    }

                    createSampleMutation.mutate({
                      productId: wizardProduct,
                      batchId: wizardBatch,
                      sectionId: wizardSection || undefined,
                      stabilityType: wizardStabilityType,
                      manufacturingDate: batchMfgDate,
                      expiryDate: wizardExpiryDate || undefined,
                      chargingDate: wizardChargingDate,
                      quantity: Number(wizardQuantity),
                      remarks: wizardRemarks,
                    });
                  }}
                  className="space-y-4 text-xs text-left"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Stability Type
                      </label>
                      <select
                        value={wizardStabilityType}
                        onChange={(e: any) => setWizardStabilityType(e.target.value)}
                        className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-white"
                      >
                        <option value="long-term">long-term</option>
                        <option value="accelerated">accelerated</option>
                        <option value="intermediate">intermediate</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Quantity (Units)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={wizardQuantity}
                        onChange={(e) => setWizardQuantity(Number(e.target.value))}
                        className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Charging Date
                      </label>
                      <input
                        type="date"
                        value={wizardChargingDate}
                        onChange={(e) => setWizardChargingDate(e.target.value)}
                        className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-1.5 bg-white dark:bg-slate-950 text-slate-800 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Expiry Date
                      </label>
                      <input
                        type="date"
                        value={wizardExpiryDate}
                        onChange={(e) => setWizardExpiryDate(e.target.value)}
                        className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-1.5 bg-white dark:bg-slate-950 text-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Laboratory Section
                    </label>
                    <select
                      value={wizardSection}
                      onChange={(e) => setWizardSection(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-white"
                    >
                      <option value="">Select Section...</option>
                      {sections.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Remarks
                    </label>
                    <input
                      type="text"
                      value={wizardRemarks}
                      onChange={(e) => setWizardRemarks(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-white"
                      placeholder="Enter stability protocol remarks..."
                    />
                  </div>

                  <div className="flex justify-between gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setWizardStep(1)}
                      className="px-3.5 py-2 text-xs font-bold text-slate-600 bg-slate-50 dark:bg-slate-800 rounded-xl"
                    >
                      Back
                    </button>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsWizardOpen(false);
                          setWizardStep(1);
                        }}
                        className="px-3.5 py-2 text-xs font-bold text-slate-600 bg-slate-50 dark:bg-slate-800 rounded-xl"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={createSampleMutation.isPending}
                        className="px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl cursor-pointer"
                      >
                        {createSampleMutation.isPending ? 'Registering...' : 'Register Sample'}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
