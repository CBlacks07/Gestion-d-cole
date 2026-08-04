import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { useAuthStore } from '../store/authStore'
import { SkeletonDashboard } from '../components/Skeleton'
import {
  AlertTriangle,
  Clock,
  UserPlus,
  CreditCard,
  TrendingUp,
  Calendar,
  FileText,
  ArrowRight
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface EleveAlerte {
  id: string
  nom: string
  prenom: string
  nbAbsences: number
}

interface DernierEleve {
  id: string
  nom: string
  prenom: string
  matricule: string
  created_at: string
}

interface DernierPaiement {
  id: string
  montant: number
  typePaiement: string
  datePaiement: string
  statut: string
  elevenom: string
}

interface DashboardData {
  totalEleves: number
  totalClasses: number
  totalEnseignants: number
  elevesParCycle: Array<{ _id: string; count: number }>
  recettesTotal: number
  devise: string
  paiements?: {
    totalAttendu: number
    recettesScolarite: number
    resteRecouvrer: number
    elevesImpayes: number
    tauxRecouvrement: number
  }
  alertes: {
    paiementsEnAttente: { count: number; total: number }
    absencesMois: number
    elevesAbsentsSouvent: EleveAlerte[]
  }
  activiteRecente: {
    derniersEleves: DernierEleve[]
    derniersP: DernierPaiement[]
  }
  meta?: {
    isTeacherView?: boolean
    notesSaisiesMois?: number
    matieresAttribuees?: number
  }
}

const statutColors: Record<string, string> = {
  VALIDE:     'bg-emerald-100 text-emerald-700',
  EN_ATTENTE: 'bg-amber-100 text-amber-700',
  ANNULE:     'bg-red-100 text-red-700',
}

type StatCardProps = {
  title: string
  value: string | number
  subValue?: string
  to?: string
}

function StatCard({ title, value, subValue, to }: StatCardProps) {
  const body = (
    <div className="card hover:shadow-card-hover transition-shadow cursor-default">
      <p className="text-[12.5px] font-semibold text-gray-400 uppercase tracking-wide leading-none">{title}</p>
      <p className="font-mono text-[32px] font-semibold text-gray-900 mt-3.5 leading-none">{value}</p>
      {subValue && <p className="text-gray-400 text-[12.5px] mt-2 font-medium">{subValue}</p>}
    </div>
  )

  if (!to) return body
  return <Link to={to} className="block">{body}</Link>
}

export default function Dashboard() {
  const { user } = useAuthStore()
  const userRole = String(user?.role || '').toUpperCase()
  const isEnseignant = userRole === 'ENSEIGNANT'

  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get('/rapports/dashboard')
      .then((res) => setData(res.data))
      .catch((err) => console.error('Erreur dashboard', err))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <SkeletonDashboard />

  if (!data) return null

  const { alertes, activiteRecente } = data
  const hasAlertes =
    !isEnseignant &&
    (alertes.paiementsEnAttente.count > 0 || alertes.elevesAbsentsSouvent.length > 0)
  const totalElevesSafe = data.totalEleves > 0 ? data.totalEleves : 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-display font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
        </p>
      </div>

      {/* Alertes */}
      {hasAlertes && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <h2 className="text-sm font-semibold text-orange-800">Points d'attention</h2>
          </div>
          <div className="space-y-2">
            {alertes.paiementsEnAttente.count > 0 && (
              <Link
                to="/paiements"
                className="flex items-center justify-between rounded-lg border border-orange-100 bg-white px-4 py-2.5 transition-colors hover:bg-orange-50"
              >
                <div className="flex items-center gap-2 text-sm text-orange-700">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>
                    <strong>{alertes.paiementsEnAttente.count}</strong> paiement
                    {alertes.paiementsEnAttente.count > 1 ? 's' : ''} en attente —{' '}
                    {alertes.paiementsEnAttente.total.toLocaleString()} XOF
                  </span>
                </div>
                <span className="text-xs text-orange-400">Voir →</span>
              </Link>
            )}
            {alertes.elevesAbsentsSouvent.map((eleve) => (
              <Link
                key={eleve.id}
                to={`/eleves/${eleve.id}`}
                className="flex items-center justify-between rounded-lg border border-orange-100 bg-white px-4 py-2.5 transition-colors hover:bg-orange-50"
              >
                <div className="flex items-center gap-2 text-sm text-orange-700">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>
                    <strong>{eleve.prenom} {eleve.nom}</strong> — {eleve.nbAbsences} absences non justifiées ce mois
                  </span>
                </div>
                <span className="text-xs text-orange-400">Voir →</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Stat cards */}
      {isEnseignant ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard title="Mes élèves actifs"     value={data.totalEleves} />
          <StatCard title="Mes classes"           value={data.totalClasses} to="/classes" />
          <StatCard title="Matières attribuées"   value={data.meta?.matieresAttribuees ?? 0} />
          <StatCard title="Notes saisies ce mois" value={data.meta?.notesSaisiesMois ?? 0} to="/notes" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard title="Élèves actifs" value={data.totalEleves} to="/eleves" />
          <StatCard title="Classes"       value={data.totalClasses} to="/classes" />
          <StatCard title="Enseignants"   value={data.totalEnseignants} to="/enseignants" />
          <StatCard
            title="Recettes totales"
            value={data.recettesTotal.toLocaleString()}
            subValue={data.devise}
            to="/paiements"
          />
        </div>
      )}

      {/* Actions rapides */}
      {!isEnseignant && (
        <div className="card-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Actions rapides</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Nouvel élève', href: '/eleves', icon: UserPlus, color: 'text-blue-600 bg-blue-50 hover:bg-blue-100' },
              { label: 'Nouveau paiement', href: '/paiements', icon: CreditCard, color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' },
              { label: 'Saisir absence', href: '/absences', icon: Calendar, color: 'text-amber-600 bg-amber-50 hover:bg-amber-100' },
              { label: 'Saisir notes', href: '/notes', icon: FileText, color: 'text-violet-600 bg-violet-50 hover:bg-violet-100' },
            ].map(({ label, href, icon: Icon, color }) => (
              <Link
                key={label}
                to={href}
                state={{ openAdd: true }}
                className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${color}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{label}</span>
                <ArrowRight className="h-3.5 w-3.5 ml-auto shrink-0 opacity-40" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className={`grid grid-cols-1 gap-6 ${isEnseignant ? '' : 'lg:grid-cols-2'}`}>
        {/* Répartition par cycle */}
        <div className="card">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-display font-semibold text-gray-900">Répartition par cycle</h2>
          </div>
          <div className="space-y-3">
            {data.elevesParCycle.length === 0 && (
              <p className="text-sm text-gray-400">Aucune donnée</p>
            )}
            {data.elevesParCycle.map((cycle) => (
              <div key={cycle._id}>
                <div className="mb-1 flex justify-between">
                  <span className="text-sm font-medium text-gray-700">{cycle._id}</span>
                  <span className="text-sm text-gray-500">{cycle.count} élèves</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-primary-500 transition-all"
                    style={{ width: `${(cycle.count / totalElevesSafe) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between border-t border-gray-100 pt-3 text-xs text-gray-400">
            <span>
              {alertes.absencesMois} absence{alertes.absencesMois !== 1 ? 's' : ''} ce mois
            </span>
            {!isEnseignant && (
              <Link to="/absences" className="text-primary-600 hover:underline font-medium">
                Voir absences →
              </Link>
            )}
          </div>
        </div>

        {/* Suivi paiements */}
        {!isEnseignant && (
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-gray-400" />
                <h2 className="text-sm font-display font-semibold text-gray-900">Suivi des paiements</h2>
              </div>
              <Link to="/paiements" state={{ openSection: 'paiements' }} className="text-xs text-primary-600 hover:underline font-medium">
                Voir tout →
              </Link>
            </div>

            {data.paiements && data.paiements.totalAttendu > 0 && (
              <div className="space-y-3">
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-700">Recouvrement scolarité</span>
                    <span className={`font-bold ${
                      data.paiements.tauxRecouvrement >= 80
                        ? 'text-emerald-600'
                        : data.paiements.tauxRecouvrement >= 50
                        ? 'text-amber-600'
                        : 'text-red-600'
                    }`}>
                      {data.paiements.tauxRecouvrement}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full transition-all ${
                        data.paiements.tauxRecouvrement >= 80
                          ? 'bg-emerald-500'
                          : data.paiements.tauxRecouvrement >= 50
                          ? 'bg-amber-400'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${data.paiements.tauxRecouvrement}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-blue-50 p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-blue-500 font-semibold">Attendu</p>
                    <p className="mt-1 text-sm font-bold text-blue-700">{data.paiements.totalAttendu.toLocaleString()}</p>
                    <p className="text-[10px] text-blue-400">XOF</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-emerald-500 font-semibold">Reçu</p>
                    <p className="mt-1 text-sm font-bold text-emerald-700">{data.paiements.recettesScolarite.toLocaleString()}</p>
                    <p className="text-[10px] text-emerald-400">XOF</p>
                  </div>
                  <div className="rounded-xl bg-red-50 p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-red-500 font-semibold">Reste</p>
                    <p className="mt-1 text-sm font-bold text-red-700">{data.paiements.resteRecouvrer.toLocaleString()}</p>
                    <p className="text-[10px] text-red-400">XOF</p>
                  </div>
                </div>

                {data.paiements.elevesImpayes > 0 && (
                  <Link
                    to="/paiements"
                    state={{ openSection: 'impayes' }}
                    className="flex items-center justify-between rounded-xl border border-orange-100 bg-orange-50 px-3 py-2.5 transition-colors hover:bg-orange-100"
                  >
                    <div className="flex items-center gap-2 text-sm text-orange-700">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>
                        <strong>{data.paiements.elevesImpayes}</strong> élève{data.paiements.elevesImpayes > 1 ? 's' : ''} avec scolarité incomplète
                      </span>
                    </div>
                    <span className="text-xs text-orange-400 shrink-0">Voir →</span>
                  </Link>
                )}

                <div className="border-t border-gray-100" />
              </div>
            )}

            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Paiements récents</p>
              {activiteRecente.derniersP.length === 0 && (
                <p className="text-sm text-gray-400 py-1">Aucun paiement</p>
              )}
              {activiteRecente.derniersP.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg px-2 py-2 transition-colors hover:bg-gray-50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.elevenom}</p>
                    <p className="text-xs text-gray-400">
                      {p.typePaiement === 'SCOLARITE' ? 'Scolarité' : p.typePaiement === 'INSCRIPTION' ? 'Inscription' : p.typePaiement}
                      {' · '}{format(new Date(p.datePaiement), 'dd MMM', { locale: fr })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{p.montant.toLocaleString()} XOF</p>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${statutColors[p.statut] ?? ''}`}>
                      {p.statut === 'EN_ATTENTE' ? 'Attente' : p.statut === 'VALIDE' ? 'Validé' : 'Annulé'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dernières inscriptions */}
      {!isEnseignant && activiteRecente.derniersEleves.length > 0 && (
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-display font-semibold text-gray-900">Dernières inscriptions</h2>
            </div>
            <Link to="/eleves" className="text-xs text-primary-600 hover:underline font-medium">
              Voir tous →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {activiteRecente.derniersEleves.map((e) => (
              <Link
                key={e.id}
                to={`/eleves/${e.id}`}
                className="-mx-2 flex items-center justify-between rounded-lg px-2 py-2.5 transition-colors hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600 shrink-0">
                    {e.prenom?.[0]}{e.nom?.[0]}
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-900">{e.prenom} {e.nom}</span>
                    <span className="ml-2 text-xs text-gray-400">{e.matricule}</span>
                  </div>
                </div>
                <span className="text-xs text-gray-400">
                  {format(new Date(e.created_at), 'dd MMM', { locale: fr })}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {!isEnseignant && (
        <div className="bg-gradient-to-br from-forest-900 to-forest-500 rounded-2xl px-8 py-9 flex flex-wrap gap-5 justify-between items-center">
          <div>
            <h2 className="font-display text-xl font-bold text-cream-100 mb-1.5">Bienvenue, {user?.prenom}</h2>
            <p className="text-forest-100 text-[14.5px] max-w-md">
              Consultez les statistiques financières et académiques détaillées de votre établissement.
            </p>
          </div>
          <Link to="/rapports" className="btn btn-primary shrink-0 whitespace-nowrap">
            Voir les rapports
          </Link>
        </div>
      )}
    </div>
  )
}
