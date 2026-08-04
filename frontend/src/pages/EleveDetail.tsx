import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../services/api'
import { Eleve } from '../types'
import { format } from 'date-fns'
import {
  User, Phone, Mail, MapPin, Printer,
  AlertTriangle, CreditCard, BookOpen, ChevronRight, CheckCircle, Edit2
} from 'lucide-react'
import Modal from '../components/Modal'
import { printBulletin } from '../utils/printBulletin'
import { useToast } from '../contexts/ToastContext'
import EleveFormModal from '../components/EleveFormModal'

const BULLETIN_PERIODES_TRIMESTRES = ['1er Trimestre', '2eme Trimestre', '3eme Trimestre']
const BULLETIN_PERIODES_SEMESTRES = ['1er Semestre', '2eme Semestre']

const BULLETIN_NIVEAUX_AUTORISES = new Set([
  'SIXIEME', 'CINQUIEME', 'QUATRIEME', 'TROISIEME',
  'SECONDE', 'PREMIERE', 'TERMINALE',
  '6E', '5E', '4E', '3E', '1ERE', 'TLE'
])

const normalizeNiveau = (value: any) =>
  String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase()

const normalizeCycle = (value: any) =>
  String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase()

const getBulletinPeriodesByCycle = (cycle: any) =>
  normalizeCycle(cycle) === 'LYCEE' ? BULLETIN_PERIODES_SEMESTRES : BULLETIN_PERIODES_TRIMESTRES

const formatScore = (value: any) => {
  if (value === null || value === undefined || value === '') return '-'
  const num = Number(value)
  if (!Number.isFinite(num)) return '-'
  return num.toFixed(2)
}

