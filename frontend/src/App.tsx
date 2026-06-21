import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { AppLayout } from './components/AppLayout'
import { RequireAuth } from './components/RequireAuth'
import { ThemeProvider } from './theme/ThemeContext'
import {
  AdminAccessRequestsPage,
  AdminAuditPage,
  AdminOutboxPage,
  AdminOverviewPage,
  AdminRelationshipsPage,
  AdminTenantsPage,
  AdminUsersPage,
} from './pages/AdminPages'
import { ForgotPasswordPage, RequestAccessPage, SignUpPage, ResetPasswordPage } from './pages/AuthRecoveryPages'
import { AccountPage } from './pages/AccountPage'
import { HomeRedirect } from './pages/HomeRedirect'
import { HowToUsePage } from './pages/HowToUsePage'
import { LoginPage } from './pages/LoginPage'
import { MerchantInventoryPage, MerchantOrdersPage, MerchantOverviewPage } from './pages/MerchantPages'
import { NotificationCenterPage } from './pages/NotificationsRoutePage'
import { NotFoundPage, RouteErrorPage } from './pages/NotFoundPage'
import { ServiceAccountabilityPage } from './pages/ServiceAccountabilityPage'
import {
  FulfillmentAllocationDetailPage,
  InboundStockRequestDetailPage,
  InventoryItemDetailPage,
  MerchantWarehouseRelationshipDetailPage,
  OrderDetailPage,
  ShipmentDetailPage,
} from './pages/OperationalDetailPages'
import { WarehousePage } from './pages/WarehousePage'

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/sign-up', element: <SignUpPage /> },
  { path: '/request-access', element: <RequestAccessPage /> },
  { path: '/how-to-use', element: <HowToUsePage /> },
  {
    path: '/',
    element: <RequireAuth />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <AppLayout />,
        errorElement: <RouteErrorPage />,
        children: [
          { index: true, element: <HomeRedirect /> },
          {
            element: <RequireAuth roles={['OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR']} />,
            children: [
              { path: '/admin', element: <AdminOverviewPage /> },
              { path: '/admin/relationships', element: <AdminRelationshipsPage /> },
              { path: '/admin/outbox', element: <AdminOutboxPage /> },
              { path: '/admin/audit', element: <AdminAuditPage /> },
            ],
          },
          {
            element: <RequireAuth roles={['OWNER', 'ADMIN']} />,
            children: [
              { path: '/admin/tenants', element: <AdminTenantsPage /> },
            ],
          },
          {
            element: <RequireAuth roles={['OWNER', 'ADMIN', 'SUPPORT_ADMIN']} />,
            children: [
              { path: '/admin/users', element: <AdminUsersPage /> },
              { path: '/admin/access-requests', element: <AdminAccessRequestsPage /> },
            ],
          },
          {
            element: <RequireAuth roles={['MERCHANT']} />,
            children: [
              { path: '/merchant', element: <MerchantOverviewPage /> },
              { path: '/merchant/inventory', element: <MerchantInventoryPage /> },
              { path: '/merchant/orders', element: <MerchantOrdersPage /> },
            ],
          },
          {
            element: <RequireAuth roles={['WAREHOUSE_OPERATOR']} />,
            children: [{ path: '/warehouse', element: <WarehousePage /> }],
          },
          {
            element: <RequireAuth roles={['OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'MERCHANT', 'WAREHOUSE_OPERATOR']} />,
            children: [
              { path: '/service-accountability', element: <ServiceAccountabilityPage /> },
              { path: '/notifications', element: <NotificationCenterPage /> },
              { path: '/account', element: <AccountPage /> },
              { path: '/orders/:orderId', element: <OrderDetailPage /> },
              { path: '/inbound-stock-requests/:inboundStockRequestId', element: <InboundStockRequestDetailPage /> },
              { path: '/shipments/:shipmentId', element: <ShipmentDetailPage /> },
              { path: '/fulfillment-allocations/:allocationId', element: <FulfillmentAllocationDetailPage /> },
              { path: '/merchant-warehouse/relationships/:relationshipId', element: <MerchantWarehouseRelationshipDetailPage /> },
            ],
          },
          {
            element: <RequireAuth roles={['OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'MERCHANT']} />,
            children: [
              { path: '/inventory/items/:inventoryItemId', element: <InventoryItemDetailPage /> },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
