import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Eleves from './pages/Eleves'
import EleveDetail from './pages/EleveDetail'
import Enseignants from './pages/Enseignants'
import Classes from './pages/Classes'
import ClasseDetail from './pages/ClasseDetail'
import Notes from './pages/Notes'
import Absences from './pages/Absences'
import Paiements from './pages/Paiements'
import Rapports from './pages/Rapports'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="eleves" element={<Eleves />} />
          <Route path="eleves/:id" element={<EleveDetail />} />
          <Route path="enseignants" element={<Enseignants />} />
          <Route path="classes" element={<Classes />} />
          <Route path="classes/:id" element={<ClasseDetail />} />
          <Route path="notes" element={<Notes />} />
          <Route path="absences" element={<Absences />} />
          <Route path="paiements" element={<Paiements />} />
          <Route path="rapports" element={<Rapports />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App