export default function EleveDetail() {
  const { id } = useParams()
  const { warning, error: toastError } = useToast()
  const [eleve, setEleve] = useState<Eleve | null>(null)
  const [loading, setLoading] = useState(true)

  // Données chargées automatiquement (aperçu inline)
  const [absencesData, setAbsencesData] = useState<any>(null)
  const [paiementsData, setPaiementsData] = useState<any>(null)

  // Modals détail
  const [showNotesModal, setShowNotesModal] = useState(false)
  const [showAbsencesModal, setShowAbsencesModal] = useState(false)
  const [showPaiementsModal, setShowPaiementsModal] = useState(false)
  const [notesData, setNotesData] = useState<any>(null)
  const [loadingModal, setLoadingModal] = useState(false)

  const [showEditModal, setShowEditModal] = useState(false)

  const [bulletinPeriode, setBulletinPeriode] = useState(BULLETIN_PERIODES_TRIMESTRES[0])
  const [bulletinAnneeScolaire, setBulletinAnneeScolaire] = useState('')
  const bulletinAutorise = BULLETIN_NIVEAUX_AUTORISES.has(normalizeNiveau(eleve?.classe?.niveau))
  const bulletinPeriodes = getBulletinPeriodesByCycle(eleve?.classe?.cycle)

  useEffect(() => {
    if (!bulletinPeriodes.includes(bulletinPeriode)) {
      setBulletinPeriode(bulletinPeriodes[0])
    }
  }, [eleve?.classe?.cycle, bulletinPeriode, bulletinPeriodes])

  useEffect(() => {
    loadAll()
  }, [id])

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      if (Number.isNaN(date.getTime())) return '-'
      return format(date, 'dd/MM/yyyy')
    } catch {
      return '-'
    }
  }

  const loadAll = async () => {
    try {
      const [eleveRes, absencesRes, paiementsRes] = await Promise.allSettled([
        api.get(`/eleves/${id}`),
        api.get(`/absences/stats/${id}`),
        api.get(`/paiements/historique/${id}`)
      ])

      if (eleveRes.status === 'fulfilled') {
        const data = eleveRes.value.data
        const mappedEleve: Eleve = {
          id: data.id,
          matricule: data.matricule,
          nom: data.nom,
          prenom: data.prenom,
          dateNaissance: data.date_naissance || data.dateNaissance,
          lieuNaissance: data.lieu_naissance || data.lieuNaissance,
          sexe: data.sexe,
          groupeSanguin: data.groupe_sanguin || data.groupeSanguin,
          statut: data.statut,
          anneeScolaire: data.annee_scolaire || data.anneeScolaire,
          dateInscription: data.date_inscription || data.dateInscription,
          classe: data.classe,
          tuteur: {
            nom: data.tuteur_nom || data.tuteur?.nom || '',
            prenom: data.tuteur_prenom || data.tuteur?.prenom || '',
            telephone: data.tuteur_telephone || data.tuteur?.telephone || '',
            email: data.tuteur_email || data.tuteur?.email || '',
            adresse: data.tuteur_adresse || data.tuteur?.adresse || '',
            profession: data.tuteur_profession || data.tuteur?.profession || ''
          }
        }
        setEleve(mappedEleve)
        setBulletinAnneeScolaire(mappedEleve.anneeScolaire || '')
      }

      if (absencesRes.status === 'fulfilled') setAbsencesData(absencesRes.value.data)
      if (paiementsRes.status === 'fulfilled') setPaiementsData(paiementsRes.value.data)
    } catch (error) {
      console.error('Erreur lors du chargement', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchBulletin = async (periode: string, anneeScolaire: string) => {
    const response = await api.get(`/notes/bulletin/${id}`, { params: { periode, anneeScolaire } })
    setNotesData(response.data)
  }

  const handleVoirNotes = async () => {
    if (!bulletinAutorise) {
      warning('Bulletin disponible uniquement pour les classes de la 6e à la Terminale')
      return
    }
    setLoadingModal(true)
    setShowNotesModal(true)
    try {
      const currentYear = new Date().getFullYear()
      const annee = bulletinAnneeScolaire || eleve?.anneeScolaire || `${currentYear}-${currentYear + 1}`
      if (!bulletinAnneeScolaire) setBulletinAnneeScolaire(annee)
      await fetchBulletin(bulletinPeriode, annee)
    } catch (error: any) {
      toastError(error.response?.data?.message || 'Erreur lors du chargement des notes')
      setShowNotesModal(false)
    } finally {
      setLoadingModal(false)
    }
  }

  const handleRefreshBulletin = async (periode?: string, annee?: string) => {
    const p = periode ?? bulletinPeriode
    const a = annee ?? bulletinAnneeScolaire
    if (!a) { warning('Année scolaire requise'); return }
    setLoadingModal(true)
    try {
      await fetchBulletin(p, a)
    } catch (error: any) {
      toastError(error.response?.data?.message || 'Erreur lors du chargement du bulletin')
    } finally {
      setLoadingModal(false)
    }
  }

  const handlePeriodeChange = (newPeriode: string) => {
    setBulletinPeriode(newPeriode)
    if (showNotesModal) {
      handleRefreshBulletin(newPeriode, bulletinAnneeScolaire)
    }
  }

  const handleAnneeChange = (newAnnee: string) => {
    setBulletinAnneeScolaire(newAnnee)
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

  if (!eleve) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <User className="h-8 w-8 text-gray-400" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-gray-700">Élève introuvable</p>
          <p className="text-sm text-gray-400 mt-1">Cet élève n'existe pas ou a été supprimé.</p>
        </div>
        <Link to="/eleves" className="btn btn-secondary">← Retour aux élèves</Link>
      </div>
    )
  }

  const statutNormalized = String(eleve.statut || '').toUpperCase()
  const statutLabel =
    statutNormalized === 'ACTIF' ? 'Actif' :
    statutNormalized === 'INACTIF' ? 'Inactif' :
    statutNormalized === 'TRANSFERE' ? 'Transféré' :
    statutNormalized === 'DIPLOME' ? 'Diplômé' : eleve.statut

  const resteAPayer = paiementsData?.resteAPayer || 0
  const devise = paiementsData?.devise || 'XOF'

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link to="/eleves" className="hover:text-primary-600 transition-colors">Élèves</Link>
        <ChevronRight className="h-4 w-4 flex-shrink-0" />
        {eleve.classe?.id && (
          <>
            <Link to={`/classes/${eleve.classe.id}`} className="hover:text-primary-600 transition-colors">
              {eleve.classe.nom}
            </Link>
            <ChevronRight className="h-4 w-4 flex-shrink-0" />
          </>
        )}
        <span className="font-medium text-gray-900">{eleve.prenom} {eleve.nom}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-display font-bold text-gray-900">{eleve.prenom} {eleve.nom}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {eleve.matricule} &mdash; {eleve.classe?.nom || 'Sans classe'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${
            statutNormalized === 'ACTIF' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
          }`}>
            {statutLabel}
          </span>
          <button
            onClick={() => setShowEditModal(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Edit2 className="h-3.5 w-3.5" />
            Modifier
          </button>
        </div>
      </div>

      {/* Cartes aperçu rapide */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Absences */}
        <button
          onClick={() => setShowAbsencesModal(true)}
          className="card-sm text-left transition-shadow hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-orange-100 p-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <span className="text-sm font-semibold text-gray-700">Absences</span>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </div>
          {absencesData ? (
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xl font-display font-bold text-gray-900">{absencesData.total || 0}</p>
                <p className="text-xs text-gray-500">Total</p>
              </div>
              <div>
                <p className="text-xl font-bold text-green-600">{absencesData.justifiees || 0}</p>
                <p className="text-xs text-gray-500">Justif.</p>
              </div>
              <div>
                <p className="text-xl font-bold text-red-600">{absencesData.nonJustifiees || 0}</p>
                <p className="text-xs text-gray-500">Non just.</p>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-400">Aucune donnée</p>
          )}
        </button>

        {/* Paiements */}
        <button
          onClick={() => setShowPaiementsModal(true)}
          className="card-sm text-left transition-shadow hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`rounded-lg p-2 ${resteAPayer > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                <CreditCard className={`h-5 w-5 ${resteAPayer > 0 ? 'text-red-600' : 'text-green-600'}`} />
              </div>
              <span className="text-sm font-semibold text-gray-700">Paiements</span>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </div>
          {paiementsData ? (
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Payé</span>
                <span className="text-sm font-bold text-primary-700">
                  {(paiementsData.totalPaye || 0).toLocaleString()} {devise}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Reste</span>
                <span className={`text-sm font-bold ${resteAPayer > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {resteAPayer > 0 ? `${resteAPayer.toLocaleString()} ${devise}` : (
                    <span className="flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> À jour</span>
                  )}
                </span>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-400">Aucune donnée</p>
          )}
        </button>

        {/* Bulletin */}
        <button
          onClick={handleVoirNotes}
          disabled={!bulletinAutorise}
          className="card-sm text-left transition-shadow hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary-100 p-2">
                <BookOpen className="h-5 w-5 text-primary-600" />
              </div>
              <span className="text-sm font-semibold text-gray-700">Bulletin</span>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </div>
          <div className="mt-3">
            {bulletinAutorise ? (
              <div className="space-y-1">
                <select
                  className="input input-xs"
                  value={bulletinPeriode}
                  onChange={(e) => { e.stopPropagation(); setBulletinPeriode(e.target.value) }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {bulletinPeriodes.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <p className="text-xs text-primary-600 font-medium">Cliquer pour voir →</p>
              </div>
            ) : (
              <p className="text-xs text-amber-600">Non disponible (primaire)</p>
            )}
          </div>
        </button>
      </div>

      {/* Infos principales */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-4 text-base font-display font-semibold text-gray-900">Informations personnelles</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <p className="text-gray-500">Matricule</p>
              <p className="font-medium">{eleve.matricule}</p>
            </div>
            <div>
              <p className="text-gray-500">Sexe</p>
              <p className="font-medium">{eleve.sexe === 'M' ? 'Garçon' : 'Fille'}</p>
            </div>
            <div>
              <p className="text-gray-500">Date de naissance</p>
              <p className="font-medium">{formatDate(eleve.dateNaissance)}</p>
            </div>
            <div>
              <p className="text-gray-500">Lieu de naissance</p>
              <p className="font-medium">{eleve.lieuNaissance || '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">Classe</p>
              <p className="font-medium">{eleve.classe?.nom || '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">Année scolaire</p>
              <p className="font-medium">{eleve.anneeScolaire || '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">Date d'inscription</p>
              <p className="font-medium">{formatDate(eleve.dateInscription)}</p>
            </div>
            {eleve.groupeSanguin && (
              <div>
                <p className="text-gray-500">Groupe sanguin</p>
                <p className="font-medium">{eleve.groupeSanguin}</p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="mb-4 text-base font-display font-semibold text-gray-900">Tuteur / Parent</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <User className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div>
                <p className="text-gray-500">Nom complet</p>
                <p className="font-medium">{eleve.tuteur.prenom} {eleve.tuteur.nom}</p>
                {eleve.tuteur.profession && <p className="text-xs text-gray-400">{eleve.tuteur.profession}</p>}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div>
                <p className="text-gray-500">Téléphone</p>
                <p className="font-medium">{eleve.tuteur.telephone || '-'}</p>
              </div>
            </div>
            {eleve.tuteur.email && (
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                <div>
                  <p className="text-gray-500">Email</p>
                  <p className="font-medium">{eleve.tuteur.email}</p>
                </div>
              </div>
            )}
            {eleve.tuteur.adresse && (
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                <div>
                  <p className="text-gray-500">Adresse</p>
                  <p className="font-medium">{eleve.tuteur.adresse}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal bulletin */}
      <Modal
        isOpen={showNotesModal}
        onClose={() => setShowNotesModal(false)}
        title={`Bulletin — ${eleve.prenom} ${eleve.nom}`}
        size="xl"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-44 shrink-0">
              <label className="mb-1 block text-sm font-medium text-gray-700">Période</label>
              <select className="input" value={bulletinPeriode} onChange={(e) => handlePeriodeChange(e.target.value)}>
                {bulletinPeriodes.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="w-32 shrink-0">
              <label className="mb-1 block text-sm font-medium text-gray-700">Année scolaire</label>
              <input type="text" className="input" value={bulletinAnneeScolaire}
                onChange={(e) => handleAnneeChange(e.target.value)} placeholder="2025-2026" />
            </div>
            <div className="flex items-end gap-2">
              <button className="btn btn-secondary flex-1" onClick={() => handleRefreshBulletin()} disabled={loadingModal}>
                Actualiser
              </button>
              {notesData && (
                <button className="btn btn-secondary flex items-center gap-1.5"
                  onClick={() => printBulletin(notesData)} title="Imprimer / Enregistrer en PDF">
                  <Printer className="h-4 w-4" /> Imprimer
                </button>
              )}
            </div>
          </div>

          {loadingModal ? (
            <div className="py-8 text-center">Chargement...</div>
          ) : notesData ? (
            <div className="max-h-[70vh] space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded border bg-gray-50 p-3">
                  <p className="text-xs text-gray-600">Classe</p>
                  <p className="font-semibold">{notesData.classe?.nom || '-'}</p>
                  <p className="text-xs text-gray-600">Effectif: {notesData.effectif ?? '-'}</p>
                </div>
                <div className="rounded border bg-gray-50 p-3">
                  <p className="text-xs text-gray-600">Période</p>
                  <p className="font-semibold">{notesData.periodeLabel || notesData.periode || '-'}</p>
                  <p className="text-xs text-gray-600">Année: {notesData.anneeScolaire || '-'}</p>
                </div>
                <div className="rounded border bg-primary-50 p-3">
                  <p className="text-xs text-gray-700">Moyenne générale</p>
                  <p className="text-xl font-bold text-primary-700">{formatScore(notesData.resume?.moyenneGenerale)}/20</p>
                  <p className="text-xs text-gray-700">Rang: {notesData.resume?.rangClasse || '-'}</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-100">
                    <tr>
                      <th className="px-2 py-2 text-left">Matières</th>
                      <th className="px-2 py-2 text-right">Inter</th>
                      <th className="px-2 py-2 text-right">Dev.</th>
                      <th className="px-2 py-2 text-right">M. Cls</th>
                      <th className="px-2 py-2 text-right">Compo</th>
                      <th className="px-2 py-2 text-right">Note /20</th>
                      <th className="px-2 py-2 text-right">Coef</th>
                      <th className="px-2 py-2 text-right">Note×Coef</th>
                      <th className="px-2 py-2 text-right">Rg</th>
                      <th className="px-2 py-2 text-left">Professeur</th>
                      <th className="px-2 py-2 text-left">Appréciation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {notesData.lignes?.map((line: any) => (
                      <tr key={line.matiereId}>
                        <td className="px-2 py-2 font-medium">{line.matiereNom}</td>
                        <td className="px-2 py-2 text-right">{formatScore(line.inter)}</td>
                        <td className="px-2 py-2 text-right">{formatScore(line.devoir)}</td>
                        <td className="px-2 py-2 text-right">{formatScore(line.moyenneClasse)}</td>
                        <td className="px-2 py-2 text-right">{formatScore(line.composition)}</td>
                        <td className="px-2 py-2 text-right font-semibold">{formatScore(line.noteSur20)}</td>
                        <td className="px-2 py-2 text-right">{formatScore(line.coefficient)}</td>
                        <td className="px-2 py-2 text-right">
                          {formatScore(line.noteCoefficient)}
                          {line.noteCoefficientMax != null ? `/${formatScore(line.noteCoefficientMax)}` : ''}
                        </td>
                        <td className="px-2 py-2 text-right">{line.rang ?? '-'}</td>
                        <td className="px-2 py-2">{line.professeur || '-'}</td>
                        <td className="px-2 py-2">{line.appreciation || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded border p-3">
                  <p className="text-xs text-gray-600">Total coefficients</p>
                  <p className="font-semibold">{formatScore(notesData.resume?.totalCoefficients)}</p>
                  <p className="mt-1 text-xs text-gray-600">Total points</p>
                  <p className="font-semibold">
                    {formatScore(notesData.resume?.totalPoints)}
                    {notesData.resume?.totalPointsMax != null ? `/${formatScore(notesData.resume.totalPointsMax)}` : ''}
                  </p>
                </div>
                <div className="rounded border p-3">
                  <p className="text-xs text-gray-600">Moy. de classe</p>
                  <p className="font-semibold">{formatScore(notesData.resume?.moyenneClasseGenerale)}/20</p>
                  <p className="text-xs text-gray-600">Meilleure: {formatScore(notesData.resume?.meilleureMoyenne)}</p>
                  <p className="text-xs text-gray-600">Plus faible: {formatScore(notesData.resume?.plusFaibleMoyenne)}</p>
                </div>
                <div className="rounded border p-3">
                  <p className="text-xs text-gray-600">Mention</p>
                  <p className="font-semibold">{notesData.resume?.mention || '-'}</p>
                  <p className="text-xs text-gray-600">Absences: {notesData.resume?.absences ?? 0}</p>
                  <p className="text-xs text-gray-600">Retards: {notesData.resume?.retards ?? 0}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-gray-500">Aucune donnée de bulletin disponible</p>
          )}
        </div>
      </Modal>

      {/* Modal absences détail */}
      <Modal isOpen={showAbsencesModal} onClose={() => setShowAbsencesModal(false)}
        title={`Absences — ${eleve.prenom} ${eleve.nom}`}>
        {absencesData ? (
          <div className="max-h-[70vh] overflow-y-auto space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-2xl font-bold text-gray-900">{absencesData.total || 0}</p>
                <p className="text-sm text-gray-600">Total</p>
              </div>
              <div className="rounded-lg bg-green-50 p-3">
                <p className="text-2xl font-bold text-green-600">{absencesData.justifiees || 0}</p>
                <p className="text-sm text-gray-600">Justifiées</p>
              </div>
              <div className="rounded-lg bg-red-50 p-3">
                <p className="text-2xl font-bold text-red-600">{absencesData.nonJustifiees || 0}</p>
                <p className="text-sm text-gray-600">Non justifiées</p>
              </div>
            </div>
            {absencesData.absences?.length > 0 ? (
              <div className="space-y-2">
                {absencesData.absences.map((absence: any) => (
                  <div key={absence.id} className={`rounded border-l-4 pl-3 py-2 ${
                    absence.justifiee ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">{formatDate(absence.date)}</p>
                        <p className="text-xs text-gray-600">{absence.periode}</p>
                        {absence.motif && <p className="text-xs text-gray-500 mt-0.5">{absence.motif}</p>}
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        absence.justifiee ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {absence.justifiee ? 'Justifiée' : 'Non justifiée'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-gray-500">Aucune absence enregistrée</p>
            )}
          </div>
        ) : (
          <p className="py-8 text-center text-gray-400">Aucune donnée disponible</p>
        )}
      </Modal>

      {/* Modal modification élève */}
      <EleveFormModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={() => { setShowEditModal(false); loadAll() }}
        eleve={eleve}
      />

      {/* Modal paiements détail */}
      <Modal isOpen={showPaiementsModal} onClose={() => setShowPaiementsModal(false)}
        title={`Historique des paiements — ${eleve.prenom} ${eleve.nom}`} size="lg">
        {paiementsData ? (() => {
          const totalDu = Number(paiementsData.totalDu || 0)
          const allPaiements: any[] = [...(paiementsData.paiements || [])]
            .sort((a: any, b: any) => new Date(a.date_paiement || a.datePaiement).getTime() - new Date(b.date_paiement || b.datePaiement).getTime())

          // Calcul du solde courant après chaque versement SCOLARITE VALIDE
          let cumulScolarite = 0
          const paiementsAvecSolde = allPaiements.map((p: any) => {
            const type = String(p.type_paiement || p.typePaiement || '').toUpperCase()
            const statut = String(p.statut || '').toUpperCase()
            const montant = Number(p.montant || 0)
            const isScolariteValide = type === 'SCOLARITE' && statut === 'VALIDE'
            const avantVersement = cumulScolarite
            if (isScolariteValide) cumulScolarite += montant
            const apresVersement = cumulScolarite
            const resteApres = totalDu > 0 ? Math.max(0, totalDu - apresVersement) : null
            return { ...p, type, statut, montant, isScolariteValide, avantVersement, apresVersement, resteApres }
          })

          const typeLabels: Record<string, string> = {
            INSCRIPTION: 'Inscription', SCOLARITE: 'Scolarité', CANTINE: 'Cantine',
            TRANSPORT: 'Transport', UNIFORME: 'Uniforme', AUTRES: 'Autres'
          }
          const modeLabels: Record<string, string> = {
            ESPECES: 'Espèces', CHEQUE: 'Chèque', VIREMENT: 'Virement', MOBILE_MONEY: 'Mobile Money'
          }

          return (
            <div className="space-y-4">
              {/* KPIs */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-primary-50 p-3">
                  <p className="text-xs text-gray-500">Scolarité payée</p>
                  <p className="text-lg font-bold text-primary-700">
                    {(paiementsData.totalPaye || 0).toLocaleString()} {devise}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Tarif annuel</p>
                  <p className="text-lg font-bold text-gray-900">
                    {totalDu > 0 ? `${totalDu.toLocaleString()} ${devise}` : '—'}
                  </p>
                </div>
                <div className={`rounded-lg p-3 ${resteAPayer > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                  <p className="text-xs text-gray-500">Solde restant</p>
                  <p className={`text-lg font-bold ${resteAPayer > 0 ? 'text-red-700' : 'text-green-700'}`}>
                    {resteAPayer > 0 ? `${resteAPayer.toLocaleString()} ${devise}` : '✓ Soldé'}
                  </p>
                </div>
              </div>

              {/* Barre de progression scolarité */}
              {totalDu > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Progression scolarité</span>
                    <span>{Math.min(100, Math.round(((paiementsData.totalPaye || 0) / totalDu) * 100))}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className={`h-full rounded-full ${resteAPayer <= 0 ? 'bg-emerald-500' : 'bg-amber-400'}`}
                      style={{ width: `${Math.min(100, Math.round(((paiementsData.totalPaye || 0) / totalDu) * 100))}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Historique chronologique */}
              {paiementsAvecSolde.length > 0 ? (
                <div className="max-h-[50vh] overflow-y-auto space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Historique chronologique ({paiementsAvecSolde.length} paiement{paiementsAvecSolde.length > 1 ? 's' : ''})
                  </p>
                  {paiementsAvecSolde.map((p: any, idx: number) => (
                    <div
                      key={p.id}
                      className={`rounded-lg border p-3 ${
                        p.statut === 'ANNULE' ? 'border-gray-200 bg-gray-50 opacity-60' :
                        p.isScolariteValide ? 'border-primary-100 bg-primary-50/40' :
                        'border-gray-100 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        {/* Numéro + date + type */}
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[11px] font-bold text-gray-600">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="text-xs text-gray-400">{formatDate(p.date_paiement || p.datePaiement)}</p>
                            <p className="text-sm font-semibold text-gray-800">
                              {typeLabels[p.type] || p.type}
                              {(p.mois_concerne || p.moisConcerne) && (
                                <span className="ml-1 text-xs font-normal text-gray-500">
                                  ({p.mois_concerne || p.moisConcerne})
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-400">
                              {modeLabels[String(p.mode_paiement || p.modePaiement || '').toUpperCase()] || p.mode_paiement || p.modePaiement}
                              {(p.numero_piece || p.numeroPiece) && ` · Réf. ${p.numero_piece || p.numeroPiece}`}
                            </p>
                          </div>
                        </div>

                        {/* Montant + statut */}
                        <div className="text-right shrink-0">
                          <p className={`text-base font-bold ${p.statut === 'ANNULE' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                            +{p.montant.toLocaleString()} {devise}
                          </p>
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            p.statut === 'VALIDE' ? 'bg-green-100 text-green-700' :
                            p.statut === 'EN_ATTENTE' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {p.statut === 'VALIDE' ? 'Validé' : p.statut === 'EN_ATTENTE' ? 'En attente' : 'Annulé'}
                          </span>
                        </div>
                      </div>

                      {/* Ligne de solde scolarité (uniquement si SCOLARITE VALIDE et totalDu connu) */}
                      {p.isScolariteValide && totalDu > 0 && (
                        <div className="mt-2 flex items-center gap-1 border-t border-primary-100 pt-2 text-xs">
                          <span className="text-gray-400">Avant :</span>
                          <span className="font-medium text-gray-600">{p.avantVersement.toLocaleString()}</span>
                          <span className="mx-1 text-gray-300">→</span>
                          <span className="text-gray-400">Cumulé :</span>
                          <span className="font-medium text-primary-700">{p.apresVersement.toLocaleString()}</span>
                          <span className="mx-1 text-gray-300">·</span>
                          {p.resteApres !== null && p.resteApres <= 0
                            ? <span className="font-bold text-emerald-600">★ Compte soldé</span>
                            : <><span className="text-gray-400">Reste :</span>
                              <span className="font-bold text-red-600">{(p.resteApres ?? 0).toLocaleString()} {devise}</span></>
                          }
                        </div>
                      )}

                      {p.remarques && (
                        <p className="mt-1.5 text-xs italic text-gray-400">{p.remarques}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-gray-500">Aucun paiement enregistré</p>
              )}
            </div>
          )
        })() : (
          <p className="py-8 text-center text-gray-400">Aucune donnée disponible</p>
        )}
      </Modal>
    </div>
  )
}
