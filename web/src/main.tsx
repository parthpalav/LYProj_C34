import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/utilities.css'
import './styles/plan.css'
import './styles/insights.css'
import './styles/reports.css'
import './styles/activity.css'
import './styles/overview.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
