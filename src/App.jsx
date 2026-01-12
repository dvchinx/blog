import { Routes, Route } from 'react-router-dom'
import PostList from './components/PostList'
import PostView from './components/PostView'
import Footer from './components/Footer'
import './styles/App.css'

function App() {
  return (
    <div className="app">
      <div className="background-spheres">
        <div className="sphere sphere-1"></div>
        <div className="sphere sphere-2"></div>
        <div className="sphere sphere-3"></div>
      </div>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<PostList />} />
          <Route path="/:year/:month/:slug" element={<PostView />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

export default App
