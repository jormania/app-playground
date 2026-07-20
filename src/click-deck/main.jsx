import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './styles/theme.css'

// Watch installed state for Cabinet handoff
import { watchInstalled } from '../shared/installFlag'
watchInstalled('click-deck-react.html')

// The service worker would go here, but omitted for now while we build MVP without a SW

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
