import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { EmptyState } from '../components/DataState'

function errorMessage(error: unknown) {
  if (isRouteErrorResponse(error)) {
    return error.status === 404
      ? 'That page or operational record is not available to this account.'
      : error.statusText || 'The requested page could not be opened.'
  }
  if (error instanceof Error) {
    return 'The requested page could not be opened.'
  }
  return 'That page or operational record is not available to this account.'
}

export function RouteErrorPage() {
  const error = useRouteError()

  return (
    <section className="page-stack" aria-labelledby="route-error-heading">
      <div className="page-heading">
        <span className="eyebrow">Route unavailable</span>
        <h1 id="route-error-heading">We could not open that page</h1>
        <p>{errorMessage(error)}</p>
      </div>
      <EmptyState
        label="Use a visible workflow link"
        guidance="Open the related order, shipment, inbound request, relationship, service issue, or alert from the role queue so MerHouse can keep tenant and role context intact."
        action={<Link className="table-button" to="/">Return to your workspace</Link>}
      />
    </section>
  )
}

export function NotFoundPage() {
  return (
    <section className="page-stack" aria-labelledby="not-found-heading">
      <div className="page-heading">
        <span className="eyebrow">Page unavailable</span>
        <h1 id="not-found-heading">This workspace route is not available</h1>
        <p>Use the workflow navigation or an object link from an attention queue to continue.</p>
      </div>
      <EmptyState
        label="No matching route"
        guidance="MerHouse opens operational detail pages from orders, shipments, inbound stock, relationships, alerts, and service review records. Direct links outside those routes are handled here without exposing framework errors."
        action={<Link className="table-button" to="/">Return to your workspace</Link>}
      />
    </section>
  )
}
