import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { ToastProvider } from './contexts/ToastContext'
import ToastContainer from './components/ToastContainer'
import { AppSettingsProvider } from './contexts/AppSettingsContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Signup from './pages/Signup'
import MentionsLegales from './pages/MentionsLegales'
import Confidentialite from './pages/Confidentialite'
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
import Configuration from './pages/Configuration'
import Utilisateurs from './pages/Utilisateurs'
import AuditLogs from './pages/AuditLogs'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />
}

function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { user } = useAuthStore()
  const userRole = String(user?.role || '').toUpperCase()
  return roles.includes(userRole) ? <>{children}</> : <Navigate to="/" replace />
}

const ADMIN_DIRECTEUR = ['ADMIN', 'DIRECTEUR']
const ADMIN_DIRECTEUR_SECRETAIRE = ['ADMIN', 'DIRECTEUR', 'SECRETAIRE']
const NOTES_ROLES = ['ADMIN', 'DIRECTEUR', 'ENSEIGNANT']

function App() {
  return (
    <AppSettingsProvider>
    <ToastProvider>
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/mentions-legales" element={<MentionsLegales />} />
        <Route path="/confidentialite" element={<Confidentialite />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="eleves" element={<RequireRole roles={ADMIN_DIRECTEUR_SECRETAIRE}><Eleves /></RequireRole>} />
          <Route path="eleves/:id" element={<RequireRole roles={ADMIN_DIRECTEUR_SECRETAIRE}><EleveDetail /></RequireRole>} />
          <Route path="enseignants" element={<RequireRole roles={ADMIN_DIRECTEUR_SECRETAIRE}><Enseignants /></RequireRole>} />
          <Route path="classes" element={<Classes />} />
          <Route path="classes/:id" element={<ClasseDetail />} />
          <Route path="notes" element={
            <RequireRole roles={NOTES_ROLES}><Notes /></RequireRole>
          } />
          <Route path="absences" element={<RequireRole roles={ADMIN_DIRECTEUR_SECRETAIRE}><Absences /></RequireRole>} />
          <Route
            path="paiements"
            element={
              <RequireRole roles={ADMIN_DIRECTEUR_SECRETAIRE}>
                <Paiements />
              </RequireRole>
            }
          />
          <Route path="rapports" element={
            <RequireRole roles={ADMIN_DIRECTEUR}><Rapports /></RequireRole>
          } />
          <Route path="configuration" element={
            <RequireRole roles={ADMIN_DIRECTEUR}><Configuration /></RequireRole>
          } />
          <Route path="utilisateurs" element={
            <RequireRole roles={ADMIN_DIRECTEUR}><Utilisateurs /></RequireRole>
          } />
          <Route path="audit-logs" element={
            <RequireRole roles={['ADMIN']}><AuditLogs /></RequireRole>
          } />
        </Route>
      </Routes>
    </Router>
    <ToastContainer />
    </ToastProvider>
    </AppSettingsProvider>
  )
}

export default App
