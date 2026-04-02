import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { db } from './db/database'
import './index.css'

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
