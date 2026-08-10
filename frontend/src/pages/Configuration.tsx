import { useEffect, useRef, useState, type ComponentType } from 'react'
import api from '../services/api'
import { Calendar, BookOpen, Plus, CheckCircle, Edit2, Trash2, X, Palette, ImagePlus, Download, Loader2, Upload, RefreshCw, Clock, HardDrive, Lock, Mail } from 'lucide-react'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../contexts/ToastContext'
import { useAppSettings, COLOR_THEMES } from '../contexts/AppSettingsContext'
import { useAuthStore } from '../store/authStore'

function MatiereSection({
  titre,
  matieres,
  onEdit,
  onDelete,
  wrapperClassName = 'mb-6',
  emptyMessage
}: {
  titre: string
  matieres: any[]
  onEdit: (matiere: any) => void
  onDelete: (id: string, nom: string) => void
  wrapperClassName?: string
  emptyMessage?: string
}) {
  return (
    <div className={wrapperClassName}>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold text-gray-700">{titre.split(' (')[0]}</h3>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
          {matieres.length}
        </span>
      </div>
      {matieres.length === 0 && emptyMessage ? (
        <p className="text-sm text-gray-400 italic">{emptyMessage}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {matieres.map((matiere) => (
            <div
              key={matiere.id}
              className="group flex items-center justify-between rounded-xl bg-white shadow-card hover:shadow-card-hover transition-shadow px-3 py-2.5"
              style={{ borderLeft: `3px solid ${matiere.couleur || '#6366f1'}` }}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{matiere.nom}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {matiere.code} · Coef. {matiere.coefficient}
                </p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                <button
                  onClick={() => onEdit(matiere)}
                  className="icon-btn"
                  title="Modifier"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onDelete(matiere.id, matiere.nom)}
                  className="icon-btn-danger"
                  title="Supprimer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type Tab = 'personnalisation' | 'annees' | 'matieres' | 'sauvegarde'

const TABS: { id: Tab; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: 'personnalisation', label: 'Personnalisation', icon: Palette },
  { id: 'annees',          label: 'Années scolaires', icon: Calendar },
  { id: 'matieres',        label: 'Matières',          icon: BookOpen },
  { id: 'sauvegarde',      label: 'Sauvegarde',        icon: HardDrive },
]

export default function Configuration() {
  const { success, error: toastError } = useToast()
  const { settings, updateSettings } = useAppSettings()
  const { user } = useAuthStore()
  // Sauvegarde planifiée = dump multi-écoles, réservé à SUPER_ADMIN côté
  // backend (voir backup.routes.js) — on évite l'appel/l'affichage pour un
  // ADMIN d'école, qui recevrait systématiquement un 403.
  const isSuperAdmin = String(user?.role || '').toUpperCase() === 'SUPER_ADMIN'
  const [activeTab, setActiveTab] = useState<Tab>('personnalisation')
  const [appNameDraft, setAppNameDraft] = useState(settings.appName)
  const [appTaglineDraft, setAppTaglineDraft] = useState(settings.appTagline)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const restoreInputRef = useRef<HTMLInputElement>(null)
  const [backingUp, setBackingUp] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [savingNow, setSavingNow] = useState(false)
  const [autoSettings, setAutoSettings] = useState<{ enabled: boolean; frequency: string; hour: number; keepCount: number; lastBackup: string | null }>({ enabled: false, frequency: 'daily', hour: 2, keepCount: 7, lastBackup: null })
  const [savedFiles, setSavedFiles] = useState<Array<{ filename: string; size: number; createdAt: string }>>([])
  const [emailBackup, setEmailBackup] = useState<{ enabled: boolean; frequency: string; customEmail: string | null; lastSentAt: string | null; lastStatus: string | null; lastError: string | null }>({ enabled: false, frequency: 'weekly', customEmail: null, lastSentAt: null, lastStatus: null, lastError: null })
  const [customEmailDraft, setCustomEmailDraft] = useState('')
  const [savingEmailBackup, setSavingEmailBackup] = useState(false)
  const [restoreConfirm, setRestoreConfirm] = useState(false)
  const [pendingRestoreData, setPendingRestoreData] = useState<any>(null)
  const [deleteFileConfirm, setDeleteFileConfirm] = useState<string | null>(null)
  const [annees, setAnnees] = useState<any[]>([])
  const [matieres, setMatieres] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewAnnee, setShowNewAnnee] = useState(false)
  const [showMatiereModal, setShowMatiereModal] = useState(false)
  const [editingMatiere, setEditingMatiere] = useState<any>(null)
  const [anneeToActivate, setAnneeToActivate] = useState<string | null>(null)
  const [anneeToCloturer, setAnneeToCloturer] = useState<string | null>(null)
  const [editingAnnee, setEditingAnnee] = useState<any>(null)
  const [editAnneeForm, setEditAnneeForm] = useState({ date_debut: '', date_fin: '' })
  const [matiereToDelete, setMatiereToDelete] = useState<{ id: string; nom: string } | null>(null)

  const [newAnnee, setNewAnnee] = useState({
    annee: '',
    date_debut: '',
    date_fin: ''
  })

  const [matiereForm, setMatiereForm] = useState({
    nom: '',
    code: '',
    description: '',
    coefficient: 1,
    cycles: [] as string[],
    niveaux: [] as string[],
    couleur: '#3B82F6'
  })

  const COULEURS = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#EC4899', '#06B6D4', '#14B8A6', '#6366F1', '#F97316'
  ]

  const CYCLES = ['PRIMAIRE', 'COLLEGE', 'LYCEE']
  const NIVEAUX_PRIMAIRE = ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2']
  const NIVEAUX_COLLEGE = ['SIXIEME', 'CINQUIEME', 'QUATRIEME', 'TROISIEME']
  const NIVEAUX_LYCEE = ['SECONDE', 'PREMIERE', 'TERMINALE']

  const normalizeEnumArray = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean)
    }

    if (typeof value !== 'string') {
      return []
    }

    const trimmed = value.trim()
    if (!trimmed || trimmed === '{}') {
      return []
    }

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const content = trimmed.slice(1, -1).trim()
      if (!content) {
        return []
      }

      return content
        .split(',')
        .map((item) => item.replace(/^\"(.*)\"$/, '$1').trim())
        .filter(Boolean)
    }

    return trimmed
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  useEffect(() => {
    loadData()
    loadEmailBackupSettings()
    if (isSuperAdmin) loadAutoSettings()
  }, [])

  const loadData = async () => {
    try {
      const [anneesRes, matieresRes] = await Promise.all([
        api.get('/annees'),
        api.get('/matieres')
      ])
      setAnnees(anneesRes.data)
      setMatieres(matieresRes.data)
    } catch (error) {
      console.error('Erreur lors du chargement des données', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAnnee = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/annees', {
        ...newAnnee,
        active: false
      })
      await loadData()
      setNewAnnee({ annee: '', date_debut: '', date_fin: '' })
      setShowNewAnnee(false)
      success("Année scolaire créée avec succès")
    } catch (error: any) {
      toastError(error.response?.data?.message || "Erreur lors de la création de l'année")
    }
  }

  const handleActiverAnnee = (id: string) => {
    setAnneeToActivate(id)
  }

  const confirmActiverAnnee = async () => {
    if (!anneeToActivate) return
    try {
      await api.put(`/annees/${anneeToActivate}/activer`)
      await loadData()
      success("Année scolaire activée avec succès")
    } catch (error) {
      toastError("Erreur lors de l'activation de l'année")
    } finally {
      setAnneeToActivate(null)
    }
  }

  const openEditAnnee = (annee: any) => {
    setEditingAnnee(annee)
    setEditAnneeForm({
      date_debut: annee.date_debut?.split('T')[0] || '',
      date_fin: annee.date_fin?.split('T')[0] || ''
    })
  }

  const handleUpdateAnnee = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingAnnee) return
    try {
      await api.put(`/annees/${editingAnnee.id}`, editAnneeForm)
      await loadData()
      setEditingAnnee(null)
      success("Année scolaire modifiée avec succès")
    } catch (error: any) {
      toastError(error.response?.data?.message || "Erreur lors de la modification")
    }
  }

  const confirmCloturerAnnee = async () => {
    if (!anneeToCloturer) return
    try {
      await api.put(`/annees/${anneeToCloturer}/cloturer`)
      await loadData()
      success("Année scolaire clôturée avec succès")
    } catch (error: any) {
      toastError(error.response?.data?.message || "Erreur lors de la clôture")
    } finally {
      setAnneeToCloturer(null)
    }
  }

  const openMatiereModal = (matiere?: any) => {
    if (matiere) {
      setEditingMatiere(matiere)
      // Supporte les formats tableau natif et "{A,B}" de PostgreSQL
      const cycles = normalizeEnumArray(matiere.cycles)
      const niveaux = normalizeEnumArray(matiere.niveaux)

      setMatiereForm({
        nom: matiere.nom,
        code: matiere.code,
        description: matiere.description || '',
        coefficient: matiere.coefficient,
        cycles: cycles,
        niveaux: niveaux,
        couleur: matiere.couleur || '#3B82F6'
      })
    } else {
      setEditingMatiere(null)
      setMatiereForm({
        nom: '',
        code: '',
        description: '',
        coefficient: 1,
        cycles: [],
        niveaux: [],
        couleur: '#3B82F6'
      })
    }
    setShowMatiereModal(true)
  }

  const closeMatiereModal = () => {
    setShowMatiereModal(false)
    setEditingMatiere(null)
  }

  const handleSaveMatiere = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingMatiere) {
        await api.put(`/matieres/${editingMatiere.id}`, matiereForm)
      } else {
        await api.post('/matieres', matiereForm)
      }
      await loadData()
      closeMatiereModal()
      success(editingMatiere ? "Matière modifiée avec succès" : "Matière créée avec succès")
    } catch (error: any) {
      toastError(error.response?.data?.message || "Erreur lors de l'enregistrement")
    }
  }

  const handleDeleteMatiere = (id: string, nom: string) => {
    setMatiereToDelete({ id, nom })
  }

  const confirmDeleteMatiere = async () => {
    if (!matiereToDelete) return
    try {
      await api.delete(`/matieres/${matiereToDelete.id}`)
      await loadData()
      success("Matière supprimée avec succès")
    } catch (error) {
      toastError('Erreur lors de la suppression')
    } finally {
      setMatiereToDelete(null)
    }
  }

  const toggleCycle = (cycle: string) => {
    if (matiereForm.cycles.includes(cycle)) {
      setMatiereForm({
        ...matiereForm,
        cycles: matiereForm.cycles.filter(c => c !== cycle)
      })
    } else {
      setMatiereForm({
        ...matiereForm,
        cycles: [...matiereForm.cycles, cycle]
      })
    }
  }

  const toggleNiveau = (niveau: string) => {
    if (matiereForm.niveaux.includes(niveau)) {
      setMatiereForm({
        ...matiereForm,
        niveaux: matiereForm.niveaux.filter(n => n !== niveau)
      })
    } else {
      setMatiereForm({
        ...matiereForm,
        niveaux: [...matiereForm.niveaux, niveau]
      })
    }
  }

  const loadAutoSettings = async () => {
    try {
      const res = await api.get('/backup/auto/settings')
      setAutoSettings(res.data.settings)
      setSavedFiles(res.data.files)
    } catch { /* ignore if not admin */ }
  }

  const loadEmailBackupSettings = async () => {
    try {
      const res = await api.get('/backup/email-settings')
      setEmailBackup(res.data)
      setCustomEmailDraft(res.data.customEmail || '')
    } catch { /* ignore */ }
  }

  const handleEmailBackupChange = async (patch: Partial<typeof emailBackup>) => {
    const next = { ...emailBackup, ...patch }
    setEmailBackup(next)
    setSavingEmailBackup(true)
    try {
      const res = await api.put('/backup/email-settings', {
        enabled: next.enabled,
        frequency: next.frequency,
        customEmail: next.customEmail,
      })
      setEmailBackup(res.data.settings)
      setCustomEmailDraft(res.data.settings.customEmail || '')
      success('Paramètres de sauvegarde par email mis à jour')
    } catch (err: any) {
      toastError(err?.response?.data?.message || 'Erreur lors de la mise à jour')
    } finally {
      setSavingEmailBackup(false)
    }
  }

  const handleBackup = async () => {
    setBackingUp(true)
    try {
      const response = await api.get('/backup', { responseType: 'blob' })
      const date = new Date().toISOString().slice(0, 10)
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `backup_ecole_${date}.json`
      a.click()
      window.URL.revokeObjectURL(url)
      success('Sauvegarde téléchargée avec succès')
    } catch {
      toastError('Erreur lors de la génération de la sauvegarde')
    } finally {
      setBackingUp(false)
    }
  }

  const handleSaveNow = async () => {
    setSavingNow(true)
    try {
      await api.post('/backup/auto/now')
      success('Sauvegarde créée sur le serveur')
      await loadAutoSettings()
    } catch {
      toastError('Erreur lors de la sauvegarde')
    } finally {
      setSavingNow(false)
    }
  }

  const handleAutoSettingsChange = async (patch: Partial<typeof autoSettings>) => {
    const next = { ...autoSettings, ...patch }
    setAutoSettings(next)
    try {
      await api.put('/backup/auto/settings', next)
      success('Paramètres de sauvegarde mis à jour')
    } catch {
      toastError('Erreur lors de la mise à jour')
    }
  }

  const handleDownloadSaved = async (filename: string) => {
    try {
      const response = await api.get(`/backup/auto/files/${filename}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      toastError('Erreur lors du téléchargement')
    }
  }

  const handleDeleteSaved = async (filename: string) => {
    try {
      await api.delete(`/backup/auto/files/${filename}`)
      success('Fichier supprimé')
      setDeleteFileConfirm(null)
      await loadAutoSettings()
    } catch {
      toastError('Erreur lors de la suppression')
    }
  }

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        if (!data.tables || data.version !== '1.0') {
          toastError('Fichier de sauvegarde invalide ou incompatible')
          return
        }
        setPendingRestoreData(data)
        setRestoreConfirm(true)
      } catch {
        toastError('Impossible de lire le fichier JSON')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const confirmRestore = async () => {
    if (!pendingRestoreData) return
    setRestoring(true)
    setRestoreConfirm(false)
    try {
      await api.post('/backup/restore', pendingRestoreData)
      success('Restauration effectuée avec succès. Veuillez vous reconnecter.')
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Erreur lors de la restauration')
    } finally {
      setRestoring(false)
      setPendingRestoreData(null)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
    return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
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

  // Grouper les matières par cycle
  const getCycles = (matiere: any): string[] => normalizeEnumArray(matiere.cycles)
  const matieresPrimaire = matieres.filter(m => getCycles(m).includes('PRIMAIRE'))
  const matieresCollege = matieres.filter(m => getCycles(m).includes('COLLEGE'))
  const matieresLycee = matieres.filter(m => getCycles(m).includes('LYCEE'))
  const matieresSansCycle = matieres.filter(m => getCycles(m).length === 0)

  return (
    <div className="space-y-5">
      {/* ── Page header ── */}
      <div>
        <h1 className="text-xl font-display font-bold text-gray-900">Configuration</h1>
        <p className="page-subtitle">Paramètres de l'application, années scolaires, matières et sauvegardes.</p>
      </div>

      {/* ── Navigation par onglets ── */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <nav className="flex gap-0 -mb-px overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-700 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ══ Onglet Personnalisation ══ */}
      {activeTab === 'personnalisation' && (
      <div className="card">
        <h2 className="text-base font-display font-semibold text-gray-900 flex items-center gap-2 mb-5">
          <Palette className="h-4 w-4 text-primary-600" />
          Personnalisation de l'interface
        </h2>
        <div className="space-y-6">
          {/* Nom et mention */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom de l'application
              </label>
              <input
                type="text"
                className="input"
                value={appNameDraft}
                onChange={e => setAppNameDraft(e.target.value)}
                placeholder="SchoolTogo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mention (sous le nom)
              </label>
              <input
                type="text"
                className="input"
                value={appTaglineDraft}
                onChange={e => setAppTaglineDraft(e.target.value)}
                placeholder="Système Togolais"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                updateSettings({ appName: appNameDraft.trim() || 'SchoolTogo', appTagline: appTaglineDraft })
                success('Nom de l\'application mis à jour')
              }}
              className="btn btn-primary"
            >
              Enregistrer le nom
            </button>
          </div>

          {/* Logo de l'école */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Logo de l'école
            </label>
            <div className="flex items-center gap-5">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 overflow-hidden">
                {settings.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo" className="h-full w-full object-contain p-1" />
                ) : (
                  <ImagePlus className="h-8 w-8 text-gray-300" />
                )}
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-500">
                  Format PNG, JPG ou SVG · Max 200 KB
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="btn btn-secondary btn-sm flex items-center gap-1.5"
                  >
                    <ImagePlus className="h-4 w-4" />
                    {settings.logoUrl ? 'Changer le logo' : 'Choisir un logo'}
                  </button>
                  {settings.logoUrl && (
                    <button
                      type="button"
                      onClick={() => { updateSettings({ logoUrl: '' }); success('Logo supprimé') }}
                      className="btn btn-secondary btn-sm text-red-600 hover:bg-red-50"
                    >
                      Supprimer
                    </button>
                  )}
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    if (file.size > 200 * 1024) {
                      toastError('Le logo ne doit pas dépasser 200 KB')
                      return
                    }
                    const reader = new FileReader()
                    reader.onload = (ev) => {
                      const dataUrl = ev.target?.result as string
                      updateSettings({ logoUrl: dataUrl })
                      success('Logo mis à jour')
                    }
                    reader.readAsDataURL(file)
                    e.target.value = ''
                  }}
                />
              </div>
            </div>
          </div>

          {/* Thème couleur */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Couleur du thème
            </label>
            <div className="flex flex-wrap gap-3">
              {COLOR_THEMES.map(theme => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => {
                    updateSettings({ themeId: theme.id })
                    success(`Thème "${theme.label}" appliqué`)
                  }}
                  className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all ${
                    settings.themeId === theme.id
                      ? 'border-gray-900 shadow-md'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  <span
                    className="h-5 w-5 rounded-full border border-black/10 flex-shrink-0"
                    style={{ backgroundColor: theme.swatch }}
                  />
                  {theme.label}
                  {settings.themeId === theme.id && (
                    <span className="text-xs text-gray-500">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      )}

      {/* ══ Onglet Années scolaires ══ */}
      {activeTab === 'annees' && (
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-display font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary-600" />
            Années scolaires
          </h2>
          <button
            onClick={() => setShowNewAnnee(!showNewAnnee)}
            className="btn btn-primary btn-sm flex items-center"
          >
            <Plus className="h-4 w-4 mr-1" />
            Nouvelle année
          </button>
        </div>

        {showNewAnnee && (
          <form onSubmit={handleCreateAnnee} className="mb-5 rounded-xl bg-gray-50 border border-gray-100 p-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Année (ex: 2025-2026)
                </label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder="2025-2026"
                  value={newAnnee.annee}
                  onChange={(e) => setNewAnnee({ ...newAnnee, annee: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date début
                </label>
                <input
                  type="date"
                  required
                  className="input"
                  value={newAnnee.date_debut}
                  onChange={(e) => setNewAnnee({ ...newAnnee, date_debut: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date fin
                </label>
                <input
                  type="date"
                  required
                  className="input"
                  value={newAnnee.date_fin}
                  onChange={(e) => setNewAnnee({ ...newAnnee, date_fin: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button type="submit" className="btn btn-primary btn-sm">
                Créer
              </button>
              <button
                type="button"
                onClick={() => setShowNewAnnee(false)}
                className="btn btn-secondary btn-sm"
              >
                Annuler
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {annees.map((annee) => (
            <div
              key={annee.id}
              className={`rounded-xl border-2 px-4 py-3 transition-colors ${
                annee.active
                  ? 'border-emerald-400 bg-emerald-50'
                  : 'border-gray-100 bg-white shadow-card'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {annee.active && (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                  <div>
                    <h3 className="font-display font-semibold text-gray-900">{annee.annee}</h3>
                    <p className="text-sm text-gray-600">
                      Du {new Date(annee.date_debut).toLocaleDateString('fr-FR')} au{' '}
                      {new Date(annee.date_fin).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditAnnee(annee)}
                    className="btn btn-sm btn-secondary flex items-center gap-1"
                    title="Modifier les dates"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    Modifier
                  </button>
                  {annee.active && (
                    <button
                      onClick={() => setAnneeToCloturer(annee.id)}
                      className="btn btn-sm bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-1"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      Clôturer
                    </button>
                  )}
                  {!annee.active && (
                    <button
                      onClick={() => handleActiverAnnee(annee.id)}
                      className="btn btn-sm bg-green-600 hover:bg-green-700 text-white"
                    >
                      Activer
                    </button>
                  )}
                  {annee.active && (
                    <span className="px-3 py-1 bg-green-600 text-white rounded-full text-sm font-medium">
                      Active
                    </span>
                  )}
                </div>
              </div>

              {/* Formulaire d'édition inline */}
              {editingAnnee?.id === annee.id && (
                <form onSubmit={handleUpdateAnnee} className="mt-3 rounded-lg bg-white border border-gray-200 p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Modifier les dates</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Date début</label>
                      <input
                        type="date"
                        required
                        className="input"
                        value={editAnneeForm.date_debut}
                        onChange={(e) => setEditAnneeForm({ ...editAnneeForm, date_debut: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Date fin</label>
                      <input
                        type="date"
                        required
                        className="input"
                        value={editAnneeForm.date_fin}
                        onChange={(e) => setEditAnneeForm({ ...editAnneeForm, date_fin: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button type="submit" className="btn btn-primary btn-sm">
                      Enregistrer
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingAnnee(null)}
                      className="btn btn-secondary btn-sm"
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>
      </div>

      )}

      {/* ══ Onglet Matières ══ */}
      {activeTab === 'matieres' && (
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-display font-semibold text-gray-900 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary-600" />
            Matières
            <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">{matieres.length}</span>
          </h2>
          <button
            onClick={() => openMatiereModal()}
            className="btn btn-primary btn-sm flex items-center"
          >
            <Plus className="h-4 w-4 mr-1" />
            Nouvelle matière
          </button>
        </div>

        <MatiereSection
          titre={`Primaire (${matieresPrimaire.length} matières)`}
          matieres={matieresPrimaire}
          onEdit={openMatiereModal}
          onDelete={handleDeleteMatiere}
        />

        <MatiereSection
          titre={`Collège (${matieresCollege.length} matières)`}
          matieres={matieresCollege}
          onEdit={openMatiereModal}
          onDelete={handleDeleteMatiere}
        />

        <MatiereSection
          titre={`Lycée (${matieresLycee.length} matières)`}
          matieres={matieresLycee}
          onEdit={openMatiereModal}
          onDelete={handleDeleteMatiere}
          wrapperClassName=""
        />

        <MatiereSection
          titre={`Non rattachées (toutes classes) (${matieresSansCycle.length} matières)`}
          matieres={matieresSansCycle}
          onEdit={openMatiereModal}
          onDelete={handleDeleteMatiere}
          wrapperClassName="mt-6"
          emptyMessage="Aucune matière non rattachée."
        />
      </div>

      )}

      {/* ══ Onglet Sauvegarde ══ */}
      {activeTab === 'sauvegarde' && (
      <div className="card space-y-5">
        <h2 className="text-base font-display font-semibold text-gray-900 flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-primary-600" />
          Sauvegarde de la base de données
        </h2>

        {/* Export instantané */}
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Download className="h-4 w-4 text-gray-500" /> Export instantané
          </h3>
          <p className="text-sm text-gray-500">
            Téléchargez immédiatement une copie complète de toutes les données au format JSON.
          </p>
          <button
            type="button"
            onClick={handleBackup}
            disabled={backingUp}
            className="btn btn-primary btn-sm flex items-center gap-2"
          >
            {backingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {backingUp ? 'Génération...' : 'Télécharger la sauvegarde'}
          </button>
        </div>

        {/* Restauration */}
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Upload className="h-4 w-4 text-gray-500" /> Restaurer depuis un fichier
          </h3>
          <p className="text-sm text-gray-500">
            Importez un fichier <code className="bg-gray-100 px-1 rounded text-xs">.json</code> de sauvegarde pour écraser toutes les données actuelles. <strong className="text-red-600">Cette action est irréversible.</strong>
          </p>
          <button
            type="button"
            onClick={() => restoreInputRef.current?.click()}
            disabled={restoring}
            className="btn btn-secondary btn-sm flex items-center gap-2 border-red-200 text-red-700 hover:bg-red-50"
          >
            {restoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {restoring ? 'Restauration en cours...' : 'Choisir un fichier de sauvegarde'}
          </button>
          <input
            ref={restoreInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleRestoreFile}
          />
        </div>

        {/* Sauvegarde automatique par email — scopée à l'école, accessible
            à ADMIN/DIRECTEUR (voir backupEmail.controller.js). */}
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Mail className="h-4 w-4 text-gray-500" /> Sauvegarde automatique par email
          </h3>
          <p className="text-sm text-gray-500">
            Recevez régulièrement une copie complète des données de votre école par email,
            sans avoir à y penser.
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleEmailBackupChange({ enabled: !emailBackup.enabled })}
              disabled={savingEmailBackup}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${emailBackup.enabled ? 'bg-primary-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${emailBackup.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className="text-sm font-medium text-gray-700">
              {emailBackup.enabled ? 'Activée' : 'Désactivée'}
            </span>
          </div>

          {emailBackup.enabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fréquence</label>
                <select
                  className="input"
                  value={emailBackup.frequency}
                  onChange={e => handleEmailBackupChange({ frequency: e.target.value })}
                >
                  <option value="daily">Quotidienne</option>
                  <option value="weekly">Hebdomadaire</option>
                  <option value="monthly">Mensuelle</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adresse email de réception (optionnel)
                </label>
                <input
                  type="email"
                  className="input"
                  placeholder="ex: it@monecole.tg"
                  value={customEmailDraft}
                  onChange={e => setCustomEmailDraft(e.target.value)}
                  onBlur={() => {
                    const trimmed = customEmailDraft.trim()
                    if (trimmed !== (emailBackup.customEmail || '')) {
                      handleEmailBackupChange({ customEmail: trimmed || null })
                    }
                  }}
                />
              </div>
              <p className="sm:col-span-2 -mt-2 text-xs text-gray-400">
                {emailBackup.customEmail
                  ? `Envoyée uniquement à ${emailBackup.customEmail}.`
                  : "Laissez vide pour envoyer aux administrateurs et directeurs actifs de l'école — remplissez pour envoyer uniquement à cette adresse."}
              </p>
            </div>
          )}

          {emailBackup.lastSentAt && (
            <p className="text-xs text-gray-500">
              Dernier envoi : <strong>{new Date(emailBackup.lastSentAt).toLocaleString('fr-FR')}</strong>
              {emailBackup.lastStatus === 'FAILED' && (
                <span className="text-red-600"> — échec{emailBackup.lastError ? ` (${emailBackup.lastError})` : ''}</span>
              )}
              {emailBackup.lastStatus === 'SUCCESS' && (
                <span className="text-emerald-600"> — envoyé avec succès</span>
              )}
            </p>
          )}
        </div>

        {/* Sauvegarde automatique planifiée — dump multi-écoles, réservé à
            SUPER_ADMIN côté backend (voir backup.routes.js) : masqué pour un
            ADMIN d'école, qui n'y a de toute façon pas accès. */}
        {isSuperAdmin && (
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-500" /> Sauvegarde planifiée (plateforme)
          </h3>
          <p className="text-sm text-gray-500 -mt-2">
            Dump fichier de toutes les écoles, réservé aux opérateurs de la plateforme.
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleAutoSettingsChange({ enabled: !autoSettings.enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoSettings.enabled ? 'bg-primary-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${autoSettings.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className="text-sm font-medium text-gray-700">
              {autoSettings.enabled ? 'Activée' : 'Désactivée'}
            </span>
          </div>

          {autoSettings.enabled && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fréquence</label>
                <select
                  className="input"
                  value={autoSettings.frequency}
                  onChange={e => handleAutoSettingsChange({ frequency: e.target.value })}
                >
                  <option value="daily">Quotidienne</option>
                  <option value="weekly">Hebdomadaire (dim.)</option>
                  <option value="monthly">Mensuelle (1er du mois)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Heure de déclenchement</label>
                <select
                  className="input"
                  value={autoSettings.hour}
                  onChange={e => handleAutoSettingsChange({ hour: Number(e.target.value) })}
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2, '0')}h00</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fichiers conservés</label>
                <select
                  className="input"
                  value={autoSettings.keepCount}
                  onChange={e => handleAutoSettingsChange({ keepCount: Number(e.target.value) })}
                >
                  {[3, 5, 7, 10, 14, 30].map(n => (
                    <option key={n} value={n}>{n} dernières sauvegardes</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {autoSettings.lastBackup && (
            <p className="text-xs text-gray-500">
              Dernière sauvegarde automatique : <strong>{new Date(autoSettings.lastBackup).toLocaleString('fr-FR')}</strong>
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveNow}
              disabled={savingNow}
              className="btn btn-secondary btn-sm flex items-center gap-2"
            >
              {savingNow ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sauvegarder maintenant
            </button>
          </div>
        </div>
        )}

        {/* Liste des fichiers sauvegardés (implicitement vide pour un ADMIN
            d'école, puisque loadAutoSettings() n'est appelé que pour
            SUPER_ADMIN ci-dessus) */}
        {savedFiles.length > 0 && (
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Sauvegardes sur le serveur ({savedFiles.length})</h3>
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {savedFiles.map(f => (
                <div key={f.filename} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{f.filename}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(f.createdAt).toLocaleString('fr-FR')} — {formatFileSize(f.size)}
                    </p>
                  </div>
                  <div className="flex gap-1 ml-2 shrink-0">
                    <button
                      onClick={() => handleDownloadSaved(f.filename)}
                      className="p-1.5 rounded text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                      title="Télécharger"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteFileConfirm(f.filename)}
                      className="p-1.5 rounded text-gray-400 hover:bg-red-100 hover:text-red-600"
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      )}

      {/* ── Dialogs de confirmation (toujours montés) ── */}
      <ConfirmDialog
        isOpen={!!deleteFileConfirm}
        title="Supprimer cette sauvegarde"
        message={`Voulez-vous vraiment supprimer le fichier "${deleteFileConfirm}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        onConfirm={() => deleteFileConfirm && handleDeleteSaved(deleteFileConfirm)}
        onCancel={() => setDeleteFileConfirm(null)}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={restoreConfirm}
        title="Confirmer la restauration"
        message="Toutes les données actuelles (élèves, notes, paiements…) seront REMPLACÉES par celles du fichier. Cette action est irréversible. Continuer ?"
        confirmLabel="Restaurer"
        cancelLabel="Annuler"
        onConfirm={confirmRestore}
        onCancel={() => { setRestoreConfirm(false); setPendingRestoreData(null) }}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={!!anneeToActivate}
        title="Activer cette année scolaire"
        message="L'année actuellement active sera désactivée. Confirmer ?"
        confirmLabel="Activer"
        cancelLabel="Annuler"
        onConfirm={confirmActiverAnnee}
        onCancel={() => setAnneeToActivate(null)}
        variant="warning"
      />

      <ConfirmDialog
        isOpen={!!anneeToCloturer}
        title="Clôturer cette année scolaire"
        message="L'année scolaire sera clôturée et désactivée. Aucune année ne sera active après cette opération. Vous pourrez ensuite créer ou activer une nouvelle année. Confirmer ?"
        confirmLabel="Clôturer"
        cancelLabel="Annuler"
        onConfirm={confirmCloturerAnnee}
        onCancel={() => setAnneeToCloturer(null)}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={!!matiereToDelete}
        title="Supprimer cette matière"
        message={matiereToDelete ? `Voulez-vous vraiment supprimer la matière "${matiereToDelete.nom}" ?` : ''}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        onConfirm={confirmDeleteMatiere}
        onCancel={() => setMatiereToDelete(null)}
        variant="danger"
      />

      {/* ── Modal Matière ── */}
      {showMatiereModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-base font-display font-semibold text-gray-900">
                {editingMatiere ? 'Modifier la matière' : 'Nouvelle matière'}
              </h3>
              <button onClick={closeMatiereModal} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMatiere} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Nom <span className="text-red-500">*</span></label>
                  <input type="text" required className="input" value={matiereForm.nom}
                    onChange={(e) => setMatiereForm({ ...matiereForm, nom: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Code <span className="text-red-500">*</span></label>
                  <input type="text" required className="input" value={matiereForm.code}
                    onChange={(e) => setMatiereForm({ ...matiereForm, code: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Description</label>
                <textarea className="input" rows={2} value={matiereForm.description}
                  onChange={(e) => setMatiereForm({ ...matiereForm, description: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Coefficient</label>
                  <input type="number" min="1" max="10" className="input" value={matiereForm.coefficient}
                    onChange={(e) => setMatiereForm({ ...matiereForm, coefficient: parseInt(e.target.value) })} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Couleur</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {COULEURS.map((couleur) => (
                      <button key={couleur} type="button"
                        className={`h-7 w-7 rounded-lg border-2 transition-all ${matiereForm.couleur === couleur ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-105'}`}
                        style={{ backgroundColor: couleur }}
                        onClick={() => setMatiereForm({ ...matiereForm, couleur })}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Cycles */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Cycles</label>
                <div className="flex gap-2 flex-wrap">
                  {CYCLES.map((cycle) => (
                    <button key={cycle} type="button"
                      onClick={() => toggleCycle(cycle)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition-all border ${
                        matiereForm.cycles.includes(cycle)
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'border-gray-200 text-gray-600 hover:border-primary-300'
                      }`}
                    >
                      {cycle}
                    </button>
                  ))}
                </div>
              </div>

              {/* Niveaux */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Niveaux</label>
                <div className="space-y-3">
                  {[
                    { label: 'Primaire', niveaux: NIVEAUX_PRIMAIRE },
                    { label: 'Collège',  niveaux: NIVEAUX_COLLEGE },
                    { label: 'Lycée',    niveaux: NIVEAUX_LYCEE },
                  ].map(({ label, niveaux }) => (
                    <div key={label}>
                      <p className="text-xs font-medium text-gray-500 mb-1.5">{label}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {niveaux.map((niveau) => (
                          <button key={niveau} type="button"
                            onClick={() => toggleNiveau(niveau)}
                            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all border ${
                              matiereForm.niveaux.includes(niveau)
                                ? 'bg-primary-50 text-primary-700 border-primary-300'
                                : 'border-gray-200 text-gray-500 hover:border-gray-300'
                            }`}
                          >
                            {niveau}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button type="button" onClick={closeMatiereModal} className="btn btn-secondary">Annuler</button>
                <button type="submit" className="btn btn-primary">
                  {editingMatiere ? 'Enregistrer' : 'Créer la matière'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

