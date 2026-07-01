import { Routes, Route } from 'react-router-dom'
import PostList from './components/PostList'
import PostView from './components/PostView'
import AuthorPage from './components/AuthorPage'
import Footer from './components/Footer'
import './styles/App.css'

function App() {
  return (
    <div className="app">
      <main className="main-content">
        <Routes>
          <Route path="/" element={<PostList />} />
          <Route path="/categoria/:categoriaSlug" element={<PostList />} />
          <Route path="/autor/jesus-florez" element={<AuthorPage />} />
          <Route path="/:year/:month/:slug" element={<PostView />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

export default App
