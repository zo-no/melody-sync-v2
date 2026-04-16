import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MainPage } from '@/views/pages/MainPage'
import { useProjectStore } from '@/controllers/project'
import './index.css'

// Bootstrap: load projects on startup (auto-selects first project)
useProjectStore.getState().fetchProjects()

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element #root not found')

createRoot(rootEl).render(
  <StrictMode>
    <MainPage />
  </StrictMode>
)
