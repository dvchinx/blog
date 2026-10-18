import { Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import PostList from './components/PostList'
import AuthorPage from './components/AuthorPage'
import NotFound from './components/NotFound'
import NewsletterConfirm from './components/NewsletterConfirm'
import NewsletterPreferences from './components/NewsletterPreferences'
import PrivacyPolicy from './components/PrivacyPolicy'
import Footer from './components/Footer'
import { PostView } from './routes'
import './styles/App.css'
// Eager on purpose: the prerendered article HTML needs these styles before
// the lazy PostView chunk arrives, or it would flash unstyled.
import './styles/PostView.css'

function App() {
  return (
    <div className="app">
      <main className="main-content">
        <Suspense fallback={<div className="loading">Cargando…</div>}>
          <Routes>
            <Route path="/" element={<PostList />} />
            <Route path="/categoria/:categoriaSlug" element={<PostList />} />
            <Route path="/autor/jesus-florez" element={<AuthorPage />} />
            <Route path="/newsletter/confirmar" element={<NewsletterConfirm />} />
            <Route path="/newsletter/preferencias" element={<NewsletterPreferences />} />
            <Route path="/privacidad" element={<PrivacyPolicy />} />
            <Route path="/:year/:month/:slug" element={<PostView />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}

export default App
