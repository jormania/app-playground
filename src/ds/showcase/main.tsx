import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Showcase } from './Showcase'
import '../tokens.css'
import './showcase.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Showcase />
  </StrictMode>,
)
