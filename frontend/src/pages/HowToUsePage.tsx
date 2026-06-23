import { Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import { ThemeToggle } from '../components/ThemeToggle'
import { useAuth } from '../auth/useAuth'

export function HowToUsePage() {
  const { user } = useAuth()
  const authenticated = Boolean(user)

  return (
    <main className="login-page public-auth-page">
      <section className="login-panel public-auth-panel how-to-use-panel" aria-labelledby="how-to-use-title">
        <div className="public-theme-row">
          <div className="topbar-actions">
            {authenticated ? <Link to="/" className="icon-text-button"><span>Back to app</span></Link> : null}
            <ThemeToggle />
          </div>
        </div>

        <div className="public-auth-heading">
          <span className="public-auth-icon" aria-hidden="true">
            <BookOpen size={22} strokeWidth={2.4} />
          </span>
          <div>
            <span className="eyebrow">MerHouse</span>
            <h1 id="how-to-use-title">How To Use</h1>
            <p>A quick guide to the MerHouse fulfillment coordination platform.</p>
          </div>
        </div>

        <article className="how-to-use-content">
          <section aria-labelledby="roles-heading">
            <h2 id="roles-heading">Platform Roles</h2>
            <p>MerHouse serves six roles, each with specific responsibilities:</p>
            <dl className="role-list">
              <div>
                <dt>Owner</dt>
                <dd>Full platform governance: manage tenants, users, access requests, relationships, audit trails, outbox health, and admin accounts.</dd>
              </div>
              <div>
                <dt>Admin</dt>
                <dd>Platform governance: manage tenants, users, access requests, relationships, audit trails, and outbox health.</dd>
              </div>
              <div>
                <dt>Support Admin</dt>
                <dd>User account support and read-only operational review across the platform.</dd>
              </div>
              <div>
                <dt>Auditor</dt>
                <dd>Read-only access to governance records, service accountability, and audit evidence.</dd>
              </div>
              <div>
                <dt>Merchant</dt>
                <dd>Inventory management, order creation, inbound stock coordination, service review, and fulfillment visibility.</dd>
              </div>
              <div>
                <dt>Warehouse Operator</dt>
                <dd>Receiving inbound stock, pick/pack/ship operations, exception reporting, and service evidence.</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="onboarding-heading">
            <h2 id="onboarding-heading">Getting Started</h2>
            <p>There are two ways to get a merchant or warehouse account:</p>
            <h3>Option A: Sign Up directly</h3>
            <ol className="step-list">
              <li><strong>Go to Sign Up</strong> and create an account with your organization name, email, and password.</li>
              <li><strong>Save your recovery key</strong> — it is shown once and can reset your password without email.</li>
              <li><strong>Sign in</strong> and start using the platform immediately.</li>
            </ol>
            <h3>Option B: Request Access</h3>
            <ol className="step-list">
              <li><strong>Submit an access request</strong> from the Request Access page with your organization and email.</li>
              <li><strong>Wait for admin review</strong> — a platform admin approves and activates your account.</li>
              <li><strong>Get your credentials</strong> — the admin provides your temporary password separately.</li>
              <li><strong>Sign in</strong> and change your password from Account settings.</li>
            </ol>
            <p>If you lose access to your email, use the <strong>Recovery Key</strong> tab on the Forgot Password page to reset your password instantly.</p>
          </section>

          <section aria-labelledby="order-workflow-heading">
            <h2 id="order-workflow-heading">Order Workflow</h2>
            <p>The merchant-to-warehouse fulfillment flow:</p>
            <ol className="step-list">
              <li><strong>Create inventory</strong> — merchants add stock items with SKUs and quantities.</li>
              <li><strong>Connect a warehouse</strong> — establish a service relationship with a warehouse provider.</li>
              <li><strong>Send inbound stock</strong> — ship inventory to the warehouse for storage.</li>
              <li><strong>Create orders</strong> — merchants create customer orders from available inventory.</li>
              <li><strong>System allocates</strong> — inventory is reserved against open orders.</li>
              <li><strong>Warehouse fulfills</strong> — operators pick, pack, and ship allocated orders.</li>
              <li><strong>Shipment delivered</strong> — tracking and evidence are recorded.</li>
            </ol>
          </section>

          <section aria-labelledby="warehouse-workflow-heading">
            <h2 id="warehouse-workflow-heading">Warehouse Workflow</h2>
            <p>The operator's daily work:</p>
            <dl className="role-list">
              <div>
                <dt>Inbound Receiving</dt>
                <dd>Accept incoming stock from merchants, verify quantities, and record discrepancies.</dd>
              </div>
              <div>
                <dt>Pick / Pack / Ship</dt>
                <dd>Process allocated orders: pick items, pack for shipment, and record shipping details.</dd>
              </div>
              <div>
                <dt>Exceptions</dt>
                <dd>Report issues like damaged goods, missing items, or fulfillment blockers.</dd>
              </div>
              <div>
                <dt>Service Evidence</dt>
                <dd>Track SLA compliance and service accountability records.</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="navigation-heading">
            <h2 id="navigation-heading">Navigation Guide</h2>
            <dl className="role-list">
              <div>
                <dt>Overview / Home</dt>
                <dd>Role-specific dashboard with attention-first work queues and operational metrics.</dd>
              </div>
              <div>
                <dt>Stock / Inventory</dt>
                <dd>Manage inventory items, quantities, and stock levels (Merchant).</dd>
              </div>
              <div>
                <dt>Orders</dt>
                <dd>View and create customer orders, track allocation and fulfillment status (Merchant).</dd>
              </div>
              <div>
                <dt>Warehouse Console</dt>
                <dd>Receiving, pick/pack/ship queue, shipments, exceptions, and inventory adjustment (Warehouse Operator).</dd>
              </div>
              <div>
                <dt>Service Accountability</dt>
                <dd>Agreements, rate cards, SLA review, service statements, disputes, claims, and reviews (all roles).</dd>
              </div>
              <div>
                <dt>Alerts</dt>
                <dd>Notification inbox for account events, operational handoffs, and delivery updates (all roles).</dd>
              </div>
              <div>
                <dt>Account</dt>
                <dd>View account context and change your password (all roles).</dd>
              </div>
              <div>
                <dt>Admin Overview</dt>
                <dd>Platform governance: tenants, users, access requests, relationships, outbox, and audit (Owner, Admin, Support Admin, Auditor).</dd>
              </div>
            </dl>
          </section>
        </article>

        <nav className="login-actions" aria-label="Account help">
          {authenticated ? (
            <Link to="/">Back to app</Link>
          ) : (
            <>
              <Link to="/login">Sign in</Link>
              <Link to="/forgot-password">Forgot password?</Link>
              <Link to="/sign-up">Sign up</Link>
            </>
          )}
        </nav>
      </section>
    </main>
  )
}
