import { useEffect, useState } from 'react'
import api from '../services/api'
import { TrendingUp, UserMinus, BookOpen, Users, Download, BarChart2 } from 'lucide-react'
import Modal from '../components/Modal'
import { exportToExcel } from '../utils/exportExcel'
import { useToast } from '../contexts/ToastContext'

const PERIODES = [
  { value: '', label: 'Toutes les périodes' },
  { value: 'PREMIER_TRIMESTRE', label: '1er Trimestre' },
  { value: 'DEUXIEME_TRIMESTRE', label: '2ème Trimestre' },
  { value: 'TROISIEME_TRIMESTRE', label: '3ème Trimestre' },
  { value: 'PREMIER_SEMESTRE', label: '1er Semestre' },
  { value: 'DEUXIEME_SEMESTRE', label: '2ème Semestre' },
]

const formatPeriodeLabel = (value: string) => {
  const found = PERIODES.find(p => p.value === value)
  return found ? found.label : value
}

export default function Rapports() {
  const { error: toastError } = useToast()
  const [dashboard, setDashboard] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [rapportData, setRapportData] = useState<any>(null)
  const [showRapportModal, setShowRapportModal] = useState(false)
  const [rapportType, setRapportType] = useState('')
  const [generatingRapport, setGeneratingRapport] = useState(false)
  const [anneeActive, setAnneeActive] = useState('')
  const [selectedPeriode, setSelectedPeriode] = useState('')

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      const [dashRes, anneeRes] = await Promise.all([
        api.get('/rapports/dashboard'),
        api.get('/annees/active')
      ])
      setDashboard(dashRes.data)
      setAnneeActive(anneeRes.data?.annee || '')
    } catch (error) {
      console.error('Erreur lors du chargement du tableau de bord', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateRapport = async (type: string) => {
    setGeneratingRapport(true)
    setRapportType(type)

    try {
      let response
      switch (type) {
        case 'financier':
          response = await api.get('/rapports/financier')
          break
        case 'assiduite':
          response = await api.get('/rapports/assiduite')
          break
        case 'notes': {
          const params = new URLSearchParams()
          if (anneeActive) params.set('anneeScolaire', anneeActive)
          if (selectedPeriode) params.set('periode', selectedPeriode)
          response = await api.get(`/rapports/notes?${params.toString()}`)
          break
        }
        case 'effectifs':
          response = await api.get('/rapports/dashboard')
          break
        default:
          throw new Error('Type de rapport inconnu')
      }

      setRapportData(response.data)
      setShowRapportModal(true)
    } catch (error: any) {
      toastError(error.response?.data?.message || 'Erreur lors de la génération du rapport')
    } finally {
      setGeneratingRapport(false)
    }
  }

  const exportToExcelReport = () => {
    if (!rapportData) return

    const date = new Date().toISOString().split('T')[0]

    switch (rapportType) {
      case 'financier': {
        const rows = (rapportData.paiements || []).map((p: any) => ({
          date: p.date_paiement || p.datePaiement,
          matricule: p.eleve?.matricule || p.eleve_matricule || '',
          nom: p.eleve?.nom || p.eleve_nom || '',
          prenom: p.eleve?.prenom || p.eleve_prenom || '',
          type: p.type_paiement || p.typePaiement || '',
          montant: Number(p.montant || 0),
          devise: p.devise || 'XOF',
          mode: p.mode_paiement || p.modePaiement || '',
          mois: p.mois_concerne || p.moisConcerne || '',
          annee: p.annee_scolaire || p.anneeScolaire || ''
        }))

        exportToExcel(
          rows,
          `rapport_financier_${date}`,
          'Paiements',
          [
            { path: 'date', label: 'Date', type: 'date' },
            { path: 'matricule', label: 'Matricule eleve' },
            { path: 'nom', label: 'Nom eleve' },
            { path: 'prenom', label: 'Prenom eleve' },
            { path: 'type', label: 'Type paiement' },
            { path: 'montant', label: 'Montant', type: 'currency' },
            { path: 'devise', label: 'Devise' },
            { path: 'mode', label: 'Mode' },
            { path: 'mois', label: 'Mois concerne' },
            { path: 'annee', label: 'Année scolaire' }
          ]
        )
        return
      }
      case 'assiduite': {
        const rows = (rapportData.absencesParEleve || []).map((item: any) => ({
          matricule: item.eleve?.matricule || '',
          nom: item.eleve?.nom || '',
          prenom: item.eleve?.prenom || '',
          total: Number(item.total || 0),
          justifiees: Number(item.justifiees || 0),
          nonJustifiees: Number(item.nonJustifiees || 0)
        }))

        exportToExcel(
          rows,
          `rapport_assiduite_${date}`,
          'Assiduite',
          [
            { path: 'matricule', label: 'Matricule' },
            { path: 'nom', label: 'Nom' },
            { path: 'prenom', label: 'Prenom' },
            { path: 'total', label: 'Total absences', type: 'number' },
            { path: 'justifiees', label: 'Justifiees', type: 'number' },
            { path: 'nonJustifiees', label: 'Non justifiees', type: 'number' }
          ]
        )
        return
      }
      case 'effectifs': {
        const rows = (rapportData.elevesParCycle || []).map((item: any) => ({
          cycle: item._id || item.cycle || '',
          count: Number(item.count || 0)
        }))

        exportToExcel(
          rows,
          `rapport_effectifs_${date}`,
          'Effectifs',
          [
            { path: 'cycle', label: 'Cycle' },
            { path: 'count', label: 'Nombre eleves', type: 'number' }
          ]
        )
        return
      }
      case 'notes': {
        const rows = (rapportData.classes || []).map((c: any) => ({
          classe: c.nom || '',
          cycle: c.cycle || '',
          niveau: c.niveau || '',
          annee: c.anneeScolaire || c.annee_scolaire || rapportData.anneeScolaire || '',
          effectif: Number(c.effectif || 0),
          nombreNotes: Number(c.nombreNotes || 0),
          moyenne: c.moyenneClasse !== null ? c.moyenneClasse : ''
        }))

        exportToExcel(
          rows,
          `rapport_notes_${date}`,
          'Notes',
          [
            { path: 'classe', label: 'Classe' },
            { path: 'cycle', label: 'Cycle' },
            { path: 'niveau', label: 'Niveau' },
            { path: 'annee', label: 'Année scolaire' },
            { path: 'effectif', label: 'Effectif', type: 'number' },
            { path: 'nombreNotes', label: 'Nombre de notes', type: 'number' },
            { path: 'moyenne', label: 'Moyenne (/20)', type: 'number' }
          ]
        )
        return
      }
      default:
        return
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary-600 border-t-transparent animate-spin" />
          <p className="text-sm text-gray-500">Chargement...</p>
        </div>
      </div>
    )
  }

  const rapportTypes = [
    {
      name: 'Rapport financier',
      description: 'État des recettes, paiements par type et mode.',
      icon: TrendingUp,
      accent: 'border-emerald-500',
      iconBg: 'bg-emerald-50 text-emerald-600',
      type: 'financier',
    },
    {
      name: "Rapport d'assiduité",
      description: 'Absences justifiées et non justifiées par élève.',
      icon: UserMinus,
      accent: 'border-blue-500',
      iconBg: 'bg-blue-50 text-blue-600',
      type: 'assiduite',
    },
    {
      name: 'Rapport de notes',
      description: 'Moyennes par classe et par période scolaire.',
      icon: BookOpen,
      accent: 'border-violet-500',
      iconBg: 'bg-violet-50 text-violet-600',
      type: 'notes',
    },
    {
      name: 'Rapport d\'effectifs',
      description: 'Répartition des élèves par cycle et classe.',
      icon: BarChart2,
      accent: 'border-primary-500',
      iconBg: 'bg-primary-50 text-primary-600',
      type: 'effectifs',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-display font-bold text-gray-900">Rapports & Statistiques</h1>
        <p className="text-sm text-gray-400 mt-0.5">Générez et exportez vos rapports scolaires.</p>
      </div>

      {/* Vue d'ensemble */}
      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Élèves actifs',  value: dashboard.totalEleves,                   color: 'text-blue-600',    bg: 'bg-blue-50',    icon: Users },
            { label: 'Classes',        value: dashboard.totalClasses,                   color: 'text-emerald-600', bg: 'bg-emerald-50', icon: BookOpen },
            { label: 'Enseignants',    value: dashboard.totalEnseignants,               color: 'text-violet-600',  bg: 'bg-violet-50',  icon: UserMinus },
            { label: `Recettes (${dashboard.devise})`, value: (dashboard.recettesTotal || 0).toLocaleString(), color: 'text-primary-600', bg: 'bg-primary-50', icon: TrendingUp },
          ].map(({ label, value, color, bg, icon: Icon }) => (
            <div key={label} className="card-sm flex items-center gap-3">
              <div className={`h-9 w-9 shrink-0 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{value ?? '—'}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cartes de rapport */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {rapportTypes.map((rapport) => (
          <div key={rapport.type} className={`card border-l-4 ${rapport.accent} hover:shadow-md transition-shadow`}>
            <div className="flex items-start gap-4">
              <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${rapport.iconBg}`}>
                <rapport.icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-display font-semibold text-gray-900">{rapport.name}</h3>
                <p className="mt-0.5 text-sm text-gray-500">{rapport.description}</p>

                {rapport.type === 'notes' && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Année scolaire</label>
                      <input
                        type="text"
                        className="input text-sm"
                        placeholder="ex: 2024-2025"
                        value={anneeActive}
                        onChange={(e) => setAnneeActive(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Période</label>
                      <select
                        className="input text-sm"
                        value={selectedPeriode}
                        onChange={(e) => setSelectedPeriode(e.target.value)}
                      >
                        {PERIODES.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => handleGenerateRapport(rapport.type)}
                  disabled={generatingRapport}
                  className="btn btn-primary mt-4 text-sm disabled:opacity-50"
                >
                  {generatingRapport && rapportType === rapport.type ? (
                    <>
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      Génération...
                    </>
                  ) : (
                    <>
                      <Download className="h-3.5 w-3.5" />
                      Générer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal d'affichage des rapports */}
      <Modal
        isOpen={showRapportModal}
        onClose={() => { setShowRapportModal(false); setRapportData(null) }}
        title={
          rapportType === 'financier' ? 'Rapport financier' :
          rapportType === 'assiduite' ? "Rapport d'assiduité" :
          rapportType === 'notes'     ? 'Rapport de notes' :
          'Rapport d\'effectifs'
        }
        size="lg"
      >
        <div className="max-h-[70vh] overflow-y-auto space-y-4">
          {rapportType === 'financier' && rapportData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Total recettes</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-700">{(rapportData.totalRecettes || 0).toLocaleString()} <span className="text-sm font-normal">{rapportData.devise}</span></p>
                </div>
                <div className="rounded-xl bg-primary-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Paiements</p>
                  <p className="mt-1 text-2xl font-bold text-primary-700">{rapportData.nombrePaiements || 0}</p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Par type</p>
                <div className="overflow-hidden rounded-lg border border-gray-100">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Type</th><th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Nb</th><th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Montant (XOF)</th></tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {rapportData.parType?.map((item: any) => (
                        <tr key={item._id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium text-gray-800">{item._id}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{item.count}</td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-800">{(item.total || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Par mode</p>
                <div className="overflow-hidden rounded-lg border border-gray-100">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Mode</th><th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Nb</th><th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Montant (XOF)</th></tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {rapportData.parModePaiement?.map((item: any) => (
                        <tr key={item._id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium text-gray-800">{item._id}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{item.count}</td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-800">{(item.total || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {rapportType === 'assiduite' && rapportData && (
            <div className="space-y-4">
              <div className="rounded-xl bg-blue-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Total absences</p>
                <p className="mt-1 text-2xl font-bold text-blue-700">{rapportData.totalAbsences || 0}</p>
              </div>
              <div className="overflow-hidden rounded-lg border border-gray-100">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Matricule</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Élève</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Total</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Just.</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Non just.</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {rapportData.absencesParEleve?.map((item: any) => (
                      <tr key={item.eleve.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-500 font-mono text-xs">{item.eleve.matricule}</td>
                        <td className="px-3 py-2 font-medium text-gray-800">{item.eleve.prenom} {item.eleve.nom}</td>
                        <td className="px-3 py-2 text-right font-bold text-gray-800">{item.total}</td>
                        <td className="px-3 py-2 text-right text-emerald-600">{item.justifiees}</td>
                        <td className="px-3 py-2 text-right text-red-600">{item.nonJustifiees}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {rapportType === 'effectifs' && rapportData && (
            <div className="space-y-4">
              <div className="rounded-xl bg-primary-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Total élèves</p>
                <p className="mt-1 text-2xl font-bold text-primary-700">{rapportData.totalEleves || 0}</p>
              </div>
              <div className="overflow-hidden rounded-lg border border-gray-100">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Cycle</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Élèves</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Part</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {rapportData.elevesParCycle?.map((item: any) => (
                      <tr key={item._id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-800">{item._id}</td>
                        <td className="px-3 py-2 text-right font-bold text-gray-800">{item.count}</td>
                        <td className="px-3 py-2 text-right text-gray-500">
                          {rapportData.totalEleves > 0 ? `${Math.round((item.count / rapportData.totalEleves) * 100)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {rapportType === 'notes' && rapportData && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                {rapportData.anneeScolaire && <span className="rounded-full bg-gray-100 px-2.5 py-1">Année : {rapportData.anneeScolaire}</span>}
                {rapportData.periode && <span className="rounded-full bg-gray-100 px-2.5 py-1">Période : {formatPeriodeLabel(rapportData.periode)}</span>}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-violet-50 p-3 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Classes</p>
                  <p className="mt-1 text-2xl font-bold text-violet-700">{rapportData.nombreClasses}</p>
                </div>
                <div className="rounded-xl bg-blue-50 p-3 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Avec notes</p>
                  <p className="mt-1 text-2xl font-bold text-blue-700">{rapportData.classesAvecNotes}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Moy. générale</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-700">
                    {rapportData.moyenneGenerale !== null ? `${rapportData.moyenneGenerale}/20` : '—'}
                  </p>
                </div>
              </div>
              {rapportData.classes?.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-gray-100">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-gray-50">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Classe</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Cycle</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Effectif</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Notes</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Moyenne</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {rapportData.classes.map((c: any) => (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium text-gray-800">{c.nom}</td>
                          <td className="px-3 py-2 text-gray-500">{c.cycle}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{c.effectif}</td>
                          <td className="px-3 py-2 text-right text-gray-500">{c.nombreNotes}</td>
                          <td className="px-3 py-2 text-right">
                            {c.moyenneClasse !== null ? (
                              <span className={`font-bold ${c.moyenneClasse >= 10 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {c.moyenneClasse}/20
                              </span>
                            ) : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-gray-400">Aucune classe avec données de notes.</p>
              )}
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-3 border-t border-gray-100 pt-4">
          <button onClick={() => { setShowRapportModal(false); setRapportData(null) }} className="btn btn-secondary">
            Fermer
          </button>
          <button onClick={exportToExcelReport} className="btn btn-primary flex items-center gap-1.5">
            <Download className="h-4 w-4" />
            Exporter Excel
          </button>
        </div>
      </Modal>
    </div>
  )
}



