import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { db } from './db/database'
import './index.css'

// Open DB before rendering
// BASE_URL is './' for native builds (Tauri/Capacitor) and '/walleys-analytics/' for web.
// React Router requires an absolute basename, so normalise './' → '/'.
const basename = import.meta.env.BASE_URL === './' ? '/' : import.meta.env.BASE_URL

db.open().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter basename={basename}>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  )
})
