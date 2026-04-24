import { NavLink, Outlet } from 'react-router-dom'
import { UploadManagerProvider } from './context/UploadManagerContext'

function UploadIcon() {
  return (
    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  )
}

export default function App() {
  return (
    <UploadManagerProvider>
      <div className="min-h-screen" style={{ backgroundColor: '#f8fafc' }}>
        {/* ── Header ── */}
        <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center" aria-hidden="true">
                <UploadIcon />
              </div>
              <span className="font-semibold text-gray-900 text-sm tracking-tight">FileStream</span>
            </div>

            {/* Tabs */}
            <nav className="flex items-center gap-1" aria-label="Main navigation">
              <TabLink to="/">Upload</TabLink>
              <TabLink to="/history">History</TabLink>
            </nav>
          </div>
        </header>

        {/* ── Page outlet ── */}
        <Outlet />
      </div>
    </UploadManagerProvider>
  )
}

function TabLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        [
          'relative px-3 h-14 flex items-center text-sm font-medium transition-colors',
          'border-b-2',
          isActive
            ? 'text-blue-600 border-blue-600'
            : 'text-gray-500 border-transparent hover:text-gray-800 hover:border-gray-200',
        ].join(' ')
      }
    >
      {children}
    </NavLink>
  )
}
