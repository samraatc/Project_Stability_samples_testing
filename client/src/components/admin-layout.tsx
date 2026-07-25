import { useEffect, useState, useMemo } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-context';
import { catalogApi } from '@/features/catalog/api';
import { ProfileModal } from '@/components/profile-modal';
import {
  LayoutDashboard,
  Tags,
  Package,
  Layers,
  FlaskConical,
  ClipboardList,
  Users,
  ShieldCheck,
  History,
  Database,
  Menu,
  ChevronLeft,
  ChevronRight,
  Search,
  Bell,
  Sun,
  Moon,
  LogOut,
  ChevronDown,
  ChevronUp,
  Home,
  User,
  Activity,
  AlertCircle,
} from 'lucide-react';

const NAV_ITEMS: { to: string; label: string; icon: any; permission?: string }[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/categories', label: 'Categories', icon: Tags, permission: 'categories:read' },
  { to: '/products', label: 'Products', icon: Package, permission: 'products:read' },
  { to: '/batches', label: 'Batches', icon: Layers, permission: 'batches:read' },
  { to: '/samples', label: 'Samples', icon: FlaskConical, permission: 'samples:read' },
  { to: '/records', label: 'Records', icon: ClipboardList, permission: 'samples:read' },
];

const ADMIN_NAV_ITEMS: { to: string; label: string; icon: any; permission?: string }[] = [
  { to: '/admin/users', label: 'Users', icon: Users, permission: 'users:read' },
  { to: '/admin/roles', label: 'Roles', icon: ShieldCheck, permission: 'roles:read' },
  { to: '/admin/audit-logs', label: 'Audit logs', icon: History, permission: 'audit-logs:read' },
  { to: '/admin/backups', label: 'Backups', icon: Database, permission: 'backups:manage' },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Profile modal state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Sidebar collapse states
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('esms-sidebar-collapsed') === 'true';
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Admin nested menu states
  const [isAdminOpen, setIsAdminOpen] = useState(() => {
    // Open by default if on an admin route
    return (
      location.pathname.startsWith('/admin/users') ||
      location.pathname.startsWith('/admin/roles') ||
      location.pathname.startsWith('/admin/audit') ||
      location.pathname.startsWith('/admin/backups')
    );
  });

  // Header dropdowns
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Theme states
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return (
      localStorage.getItem('esms-theme') === 'dark' ||
      (!('esms-theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
    );
  });

  // Global search input
  const [searchVal, setSearchVal] = useState('');

  // Suggestions state
  const [suggestions, setSuggestions] = useState<
    {
      type: 'product' | 'batch' | 'sample' | 'record';
      title: string;
      subtitle: string;
      link: string;
    }[]
  >([]);

  const handleSearchChange = (val: string) => {
    setSearchVal(val);
    if (!val.trim()) {
      setSuggestions([]);
      return;
    }
    const query = val.toLowerCase();
    const list: typeof suggestions = [];

    // 1. Search products (by name or code)
    const matchedProducts = samples
      .map((s) => s.product)
      .filter((p, idx, self) => p && self.findIndex((x) => x?._id === p?._id) === idx)
      .filter((p) => p.name.toLowerCase().includes(query) || p.code.toLowerCase().includes(query));

    matchedProducts.slice(0, 3).forEach((p) => {
      list.push({
        type: 'product',
        title: p.name,
        subtitle: `Code: ${p.code}`,
        link: `/products?search=${encodeURIComponent(p.name)}`,
      });
    });

    // 2. Search batches (by batchCode)
    const matchedBatches = samples
      .map((s) => s.batch)
      .filter((b, idx, self) => b && self.findIndex((x) => x?._id === b?._id) === idx)
      .filter((b) => b.batchCode.toLowerCase().includes(query));

    matchedBatches.slice(0, 3).forEach((b) => {
      list.push({
        type: 'batch',
        title: `Batch ${b.batchCode}`,
        subtitle: 'Product stability batch study',
        link: `/batches?search=${encodeURIComponent(b.batchCode)}`,
      });
    });

    // 3. Search samples (by sampleCode)
    const matchedSamples = samples.filter((s) => s.sampleCode.toLowerCase().includes(query));
    matchedSamples.slice(0, 3).forEach((s) => {
      list.push({
        type: 'sample',
        title: s.sampleCode,
        subtitle: `${s.product?.name} · Batch: ${s.batch?.batchCode}`,
        link: `/samples/${s._id}`,
      });
    });

    // 4. Search records (by sampleCode + Month)
    const matchedRecords: typeof list = [];
    samples.forEach((s) => {
      s.intervals.forEach((month) => {
        const testLabel = `${s.sampleCode} M${month}`;
        if (testLabel.toLowerCase().includes(query)) {
          matchedRecords.push({
            type: 'record',
            title: testLabel,
            subtitle: `Target pull Month ${month}`,
            link: `/samples/${s._id}`,
          });
        }
      });
    });
    list.push(...matchedRecords.slice(0, 3));

    setSuggestions(list);
  };

  // Fetch samples for generating notifications in real time
  const samplesQuery = useQuery({
    queryKey: ['samples', 'layout-notifications'],
    queryFn: () => catalogApi.samples.list({ limit: 1000 }),
    refetchInterval: 60000, // Refresh every minute
  });

  const samples = samplesQuery.data?.items || [];

  // Theme effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('esms-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('esms-theme', 'light');
    }
  }, [isDarkMode]);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.profile-dropdown-trigger')) {
        setIsProfileOpen(false);
      }
      if (!target.closest('.notif-dropdown-trigger')) {
        setIsNotificationsOpen(false);
      }
      if (!target.closest('.search-input-container')) {
        setSuggestions([]);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const toggleSidebar = () => {
    const nextVal = !isCollapsed;
    setIsCollapsed(nextVal);
    localStorage.setItem('esms-sidebar-collapsed', String(nextVal));
  };

  // Compute live notifications based on overdue intervals
  const notifications = useMemo(() => {
    if (samples.length === 0) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const list: {
      id: string;
      type: 'overdue' | 'upcoming';
      message: string;
      sub: string;
      link: string;
    }[] = [];

    samples.forEach((s) => {
      s.intervals.forEach((month) => {
        const test = s.intervalTests?.find((it) => it.interval === month);
        if (test?.status !== 'completed') {
          const targetDate = new Date(s.chargingDate);
          targetDate.setMonth(targetDate.getMonth() + month);
          const diffTime = targetDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffTime < 0) {
            list.push({
              id: `${s._id}-${month}-overdue`,
              type: 'overdue',
              message: `Sample ${s.sampleCode} M${month} pull is overdue!`,
              sub: `Overdue by ${Math.abs(diffDays)} days. Product: ${s.product?.name}`,
              link: `/samples/${s._id}`,
            });
          } else if (diffDays <= 7) {
            list.push({
              id: `${s._id}-${month}-upcoming`,
              type: 'upcoming',
              message: `Sample ${s.sampleCode} M${month} is due soon`,
              sub: `Due in ${diffDays} days (${targetDate.toLocaleDateString()})`,
              link: `/samples/${s._id}`,
            });
          }
        }
      });
    });

    // Sort by type (overdue first)
    return list
      .sort((a, b) => (a.type === 'overdue' ? -1 : b.type === 'overdue' ? 1 : 0))
      .slice(0, 5);
  }, [samples]);

  // Compute breadcrumbs
  const breadcrumbs = useMemo(() => {
    const paths = location.pathname.split('/').filter(Boolean);
    const crumbs = [{ label: 'Home', to: '/' }];

    let currentPath = '';
    paths.forEach((p, idx) => {
      currentPath += `/${p}`;
      const isLast = idx === paths.length - 1;

      // Map path key to clean label
      let label = p.charAt(0).toUpperCase() + p.slice(1);
      if (p === 'admin') return; // Skip parent admin grouping in links if we link to subitems
      if (p === 'audit-logs') label = 'Audit Logs';

      // If it looks like a Mongo ID, format it as "Details"
      if (/^[0-9a-fA-F]{24}$/.test(p)) {
        label = 'Details';
      }

      crumbs.push({ label, to: isLast ? '' : currentPath });
    });

    return crumbs.filter(Boolean);
  }, [location.pathname]);

  // Filter main nav items by permissions
  const visibleItems = useMemo(() => {
    return NAV_ITEMS.filter(
      (item) => !item.permission || user?.permissions.includes(item.permission),
    );
  }, [user]);

  // Filter admin nested nav items by permissions
  const visibleAdminItems = useMemo(() => {
    return ADMIN_NAV_ITEMS.filter(
      (item) => !item.permission || user?.permissions.includes(item.permission),
    );
  }, [user]);

  // Handle global search submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchVal.trim()) {
      navigate(`/?search=${encodeURIComponent(searchVal.trim())}`);
      setSearchVal('');
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Sidebar - Desktop Layout */}
      <aside
        className={`hidden md:flex flex-col shrink-0 sticky top-0 h-screen transition-all duration-300 border-r border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-30 ${
          isCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-3.5 border-b border-slate-200 dark:border-slate-800">
          <Link
            to="/"
            className="flex items-center gap-2.5 overflow-hidden"
            title="NESMS Lab Dashboard"
          >
            <img
              src="/fav-logo.png"
              alt="NESMS Logo"
              className="w-8 h-8 rounded-lg object-contain shrink-0 shadow-xs"
            />
            {!isCollapsed && (
              <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white truncate">
                NESMS Lab
              </span>
            )}
          </Link>
          {!isCollapsed && (
            <button
              onClick={toggleSidebar}
              className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer transition"
              title="Collapse sidebar"
            >
              <ChevronLeft size={16} />
            </button>
          )}
        </div>

        {/* Sidebar Menu Scroll */}
        <nav
          aria-label="Main Navigation"
          className="flex-1 overflow-y-auto p-2.5 space-y-1.5 scrollbar-thin"
        >
          {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                title={isCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `flex items-center ${isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'} rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer group ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                  }`
                }
              >
                <Icon size={18} className="shrink-0 transition-transform group-hover:scale-105" />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            );
          })}

          {/* Admin Nested Section */}
          {visibleAdminItems.length > 0 && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 mt-2">
              {isCollapsed ? (
                <div className="space-y-1">
                  {visibleAdminItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        title={item.label}
                        className={({ isActive }) =>
                          `flex items-center justify-center p-2.5 rounded-xl transition cursor-pointer group ${
                            isActive
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                              : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                          }`
                        }
                      >
                        <Icon
                          size={16}
                          className="shrink-0 transition-transform group-hover:scale-105"
                        />
                      </NavLink>
                    );
                  })}
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setIsAdminOpen(!isAdminOpen)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/30 cursor-pointer"
                  >
                    <span>Administration</span>
                    {isAdminOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {isAdminOpen && (
                    <div className="mt-1 pl-2 space-y-1">
                      {visibleAdminItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer group ${
                                isActive
                                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                              }`
                            }
                          >
                            <Icon
                              size={16}
                              className="shrink-0 transition-transform group-hover:scale-105"
                            />
                            <span className="truncate">{item.label}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </nav>

        {/* Sidebar Footer */}
        {isCollapsed ? (
          <div className="p-2 border-t border-slate-200 dark:border-slate-800 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 flex items-center justify-center font-bold text-xs shrink-0 hover:ring-2 hover:ring-blue-500 transition cursor-pointer"
              title={`${user?.firstName} ${user?.lastName} (${user?.role})`}
            >
              {user?.firstName.charAt(0)}
              {user?.lastName.charAt(0)}
            </button>
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer transition"
              title="Expand sidebar"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        ) : (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="flex items-center gap-2 truncate text-left hover:opacity-80 transition cursor-pointer"
              title="Open Profile Settings"
            >
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 flex items-center justify-center font-bold text-xs shrink-0">
                {user?.firstName.charAt(0)}
                {user?.lastName.charAt(0)}
              </div>
              <div className="truncate">
                <div className="text-xs font-bold truncate">
                  {user?.firstName} {user?.lastName}
                </div>
                <div className="text-[10px] text-slate-400 truncate">{user?.role}</div>
              </div>
            </button>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-600 cursor-pointer"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Sticky Top Navigation */}
        <header className="sticky top-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 h-16 flex items-center justify-between px-4 md:px-6 z-40">
          {/* Left: Mobile hamburger & desktop sidebar toggle & breadcrumbs */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="md:hidden p-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              title="Open menu"
            >
              <Menu size={20} />
            </button>

            <button
              onClick={toggleSidebar}
              className="hidden md:flex p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <Menu size={18} />
            </button>

            {/* Breadcrumb Navigation */}
            <nav
              aria-label="Breadcrumb"
              className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400"
            >
              {breadcrumbs.map((crumb, idx) => (
                <div key={crumb.to + crumb.label} className="flex items-center gap-1.5">
                  {idx > 0 && <span className="text-slate-300 dark:text-slate-700">/</span>}
                  {crumb.to ? (
                    <Link
                      to={crumb.to}
                      className="hover:text-blue-600 dark:hover:text-blue-400 transition"
                    >
                      {crumb.label === 'Home' ? <Home size={14} /> : crumb.label}
                    </Link>
                  ) : (
                    <span className="text-slate-800 dark:text-slate-200 font-bold truncate max-w-[120px]">
                      {crumb.label}
                    </span>
                  )}
                </div>
              ))}
            </nav>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3 md:gap-4">
            {/* Global Search Bar with Autocomplete Suggestions */}
            <div className="relative search-input-container">
              <form onSubmit={handleSearchSubmit} className="hidden md:flex relative items-center">
                <Search className="absolute left-3 text-slate-400 pointer-events-none" size={16} />
                <input
                  type="text"
                  value={searchVal}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Global search..."
                  className="w-48 lg:w-64 pl-9 pr-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:focus:ring-blue-500/10"
                />
              </form>

              {suggestions.length > 0 && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-xl z-55 max-h-80 overflow-y-auto scrollbar-thin">
                  <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Auto Suggestions
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {suggestions.map((item, idx) => (
                      <Link
                        key={idx}
                        to={item.link}
                        onClick={() => {
                          setSearchVal('');
                          setSuggestions([]);
                        }}
                        className="block px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition rounded-lg text-left"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                            {item.title}
                          </span>
                          <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                            {item.type}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-400 mt-0.5">
                          {item.subtitle}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Theme Toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition cursor-pointer"
              title="Toggle theme"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Live Notifications Bell Dropdown */}
            <div className="relative notif-dropdown-trigger">
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition relative cursor-pointer"
                title="Notifications"
              >
                <Bell size={18} />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-white dark:border-slate-950 animate-pulse" />
                )}
              </button>

              {isNotificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-xl animate-menu-fade z-50">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      System Alerts
                    </span>
                    <span className="text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-extrabold px-1.5 py-0.5 rounded-full">
                      {notifications.length} alerts
                    </span>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {notifications.length === 0 ? (
                      <div className="px-3 py-6 text-center text-xs text-slate-400 italic">
                        No alerts detected. Everything is healthy.
                      </div>
                    ) : (
                      notifications.map((item) => (
                        <Link
                          key={item.id}
                          to={item.link}
                          onClick={() => setIsNotificationsOpen(false)}
                          className="block px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition rounded-lg text-left"
                        >
                          <div className="flex gap-2">
                            <span className="mt-0.5">
                              {item.type === 'overdue' ? (
                                <AlertCircle size={14} className="text-rose-500" />
                              ) : (
                                <Activity size={14} className="text-amber-500" />
                              )}
                            </span>
                            <div>
                              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                                {item.message}
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                                {item.sub}
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                  <div className="p-2 border-t border-slate-100 dark:border-slate-800">
                    <Link
                      to="/"
                      onClick={() => setIsNotificationsOpen(false)}
                      className="block text-center text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      View All in Dashboard
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative profile-dropdown-trigger">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2 p-1 pl-2.5 pr-1 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <span className="hidden lg:inline text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {user?.firstName}
                </span>
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-blue-500/20">
                  {user?.firstName.charAt(0)}
                </div>
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-xl animate-menu-fade z-50">
                  <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
                    <div className="text-xs font-bold">
                      {user?.firstName} {user?.lastName}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{user?.email}</div>
                    <span className="inline-block mt-1.5 px-2 py-0.5 text-[9px] font-extrabold uppercase bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/50 rounded-full">
                      {user?.role}
                    </span>
                  </div>
                  <div className="p-1 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileOpen(false);
                        setIsProfileModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg text-left cursor-pointer"
                    >
                      <User size={14} />
                      Profile Settings
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg text-left cursor-pointer"
                    >
                      <LogOut size={14} />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Body */}
        <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto animate-fade-in min-w-0">
          <Outlet />
        </main>

        <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
      </div>

      {/* Sidebar - Mobile Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-200"
            onClick={() => setIsMobileOpen(false)}
          />
          {/* Sidebar Drawer */}
          <aside className="relative flex flex-col w-64 h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-4 shadow-xl z-10 animate-slide-up">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <img
                  src="/fav-logo.png"
                  alt="NESMS Logo"
                  className="w-8 h-8 rounded-lg object-contain shrink-0 shadow-xs"
                />
                <span className="text-base font-extrabold text-slate-900 dark:text-white">
                  NESMS Lab
                </span>
              </div>
              <button
                onClick={() => setIsMobileOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <nav className="flex-1 space-y-1.5 overflow-y-auto">
              {visibleItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={() => setIsMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`
                    }
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}

              {visibleAdminItems.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    System Administration
                  </div>
                  {visibleAdminItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setIsMobileOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold transition ${
                            isActive
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`
                        }
                      >
                        <Icon size={16} />
                        <span>{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </nav>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                  {user?.firstName.charAt(0)}
                </div>
                <div className="truncate">
                  <div className="text-xs font-bold truncate">{user?.firstName}</div>
                  <div className="text-[10px] text-slate-400 truncate">{user?.role}</div>
                </div>
              </div>
              <button onClick={handleLogout} className="text-xs text-rose-600 hover:underline">
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
