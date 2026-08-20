# Frontend Architecture Documentation

## Technology Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS with custom design system variables, Lucide React icons
- **State Management & Data Fetching**: TanStack Query (React Query v5)
- **Routing**: `react-router-dom` (v6)
- **HTTP Client**: Axios with interceptors for JWT token injection and automatic token refresh

## Core Directory Structure

```
client/src/
├── assets/          # Static logos, icons, global images
├── components/      # Shared layout and UI primitive components
│   ├── admin-layout.tsx      # Sidebar + Header container layout
│   ├── protected-route.tsx   # Authenticated route wrapper
│   ├── require-permission.tsx# RBAC permission guard wrapper
│   ├── combobox.tsx          # Accessible searchable select dropdown
│   ├── profile-modal.tsx     # User profile and password update modal
│   └── ui.tsx                # Reusable UI styles, buttons, inputs, alerts
├── features/        # Domain-specific API handlers, types, and schemas
│   ├── admin/       # Users, Roles, Audit, Backup API calls & schemas
│   ├── auth/        # Auth context, Login/Refresh API calls & schemas
│   └── catalog/     # Products, Sections, Batches, Samples API calls & schemas
├── pages/           # Page view components
│   ├── admin/       # Users, Roles, Audit Logs, Backups, Categories pages
│   ├── catalog/     # Products, Sections, Batches, Samples, Records, Sample Detail pages
│   ├── dashboard.tsx# Interactive Enterprise Dashboard
│   └── login.tsx    # Secure Login view
└── lib/             # Global API client instance (`api.ts`)
```

## Key Frontend Features

1. **Permission-Gated Navigation & UI**: Sidebar menu items and action buttons render conditionally based on user permissions (`read`/`manage` keys across domain modules).
2. **Interactive Dashboard**: Features real-time KPI metrics, pull schedules, dynamic calendar date highlighting, operational timelines, and filtered data grids.
3. **Data Export & Reporting**: Supports client-side Excel (.xls XML format) and CSV export for records, single samples, and filtered catalog views.
