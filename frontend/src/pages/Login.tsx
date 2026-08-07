import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useAppSettings } from '../contexts/AppSettingsContext'
import api from '../services/api'
import { School, BookOpen, Users, TrendingUp } from 'lucide-react'

const HIGHLIGHTS = [
  { icon: Users,      label: 'Gestion des élèves',      desc: 'Inscriptions, dossiers, bulletins' },
  { icon: BookOpen,   label: 'Suivi académique',         desc: 'Notes, absences, résultats' },
  { icon: TrendingUp, label: 'Finances scolaires',       desc: 'Paiements, recouvrement, rapports' },
]

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const { settings } = useAppSettings()
  const appName = settings.appName || 'Gestion École'
  const appTagline = settings.appTagline || 'Système éducatif togolais'
  const logoUrl = settings.logoUrl || ''

  useEffect(() => {
    const msg = sessionStorage.getItem('auth_redirect_msg')
    if (msg) {
      setInfo(msg)
      sessionStorage.removeItem('auth_redirect_msg')
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await api.post('/auth/login', {
        email: email.trim().toLowerCase(),
        motDePasse: password,
      })
      const { token, ...user } = response.data
      login(user, token)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Mobile top branding band — hidden on desktop (replaced by the side panel below) */}
      <div className="lg:hidden relative bg-forest-900 pt-10 pb-7 px-6 overflow-hidden shrink-0">
        <div
          className="absolute inset-0 opacity-[0.32] pointer-events-none"
          style={{
            backgroundImage: "url('/togo-flag.png')",
            backgroundSize: '160%',
            backgroundPosition: 'center',
            transform: 'rotate(-9deg) scale(1.18)',
            maskImage: 'radial-gradient(ellipse 70% 70% at 50% 40%, black 35%, transparent 85%)',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 70% at 50% 40%, black 35%, transparent 85%)',
          }}
        />
        <div className="relative flex flex-col items-center gap-2 text-center">
          <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center overflow-hidden">
            {logoUrl
              ? <img src={logoUrl} alt="Logo" className="h-full w-full object-contain p-1" />
              : <School className="h-8 w-8 text-primary-400" />
            }
          </div>
          <p className="text-cream-100 font-display font-bold text-base">{appName}</p>
          <p className="text-forest-100 text-xs">{appTagline}</p>
        </div>
      </div>

      {/* Left branding panel — hidden on mobile */}
      <div
        className="hidden lg:flex lg:w-[45%] flex-col justify-between p-10 bg-forest-900 relative overflow-hidden"
      >
        <div
          className="absolute inset-0 opacity-[0.32] pointer-events-none"
          style={{
            backgroundImage: "url('/togo-flag.png')",
            backgroundSize: '115%',
            backgroundPosition: 'center',
            transform: 'rotate(-9deg) scale(1.18)',
            maskImage: 'radial-gradient(ellipse 65% 65% at 50% 45%, black 35%, transparent 85%)',
            WebkitMaskImage: 'radial-gradient(ellipse 65% 65% at 50% 45%, black 35%, transparent 85%)',
          }}
        />
        <div className="absolute -top-28 -right-28 w-80 h-80 rounded-full bg-forest-800 pointer-events-none" />
        <div className="absolute -bottom-36 -left-24 w-64 h-64 rounded-full border border-forest-500 pointer-events-none" />

        {/* Logo */}
        <div className="flex items-center gap-3 relative">
          <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">
            {logoUrl
              ? <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
              : <School className="h-6 w-6 text-primary-400" />
            }
          </div>
          <div>
            <p className="text-cream-100 font-display font-bold text-sm leading-tight">{appName}</p>
            <p className="text-forest-100 text-xs">{appTagline}</p>
          </div>
        </div>

        {/* Center content */}
        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-primary-500/15 border border-primary-500/35 rounded-full px-4 py-2 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-400" />
            <span className="text-[12.5px] tracking-wide text-primary-400 font-semibold uppercase">{appTagline}</span>
          </div>
          <h2 className="text-4xl font-display font-bold text-cream-100 leading-tight mb-4 max-w-md">
            Gérez votre école, en toute simplicité.
          </h2>
          <p className="text-forest-100 text-sm mb-10 leading-relaxed max-w-sm">
            Plateforme complète de gestion scolaire — élèves, enseignants, notes,
            absences et paiements en un seul endroit.
          </p>

          <div className="space-y-4 max-w-sm">
            {HIGHLIGHTS.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-center gap-3.5">
                <div className="h-8 w-8 rounded-lg bg-primary-500/15 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-primary-400" />
                </div>
                <div>
                  <p className="text-cream-100 text-sm font-medium">{label}</p>
                  <p className="text-forest-100 text-xs">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-forest-100 text-xs relative">
          © {new Date().getFullYear()} {appName} — Développé par OPS CORPORATION
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col items-center justify-center bg-cream-100 px-5 pb-8 pt-0 -mt-5 lg:mt-0 lg:py-10">
        <div className="w-full max-w-md">
          <div className="relative z-10 bg-white rounded-2xl shadow-sm border border-cream-300 p-8">
            <div className="mb-7">
              <h1 className="text-xl font-display font-bold text-gray-900">Connexion</h1>
              <p className="text-gray-500 text-sm mt-1">Entrez vos identifiants pour accéder au tableau de bord.</p>
            </div>

            {info && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm">
                {info}
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Adresse e-mail
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="votre@email.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Mot de passe
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full py-2.5 text-base disabled:opacity-50"
              >
                {loading ? 'Connexion en cours...' : 'Se connecter'}
              </button>

              <p className="text-center text-sm text-gray-500">
                Nouvel établissement ?{' '}
                <Link to="/signup" className="font-medium">Créer votre espace</Link>
              </p>
            </form>
          </div>
        </div>

        <p className="lg:hidden text-center text-[11px] text-gray-400 mt-6">
          © {new Date().getFullYear()} {appName} — Développé par OPS CORPORATION
        </p>
      </div>
    </div>
  )
}
