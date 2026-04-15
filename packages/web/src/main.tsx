import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MainPage } from '@/views/pages/MainPage'
import { useSessionStore } from '@/controllers/session'
import './index.css'

// Fetch sessions on startup
useSessionStore.getState().fetchSessions()

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element #root not found')

createRoot(rootEl).render(
  <StrictMode>
    <MainPage />
  </StrictMode>
)
