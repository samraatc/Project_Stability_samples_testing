import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/protected-route';
import { RequirePermission } from '@/components/require-permission';
import { AdminLayout } from '@/components/admin-layout';
import { LoginPage } from '@/pages/login';
import { DashboardPage } from '@/pages/dashboard';
import { UsersPage } from '@/pages/admin/users';
import { RolesPage } from '@/pages/admin/roles';
import { AuditLogsPage } from '@/pages/admin/audit-logs';
import { BackupsPage } from '@/pages/admin/backups';
import { ProductsPage } from '@/pages/catalog/products';
import { SectionsPage } from '@/pages/catalog/sections';
import { BatchesPage } from '@/pages/catalog/batches';
import { SamplesPage } from '@/pages/catalog/samples';
import { SampleDetailPage } from '@/pages/catalog/sample-detail';
import { CategoriesPage } from '@/pages/admin/categories';
import { RecordsPage } from '@/pages/catalog/records';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route
          path="/products"
          element={
            <RequirePermission permission="products:read">
              <ProductsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/sections"
          element={
            <RequirePermission permission="sections:read">
              <SectionsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/batches"
          element={
            <RequirePermission permission="batches:read">
              <BatchesPage />
            </RequirePermission>
          }
        />
        <Route
          path="/samples"
          element={
            <RequirePermission permission="samples:read">
              <SamplesPage />
            </RequirePermission>
          }
        />
        <Route
          path="/samples/:id"
          element={
            <RequirePermission permission="samples:read">
              <SampleDetailPage />
            </RequirePermission>
          }
        />
        <Route
          path="/records"
          element={
            <RequirePermission permission="samples:read">
              <RecordsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequirePermission permission="users:read">
              <UsersPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/roles"
          element={
            <RequirePermission permission="roles:read">
              <RolesPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/audit-logs"
          element={
            <RequirePermission permission="audit-logs:read">
              <AuditLogsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/backups"
          element={
            <RequirePermission permission="backups:manage">
              <BackupsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/categories"
          element={
            <RequirePermission permission="categories:read">
              <CategoriesPage />
            </RequirePermission>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
