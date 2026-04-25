import { Outlet } from 'react-router-dom'
import { UploadManagerProvider } from './context/UploadManagerContext'
import { ToastProvider } from './context/ToastContext'
import { Toast } from './components/Toast'
import { AppHeader } from "./components/AppHeader.tsx";

export default function App() {
  return (
    <ToastProvider>
      <Toast />
      <UploadManagerProvider>
        <div className="min-h-screen bg-slate-50">
          <AppHeader />
          <Outlet />
        </div>
      </UploadManagerProvider>
    </ToastProvider>
  )
}
