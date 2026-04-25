import { createContext, useContext, type ReactNode } from 'react'
import {
  useUploadManager,
  type UseUploadManagerReturn,
} from '../hooks/useUploadManager'

const UploadManagerContext = createContext<UseUploadManagerReturn | null>(null)

export function UploadManagerProvider({ children }: { children: ReactNode }) {
  const value = useUploadManager()
  return (
    <UploadManagerContext.Provider value={value}>
      {children}
    </UploadManagerContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUploadManagerContext(): UseUploadManagerReturn {
  const ctx = useContext(UploadManagerContext)
  if (!ctx)
    throw new Error(
      'useUploadManagerContext must be used inside UploadManagerProvider',
    )
  return ctx
}
