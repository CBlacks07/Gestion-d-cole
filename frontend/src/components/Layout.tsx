import { Outlet, Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import ConfirmDialog from './ConfirmDialog'
import GlobalSearch from './GlobalSearch'
import api from '../services/api'
import { useToast } from '../contexts/ToastContext'
import { useAppSettings } from '../contexts/AppSettingsContext'
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  School,
  FileText,
  Calendar,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  ShieldCheck,
  KeyRound,
  Menu,
  X,
  Moon,
  Sun,
  ClipboardList,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react'

const navGroups = [
  {
    label: 'Principal',
    items: [
      { name: 'Tableau de bord', href: '/', icon: LayoutDashboard, roles: null },
    ],
  },
  {
    label: 'Scolaire',
    items: [
      { name: 'Élèves',      href: '/eleves',      icon: Users,         roles: ['ADMIN', 'DIRECTEUR', 'SECRETAIRE'] },
      { name: 'Enseignants', href: '/enseignants', icon: GraduationCap, roles: ['ADMIN', 'DIRECTEUR', 'SECRETAIRE'] },
      { name: 'Classes',     href: '/classes',     icon: School,        roles: null },
      { name: 'Notes',       href: '/notes',       icon: FileText,      roles: ['ADMIN', 'DIRECTEUR', 'ENSEIGNANT'] },
      { name: 'Absences',    href: '/absences',    icon: Calendar,      roles: ['ADMIN', 'DIRECTEUR', 'SECRETAIRE'] },
    ],
  },
  {
    label: 'Finances',
    items: [
      { name: 'Paiements', href: '/paiements', icon: CreditCard, roles: ['ADMIN', 'DIRECTEUR', 'SECRETAIRE'] },
      { name: 'Rapports',  href: '/rapports',  icon: BarChart3,  roles: ['ADMIN', 'DIRECTEUR'] },
    ],
  },
  {
    label: 'Administration',
    items: [
      { name: 'Utilisateurs',    href: '/utilisateurs', icon: ShieldCheck,   roles: ['ADMIN', 'DIRECTEUR'] },
      { name: "Journal d'audit", href: '/audit-logs',   icon: ClipboardList, roles: ['ADMIN'] },
      { name: 'Configuration',   href: '/configuration',icon: Settings,      roles: ['ADMIN', 'DIRECTEUR'] },
    ],
  },
]

export default function Layout() {
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const { success, error: toastError } = useToast()
  const { settings, toggleDarkMode } = useAppSettings()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar:collapsed') === 'true')
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' })
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    localStorage.setItem('sidebar:collapsed', String(collapsed))
  }, [collapsed])

  const userRole = String(user?.role || '').toUpperCase()
  const initials = `${user?.prenom?.[0] ?? ''}${user?.nom?.[0] ?? ''}`.toUpperCase()

  const handleLogout = () => {
    logout()
    window.location.href = '/login'
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordForm.next !== passwordForm.confirm) {
      toastError('Les nouveaux mots de passe ne correspondent pas')
      return
    }
    const pwd = passwordForm.next
    const isStrong = pwd.length >= 8 && (/[A-Z]/.test(pwd) || /[0-9]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd))
    if (!isStrong) {
      toastError('Le mot de passe doit contenir au moins 8 caractères avec au moins une majuscule, un chiffre ou un caractère spécial')
      return
    }
    setChangingPassword(true)
    try {
      await api.put('/auth/change-password', {
        currentPassword: passwordForm.current,
        newPassword: passwordForm.next
      })
      success('Mot de passe mis à jour avec succès')
      setShowPasswordModal(false)
      setPasswordForm({ current: '', next: '', confirm: '' })
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Erreur lors du changement de mot de passe')
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <div className="h-screen overflow-hidden flex bg-slate-50 dark:bg-gray-950">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col bg-forest-900 transition-all duration-200 lg:relative lg:translate-x-0 lg:z-auto ${
          sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full w-64'
        } ${collapsed ? 'lg:w-16' : 'lg:w-64'}`}
      >
        {/* Logo */}
        <div className={`flex h-14 items-center border-b border-forest-700 shrink-0 ${collapsed ? 'lg:justify-center lg:px-0 px-4 justify-between' : 'justify-between px-4'}`}>
          <Link to="/" className={`flex items-center gap-2.5 min-w-0 ${collapsed ? 'lg:justify-center' : ''}`} onClick={() => setSidebarOpen(false)}>
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt="Logo"
                className="h-7 w-7 shrink-0 rounded-lg object-contain"
              />
            ) : (
              <div className="h-7 w-7 shrink-0 rounded-lg bg-primary-500 flex items-center justify-center">
                <School className="h-4 w-4 text-forest-900" />
              </div>
            )}
            <div className={`min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
              <p className="text-sm font-display font-semibold text-cream-100 leading-tight truncate">
                {settings.appName}
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCollapsed(c => !c)}
              className="hidden lg:flex p-1.5 rounded-lg text-forest-100 hover:bg-forest-700 transition-colors"
              title={collapsed ? 'Ouvrir la sidebar' : 'Réduire la sidebar'}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-forest-100 hover:bg-forest-700 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className={`flex-1 overflow-y-auto py-3 space-y-0.5 ${collapsed ? 'lg:px-1.5 px-3' : 'px-3'}`}>
          {navGroups.map((group) => {
            const visibleItems = group.items.filter(
              (item) => !item.roles || item.roles.includes(userRole)
            )
            if (visibleItems.length === 0) return null
            return (
              <div key={group.label} className="mb-3">
                <p className={`px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-forest-100 select-none ${collapsed ? 'lg:hidden' : ''}`}>
                  {group.label}
                </p>
                {collapsed && <div className="hidden lg:block h-px bg-forest-700 my-2 mx-1" />}
                {visibleItems.map((item) => {
                  const isActive = location.pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      title={collapsed ? item.name : undefined}
                      className={`flex items-center rounded-lg text-sm font-medium transition-all duration-100 ${
                        collapsed ? 'lg:justify-center lg:px-0 lg:py-2 gap-2.5 px-2.5 py-2' : 'gap-2.5 px-2.5 py-2'
                      } ${
                        isActive
                          ? 'bg-forest-600 text-cream-100'
                          : 'text-forest-100 hover:bg-forest-700 hover:text-cream-100'
                      }`}
                    >
                      <item.icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-primary-400' : ''}`} />
                      <span className={collapsed ? 'lg:hidden' : ''}>{item.name}</span>
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* User footer */}
        <div className={`shrink-0 border-t border-forest-700 p-3 ${collapsed ? 'lg:px-1.5' : ''}`}>
          {collapsed ? (
            <div className="hidden lg:flex flex-col items-center gap-2">
              <div className="h-8 w-8 shrink-0 rounded-full bg-forest-400 flex items-center justify-center text-cream-100 text-xs font-display font-bold">
                {initials || '?'}
              </div>
              <button
                onClick={() => setShowPasswordModal(true)}
                className="p-1.5 rounded-lg text-forest-100 hover:bg-forest-700 hover:text-cream-100 transition-colors"
                title="Changer le mot de passe"
              >
                <KeyRound className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="p-1.5 rounded-lg text-forest-100 hover:bg-red-900/30 hover:text-red-300 transition-colors"
                title="Déconnexion"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
          <div className={`flex items-center gap-2.5 ${collapsed ? 'lg:hidden' : ''}`}>
            <div className="h-8 w-8 shrink-0 rounded-full bg-forest-400 flex items-center justify-center text-cream-100 text-xs font-display font-bold">
              {initials || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-cream-100 truncate">
                {user?.prenom} {user?.nom}
              </p>
              <p className="text-[11px] text-forest-100 capitalize">{user?.role?.toLowerCase()}</p>
            </div>
            <button
              onClick={() => setShowPasswordModal(true)}
              className="p-1.5 rounded-lg text-forest-100 hover:bg-forest-700 hover:text-cream-100 transition-colors shrink-0"
              title="Changer le mot de passe"
            >
              <KeyRound className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="p-1.5 rounded-lg text-forest-100 hover:bg-red-900/30 hover:text-red-300 transition-colors shrink-0"
              title="Déconnexion"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Contenu principal ── */}
      <div className="flex-1 flex flex-col overflow-auto min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-10 h-14 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <Menu className="h-4 w-4" />
            </button>
            <GlobalSearch />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title={settings.darkMode ? 'Mode clair' : 'Mode sombre'}
            >
              {settings.darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-gray-100 dark:border-gray-800 ml-1">
              <div className="h-7 w-7 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-700 dark:text-primary-300 text-xs font-bold shrink-0">
                {initials || '?'}
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400 hidden md:block">
                {user?.prenom} {user?.nom}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-5 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Logout confirm */}
      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="Confirmer la déconnexion"
        message="Êtes-vous sûr de vouloir vous déconnecter ?"
        confirmText="Se déconnecter"
        cancelText="Annuler"
        type="warning"
      />

      {/* Change password modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 shadow-xl border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-base font-display font-semibold text-gray-900 dark:text-white">Changer le mot de passe</h3>
              <button
                onClick={() => { setShowPasswordModal(false); setPasswordForm({ current: '', next: '', confirm: '' }) }}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Mot de passe actuel</label>
                <input type="password" required value={passwordForm.current}
                  onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                  className="input" placeholder="••••••••" autoComplete="current-password" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Nouveau mot de passe</label>
                <input type="password" required value={passwordForm.next}
                  onChange={(e) => setPasswordForm({ ...passwordForm, next: e.target.value })}
                  className="input" placeholder="••••••••" autoComplete="new-password" />
                <p className="mt-1 text-xs text-gray-400">8 caractères min. avec majuscule, chiffre ou caractère spécial.</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Confirmer</label>
                <input type="password" required value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                  className="input" placeholder="••••••••" autoComplete="new-password" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setShowPasswordModal(false); setPasswordForm({ current: '', next: '', confirm: '' }) }}
                  className="btn btn-secondary flex-1">Annuler</button>
                <button type="submit" disabled={changingPassword} className="btn btn-primary flex-1">
                  {changingPassword ? 'Mise à jour...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
