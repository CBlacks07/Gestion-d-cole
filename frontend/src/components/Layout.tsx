import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  School,
  FileText,
  Calendar,
  CreditCard,
  BarChart3,
  LogOut
} from 'lucide-react'

const navigation = [
  { name: 'Tableau de bord', href: '/', icon: LayoutDashboard },
  { name: 'Élèves', href: '/eleves', icon: Users },
  { name: 'Enseignants', href: '/enseignants', icon: GraduationCap },
  { name: 'Classes', href: '/classes', icon: School },
  { name: 'Notes', href: '/notes', icon: FileText },
  { name: 'Absences', href: '/absences', icon: Calendar },
  { name: 'Paiements', href: '/paiements', icon: CreditCard },
  { name: 'Rapports', href: '/rapports', icon: BarChart3 },
]

export default function Layout() {
  const location = useLocation()
  const { user, logout } = useAuthStore()

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <div className="w-64 bg-primary-800 text-white">
        <div className="p-6">
          <h1 className="text-2xl font-bold">Gestion École</h1>
          <p className="text-primary-200 text-sm mt-1">Système Togolais</p>
        </div>

        <nav className="mt-6">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center px-6 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-900 border-l-4 border-white'
                    : 'hover:bg-primary-700'
                }`}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
              </Link>
            )
          })}
        </nav>

        <div className="absolute bottom-0 w-64 p-6 border-t border-primary-700">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium">{user?.prenom} {user?.nom}</p>
              <p className="text-xs text-primary-200">{user?.role}</p>
            </div>
            <button
              onClick={logout}
              className="p-2 hover:bg-primary-700 rounded-lg transition-colors"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
