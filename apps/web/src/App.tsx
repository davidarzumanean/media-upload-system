import { NavLink, Outlet } from 'react-router-dom'
import { UploadManagerProvider } from './context/UploadManagerContext'

// Ionicons "cloud-upload" (filled) — identical to the mobile app's header icon
function CloudUploadIcon() {
  return (
    <svg className="w-6 h-6 text-blue-600" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
      <path d="M473.66,210c-14-10.38-31.2-18-49.36-22.11a16.11,16.11,0,0,1-12.19-12.22c-7.8-34.75-24.59-64.55-49.27-87.13C334.15,62.25,296.21,47.79,256,47.79c-35.35,0-68,11.08-94.37,32.05a150.07,150.07,0,0,0-42.06,53,16,16,0,0,1-11.31,8.87c-26.75,5.4-50.9,16.87-69.34,33.12C13.46,197.33,0,227.24,0,261.39c0,34.52,14.49,66,40.79,88.76,25.12,21.69,58.94,33.64,95.21,33.64H240V230.42l-36.69,36.69a16,16,0,0,1-23.16-.56c-5.8-6.37-5.24-16.3.85-22.39l63.69-63.68a16,16,0,0,1,22.62,0L331,244.14c6.28,6.29,6.64,16.6.39,22.91a16,16,0,0,1-22.68.06L272,230.42V383.79H396c31.34,0,59.91-8.8,80.45-24.77,23.26-18.1,35.55-44,35.55-74.83C512,254.25,498.74,228.58,473.66,210Z"/>
      <path d="M240,448.21a16,16,0,1,0,32,0V383.79H240Z"/>
    </svg>
  )
}

export default function App() {
  return (
    <UploadManagerProvider>
      <div className="min-h-screen" style={{ backgroundColor: '#f8fafc' }}>

        {/* ── Header ── */}
        <header className="bg-white sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">

            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <CloudUploadIcon />
              <span className="font-bold text-gray-900 tracking-tight">FileStream</span>
            </div>

            {/* Tab navigation */}
            <nav className="flex items-center" aria-label="Main navigation">
              <TabLink to="/">Upload</TabLink>
              <TabLink to="/history">History</TabLink>
            </nav>
          </div>

          {/* Subtle blue gradient accent line instead of a plain border */}
          <div
            aria-hidden="true"
            className="h-px bg-linear-to-r from-transparent via-blue-200 to-transparent"
          />
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
