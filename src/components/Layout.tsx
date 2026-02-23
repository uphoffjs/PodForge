import { Outlet } from 'react-router'

export function Layout() {
  return (
    <div className="min-h-screen bg-surface text-text-primary font-body">
      <Outlet />
    </div>
  )
}
