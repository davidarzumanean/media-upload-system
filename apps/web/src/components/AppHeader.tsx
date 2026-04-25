import {NavLink} from "react-router-dom";
import {CloudUploadIcon} from "./icons/CloudUploadIcon.tsx";

export function AppHeader() {
  return (
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
