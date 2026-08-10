import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useAppSettings } from '../contexts/AppSettingsContext'
import api from '../services/api'
import { School, Building2, Users, TrendingUp } from 'lucide-react'

const HIGHLIGHTS = [
  { icon: Building2,  label: 'Votre établissement, votre espace', desc: 'Données isolées, propres à votre école' },
  { icon: Users,      label: 'Élèves, enseignants, classes',       desc: 'Tout géré au même endroit' },
  { icon: TrendingUp, label: 'Finances scolaires',                 desc: 'Paiements, recouvrement, rapports' },
]

export default function Signup() {
  const [ecoleNom, setEcoleNom] = useState('')
  const [codeInvitation, setCodeInvitation] = useState('')
  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const { settings } = useAppSettings()
  const appName = settings.appName || 'SchoolTogo'
  const appTagline = settings.appTagline || 'Système éducatif togolais'
  const logoUrl = settings.logoUrl || ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    setLoading(true)
    try {
      const response = await api.post('/ecoles', {
        ecoleNom: ecoleNom.trim(),
        nom: nom.trim(),
        prenom: prenom.trim(),
        email: email.trim().toLowerCase(),
        motDePasse: password,
        codeInvitation: codeInvitation.trim(),
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
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between p-10 bg-forest-900 relative overflow-hidden">
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

        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-primary-500/15 border border-primary-500/35 rounded-full px-4 py-2 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-400" />
            <span className="text-[12.5px] tracking-wide text-primary-400 font-semibold uppercase">Nouvel établissement</span>
          </div>
          <h2 className="text-4xl font-display font-bold text-cream-100 leading-tight mb-4 max-w-md">
            Créez l'espace de votre école.
          </h2>
          <p className="text-forest-100 text-sm mb-10 leading-relaxed max-w-sm">
            Un compte administrateur est créé automatiquement — vous pourrez
            ensuite inviter votre équipe depuis la section Utilisateurs.
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

        <p className="text-forest-100 text-xs relative">
          © {new Date().getFullYear()} {appName} — Développé par OPS CORPORATION
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col items-center justify-center bg-cream-100 px-5 pb-8 pt-0 -mt-5 lg:mt-0 lg:py-10">
        <div className="w-full max-w-md relative z-10">
          <div className="bg-white rounded-2xl shadow-sm border border-cream-300 p-8">
            <div className="mb-7">
              <h1 className="text-xl font-display font-bold text-gray-900">Créer votre établissement</h1>
              <p className="text-gray-500 text-sm mt-1">Quelques informations pour démarrer.</p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="codeInvitation" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Code d'invitation
                </label>
                <input
                  id="codeInvitation"
                  type="text"
                  required
                  value={codeInvitation}
                  onChange={(e) => setCodeInvitation(e.target.value)}
                  className="input"
                  placeholder="Reçu de votre contact SchoolTogo"
                  autoComplete="off"
                />
              </div>

              <div>
                <label htmlFor="ecoleNom" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nom de l'établissement
                </label>
                <input
                  id="ecoleNom"
                  type="text"
                  required
                  value={ecoleNom}
                  onChange={(e) => setEcoleNom(e.target.value)}
                  className="input"
                  placeholder="Collège Saint-Joseph"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="prenom" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Prénom
                  </label>
                  <input
                    id="prenom"
                    type="text"
                    required
                    value={prenom}
                    onChange={(e) => setPrenom(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="nom" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Nom
                  </label>
                  <input
                    id="nom"
                    type="text"
                    required
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    className="input"
                  />
                </div>
              </div>

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
                  placeholder="vous@ecole.tg"
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
                <p className="mt-1 text-xs text-gray-400">8 caractères min. avec majuscule, chiffre ou caractère spécial.</p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirmer le mot de passe
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full py-2.5 text-base disabled:opacity-50"
              >
                {loading ? 'Création en cours...' : 'Créer mon établissement'}
              </button>

              <p className="text-center text-sm text-gray-500">
                Déjà un compte ?{' '}
                <Link to="/login" className="font-medium">Se connecter</Link>
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
