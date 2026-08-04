import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../services/api'
import { BookOpen, Check, CheckSquare, ChevronRight, Eye, FileText, Loader2, Plus, Printer, Square, Trash2, Users } from 'lucide-react'
import InfoTip from '../components/InfoTip'
import { useToast } from '../contexts/ToastContext'
import { printBulletinsClasse } from '../utils/printBulletin'
import { useAuthStore } from '../store/authStore'

const cycleLabel = (value: string | undefined) => {
  const v = String(value || '').toUpperCase()
  if (v === 'PRIMAIRE') return 'Primaire'
  if (v === 'COLLEGE') return 'College'
  if (v === 'LYCEE') return 'Lycee'
  return value || '-'
}

const niveauLabel = (value: string | undefined) => {
  const v = String(value || '').toUpperCase()
  const map: Record<string, string> = {
    SIXIEME: '6e',
    CINQUIEME: '5e',
    QUATRIEME: '4e',
    TROISIEME: '3e',
    SECONDE: '2nde',
    PREMIERE: '1ere',
    TERMINALE: 'Terminale'
  }
  return map[v] || value || '-'
}

const mapClasse = (data: any) => {
  const enseignantPrincipal =
    data.enseignantPrincipal ||
    (data.enseignant_principal_id && {
      id: data.enseignant_id,
      nom: data.enseignant_nom,
      prenom: data.enseignant_prenom,
      matricule: data.enseignant_matricule
    })

  const eleves = Array.isArray(data.eleves) ? data.eleves : []
  const effectifActuel = Number(data.effectifActuel ?? data.effectif_actuel ?? eleves.length ?? 0)
  const effectifMax = Number(data.effectifMax ?? data.effectif_max ?? 0)

  return {
    id: data.id,
    nom: data.nom || '-',
    cycle: data.cycle,
    niveau: data.niveau,
    section: data.section,
    anneeScolaire: data.anneeScolaire || data.annee_scolaire || '-',
    enseignantPrincipal,
    salle: data.salle || '',
    montantInscription: Number(data.montantInscription ?? data.montant_inscription ?? 0),
    montantMensuel: Number(data.montantMensuel ?? data.montant_mensuel ?? 0),
    devise: data.devise || 'XOF',
    effectifActuel,
    effectifMax: Number.isFinite(effectifMax) ? effectifMax : 0,
    eleves
  }
}

type EnseignantOption = {
  id: string
  nom: string
  prenom: string
  statut?: string
  specialites?: Array<{ matiere_id?: string }>
}

type MatiereEditState = {
  enseignant_id: string
  coefficient: string
}

export default function ClasseDetail() {
  const { id } = useParams()
  const { success, warning, error: toastError } = useToast()
  const { user } = useAuthStore()
  const userRole = String(user?.role || '').toUpperCase()
  const canManageClasse = userRole === 'ADMIN' || userRole === 'DIRECTEUR'
  const canOpenEleveDetail = userRole !== 'ENSEIGNANT'
  const [classe, setClasse] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [matieres, setMatieres] = useState<any[]>([])
  const [allMatieres, setAllMatieres] = useState<any[]>([])
  const [enseignants, setEnseignants] = useState<EnseignantOption[]>([])
  const [matiereEdits, setMatiereEdits] = useState<Record<string, MatiereEditState>>({})
  const [savingMatiereId, setSavingMatiereId] = useState('')
  const [anneeActive, setAnneeActive] = useState<any>(null)
  const [showAddMatiere, setShowAddMatiere] = useState(false)
  const [bulkSelections, setBulkSelections] = useState<Record<string, { checked: boolean; coefficient: string; enseignant_id: string }>>({})
  const [savingBulk, setSavingBulk] = useState(false)
  const [bulletinPeriode, setBulletinPeriode] = useState('')
  const [bulletinAnneeScolaire, setBulletinAnneeScolaire] = useState('')
  const [generatingBulletins, setGeneratingBulletins] = useState(false)

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    try {
      const classeRes = await api.get(`/classes/${id}`)
      const mappedClasse = mapClasse(classeRes.data)
      setClasse(mappedClasse)

      let annee = mappedClasse.anneeScolaire
      try {
        const anneeRes = await api.get('/annees/active')
        setAnneeActive(anneeRes.data)
        if (anneeRes.data?.annee) {
          annee = anneeRes.data.annee
        }
      } catch {
        setAnneeActive(null)
      }

      setBulletinAnneeScolaire(annee || mappedClasse.anneeScolaire || '')

      if (annee) {
        await loadMatieresClasse(annee)
      } else {
        setMatieres([])
      }

      const matieresRes = await api.get('/matieres', {
        params: {
          cycle: mappedClasse.cycle,
          niveau: mappedClasse.niveau
        }
      })
      const sortedMatieres = [...matieresRes.data].sort((a: any, b: any) =>
        String(a.nom || '').localeCompare(String(b.nom || ''), 'fr')
      )
      setAllMatieres(sortedMatieres)

      if (canManageClasse) {
        const enseignantsRes = await api.get('/enseignants', { params: { limit: 500 } })
        const enseignantsRaw = Array.isArray(enseignantsRes.data) ? enseignantsRes.data : (enseignantsRes.data?.data ?? [])
        const actifs = enseignantsRaw
          .filter((ens: any) => String(ens.statut || '').toUpperCase() === 'ACTIF')
          .sort((a: any, b: any) =>
            `${a.nom || ''} ${a.prenom || ''}`.localeCompare(`${b.nom || ''} ${b.prenom || ''}`, 'fr')
          )
        setEnseignants(actifs)
      } else {
        setEnseignants([])
      }
    } catch (error) {
      console.error('Erreur lors du chargement des donnees', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMatieresClasse = async (annee: string) => {
    try {
      const response = await api.get(`/classe-matieres/classe/${id}`, {
        params: { annee_scolaire: annee }
      })
      const sorted = [...response.data].sort((a: any, b: any) =>
        String(a.nom || '').localeCompare(String(b.nom || ''), 'fr')
      )
      setMatieres(sorted)
      const nextEdits: Record<string, MatiereEditState> = {}
      sorted.forEach((item: any) => {
        nextEdits[item.id] = {
          enseignant_id: item.enseignant_id || '',
          coefficient: String(item.coefficient || 1)
        }
      })
      setMatiereEdits(nextEdits)
    } catch (error) {
      console.error('Erreur lors du chargement des matieres', error)
    }
  }


  const handleRemoveMatiere = async (matiereId: string) => {
    if (!confirm('Retirer cette matiere de la classe ?')) {
      return
    }

    try {
      await api.delete(`/classe-matieres/${matiereId}`)
      const annee = anneeActive?.annee || classe?.anneeScolaire
      if (annee) {
        await loadMatieresClasse(annee)
      }
      success("Matière retirée avec succès")
    } catch {
      toastError('Erreur lors de la suppression')
    }
  }

  const bulletinPeriodes = useMemo(() => {
    const cycle = String(classe?.cycle || '').toUpperCase()
    return cycle === 'LYCEE'
      ? ['1er Semestre', '2eme Semestre']
      : ['1er Trimestre', '2eme Trimestre', '3eme Trimestre']
  }, [classe?.cycle])

  useEffect(() => {
    if (!bulletinPeriode && bulletinPeriodes.length) {
      setBulletinPeriode(bulletinPeriodes[0])
    } else if (bulletinPeriode && !bulletinPeriodes.includes(bulletinPeriode)) {
      setBulletinPeriode(bulletinPeriodes[0])
    }
  }, [bulletinPeriodes])

  const matieresDisponibles = useMemo(
    () => allMatieres.filter((m) => !matieres.some((cm) => cm.matiere_id === m.id)),
    [allMatieres, matieres]
  )

  const handleGenerateBulletins = async () => {
    if (!bulletinAnneeScolaire.trim()) {
      warning("Veuillez saisir l'année scolaire")
      return
    }
    if (!classe?.eleves?.length) {
      warning('Aucun élève dans cette classe')
      return
    }
    setGeneratingBulletins(true)
    try {
      const results = await Promise.allSettled(
        classe.eleves.map((eleve: any) =>
          api.get(`/notes/bulletin/${eleve.id}`, {
            params: { periode: bulletinPeriode, anneeScolaire: bulletinAnneeScolaire }
          })
        )
      )
      const bulletins = results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<any>).value.data)
      if (!bulletins.length) {
        warning('Aucun bulletin disponible pour cette période')
        return
      }
      printBulletinsClasse(bulletins)
    } catch {
      toastError('Erreur lors de la génération des bulletins')
    } finally {
      setGeneratingBulletins(false)
    }
  }

  const initBulkSelections = () => {
    const selections: typeof bulkSelections = {}
    matieresDisponibles.forEach(m => {
      const recommended = getEnseignantsForMatiere(m.id)[0]
      selections[m.id] = {
        checked: false,
        coefficient: String(m.coefficient || 1),
        enseignant_id: recommended?.id || ''
      }
    })
    setBulkSelections(selections)
  }

  const toggleBulkItem = (id: string) => {
    setBulkSelections(prev => ({
      ...prev,
      [id]: { ...prev[id], checked: !prev[id]?.checked }
    }))
  }

  const toggleBulkAll = () => {
    const allChecked = matieresDisponibles.every(m => bulkSelections[m.id]?.checked)
    setBulkSelections(prev => {
      const next = { ...prev }
      matieresDisponibles.forEach(m => {
        next[m.id] = { ...next[m.id], checked: !allChecked }
      })
      return next
    })
  }

  const updateBulkField = (id: string, field: 'coefficient' | 'enseignant_id', value: string) => {
    setBulkSelections(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }))
  }

  const bulkCheckedCount = Object.values(bulkSelections).filter(s => s.checked).length

  const handleBulkAdd = async () => {
    const toAdd = matieresDisponibles.filter(m => bulkSelections[m.id]?.checked)
    if (toAdd.length === 0) return
    setSavingBulk(true)
    const annee = anneeActive?.annee || classe?.anneeScolaire
    let added = 0
    let errors = 0
    for (const m of toAdd) {
      const sel = bulkSelections[m.id]
      const coefficient = parseInt(sel.coefficient, 10)
      try {
        await api.post('/classe-matieres', {
          classe_id: id,
          matiere_id: m.id,
          coefficient: Number.isFinite(coefficient) && coefficient > 0 ? coefficient : 1,
          enseignant_id: sel.enseignant_id || null,
          annee_scolaire: annee
        })
        added++
      } catch {
        errors++
      }
    }
    if (annee) await loadMatieresClasse(annee)
    if (added > 0) success(`${added} matière${added > 1 ? 's' : ''} ajoutée${added > 1 ? 's' : ''}`)
    if (errors > 0) warning(`${errors} matière${errors > 1 ? 's' : ''} en erreur (doublon probable)`)
    setShowAddMatiere(false)
    setSavingBulk(false)
  }

  const getEnseignantsForMatiere = (matiereId: string) => {
    if (!matiereId) return enseignants
    return [...enseignants].sort((a, b) => {
      const aSpec = Array.isArray(a.specialites) && a.specialites.some((s) => s?.matiere_id === matiereId)
      const bSpec = Array.isArray(b.specialites) && b.specialites.some((s) => s?.matiere_id === matiereId)
      if (aSpec !== bSpec) return aSpec ? -1 : 1
      return `${a.nom || ''} ${a.prenom || ''}`.localeCompare(`${b.nom || ''} ${b.prenom || ''}`, 'fr')
    })
  }

  const handleMatiereEditChange = (id: string, key: keyof MatiereEditState, value: string) => {
    setMatiereEdits((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || { enseignant_id: '', coefficient: '1' }),
        [key]: value
      }
    }))
  }

  const handleUpdateMatiere = async (item: any) => {
    const current = matiereEdits[item.id] || {
      enseignant_id: item.enseignant_id || '',
      coefficient: String(item.coefficient || 1)
    }
    const coefficient = parseInt(current.coefficient, 10)
    if (Number.isNaN(coefficient) || coefficient <= 0) {
      warning('Coefficient invalide')
      return
    }

    try {
      setSavingMatiereId(item.id)
      await api.put(`/classe-matieres/${item.id}`, {
        enseignant_id: current.enseignant_id || null,
        coefficient
      })
      const annee = anneeActive?.annee || classe?.anneeScolaire
      if (annee) {
        await loadMatieresClasse(annee)
      }
      success('Affectation mise a jour')
    } catch (error: any) {
      toastError(error.response?.data?.message || "Erreur lors de la mise a jour de l affectation")
    } finally {
      setSavingMatiereId('')
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

  if (!classe) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <BookOpen className="h-8 w-8 text-gray-400" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-gray-700">Classe introuvable</p>
          <p className="text-sm text-gray-400 mt-1">Cette classe n'existe pas ou a été supprimée.</p>
        </div>
        <Link to="/classes" className="btn btn-secondary">← Retour aux classes</Link>
      </div>
    )
  }

  const effectifMaxDisplay = classe.effectifMax > 0 ? String(classe.effectifMax) : '-'

  return (
    <div className="space-y-3">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link to="/classes" className="hover:text-primary-600 transition-colors">Classes</Link>
        <ChevronRight className="h-4 w-4 flex-shrink-0" />
        <span className="font-medium text-gray-900">{classe.nom}</span>
      </nav>

      <div className="card-sm max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-display font-bold text-gray-900">{classe.nom}</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {cycleLabel(classe.cycle)} - {niveauLabel(classe.niveau)}
            </p>
          </div>
          {classe.section && (
            <span className="rounded-md bg-primary-50 px-2 py-1 text-xs font-semibold text-primary-700">
              Section {classe.section}
            </span>
          )}
        </div>
      </div>

      <div className="grid max-w-5xl grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Cycle',         value: cycleLabel(classe.cycle) },
          { label: 'Niveau',        value: niveauLabel(classe.niveau) },
          { label: 'Effectif',      value: `${classe.effectifActuel} / ${effectifMaxDisplay}` },
          { label: 'Année scolaire',value: classe.anneeScolaire || '—' },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl bg-white shadow-card px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">{label}</p>
            <p className="mt-1 text-lg font-bold text-gray-900 leading-tight">{value}</p>
          </div>
        ))}
      </div>

      <div className="card max-w-5xl">
        <h2 className="text-sm font-display font-semibold text-gray-900 mb-3">Informations</h2>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <div className="rounded-lg bg-gray-50 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Titulaire</p>
            <p className="mt-1 truncate text-sm font-semibold text-gray-900">
              {classe.enseignantPrincipal
                ? `${classe.enseignantPrincipal.prenom} ${classe.enseignantPrincipal.nom}`
                : <span className="text-gray-400 font-normal">—</span>}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Salle</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">{classe.salle || <span className="text-gray-400 font-normal">—</span>}</p>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Inscription</p>
            <p className="mt-1 text-sm font-semibold text-primary-700">
              {classe.montantInscription.toLocaleString()} {classe.devise}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Mensuel</p>
            <p className="mt-1 text-sm font-semibold text-primary-700">
              {classe.montantMensuel.toLocaleString()} {classe.devise}
            </p>
          </div>
        </div>
      </div>

      <div className="card-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center text-base font-display font-semibold text-gray-900">
            <BookOpen className="mr-2 h-4 w-4 text-primary-600" />
            Matières de la classe
          </h2>
          {canManageClasse && (
            <button
              onClick={() => { setShowAddMatiere(prev => !prev); if (!showAddMatiere) initBulkSelections() }}
              className="btn btn-primary"
            >
              <Plus className="h-4 w-4" />
              Ajouter des matières
            </button>
          )}
        </div>

        {canManageClasse && showAddMatiere && (
          <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
            {matieresDisponibles.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">
                Toutes les matières compatibles sont déjà assignées.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-2.5">
                  <button type="button" onClick={toggleBulkAll} className="flex items-center gap-2 text-xs font-medium text-gray-600 hover:text-primary-600">
                    {matieresDisponibles.every(m => bulkSelections[m.id]?.checked)
                      ? <CheckSquare className="h-4 w-4 text-primary-600" />
                      : <Square className="h-4 w-4" />}
                    Tout sélectionner
                  </button>
                  <span className="text-xs text-gray-400">{bulkCheckedCount} / {matieresDisponibles.length} sélectionnée{bulkCheckedCount > 1 ? 's' : ''}</span>
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                  {matieresDisponibles.map(m => {
                    const sel = bulkSelections[m.id]
                    const checked = sel?.checked
                    return (
                      <div key={m.id} className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${checked ? 'bg-primary-50/50' : 'hover:bg-white'}`}>
                        <button type="button" onClick={() => toggleBulkItem(m.id)} className="shrink-0">
                          {checked
                            ? <CheckSquare className="h-4.5 w-4.5 text-primary-600" />
                            : <Square className="h-4.5 w-4.5 text-gray-300" />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium truncate ${checked ? 'text-gray-900' : 'text-gray-500'}`}>{m.nom}</p>
                          {m.code && <p className="text-[11px] text-gray-400">{m.code}</p>}
                        </div>
                        <input
                          type="number" min="1" placeholder="Coef."
                          className="input h-8 w-16 text-xs text-center"
                          value={sel?.coefficient ?? String(m.coefficient || 1)}
                          onChange={e => updateBulkField(m.id, 'coefficient', e.target.value)}
                        />
                        <select
                          className="input h-8 w-44 text-xs"
                          value={sel?.enseignant_id ?? ''}
                          onChange={e => updateBulkField(m.id, 'enseignant_id', e.target.value)}
                        >
                          <option value="">— Enseignant —</option>
                          {getEnseignantsForMatiere(m.id).map(ens => (
                            <option key={ens.id} value={ens.id}>{ens.nom} {ens.prenom}</option>
                          ))}
                        </select>
                      </div>
                    )
                  })}
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-white px-4 py-3">
                  <button onClick={() => setShowAddMatiere(false)} className="btn btn-ghost text-sm">Annuler</button>
                  <button
                    onClick={handleBulkAdd}
                    disabled={bulkCheckedCount === 0 || savingBulk}
                    className="btn btn-primary text-sm"
                  >
                    {savingBulk
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Enregistrement...</>
                      : <>Ajouter {bulkCheckedCount > 0 ? `(${bulkCheckedCount})` : ''}</>}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {matieres.length > 0 ? (
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {matieres.map((matiere) => (
              <div
                key={matiere.id}
                className="rounded-xl bg-white shadow-card p-3"
                style={{ borderLeft: `3px solid ${matiere.couleur || '#6366f1'}` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{matiere.nom}</p>
                    {canManageClasse ? (
                      <div className="mt-2 space-y-1.5">
                        <select
                          className="input h-8 text-xs"
                          value={matiereEdits[matiere.id]?.enseignant_id ?? ''}
                          onChange={(e) => handleMatiereEditChange(matiere.id, 'enseignant_id', e.target.value)}
                        >
                          <option value="">— Aucun enseignant —</option>
                          {getEnseignantsForMatiere(matiere.matiere_id).map((ens) => (
                            <option key={ens.id} value={ens.id}>{ens.nom} {ens.prenom}</option>
                          ))}
                        </select>
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center gap-1">
                            <InfoTip text="Coefficient appliqué à cette matière dans le calcul de la moyenne" />
                          </div>
                          <input
                            type="number"
                            min="1"
                            title="Coefficient de la matière"
                            className="input h-8 w-16 text-xs"
                            value={matiereEdits[matiere.id]?.coefficient ?? String(matiere.coefficient || 1)}
                            onChange={(e) => handleMatiereEditChange(matiere.id, 'coefficient', e.target.value)}
                          />
                          <button
                            onClick={() => handleUpdateMatiere(matiere)}
                            disabled={savingMatiereId === matiere.id}
                            className="btn btn-primary flex-1 text-xs py-1.5"
                          >
                            <Check className="h-3 w-3" />
                            {savingMatiereId === matiere.id ? '...' : 'Affecter'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1 space-y-0.5">
                        <p className="text-xs text-gray-500">
                          Coef. <span className="font-semibold text-gray-700">{matiere.coefficient}</span>
                        </p>
                        {matiere.enseignant_nom && (
                          <p className="truncate text-xs text-gray-500">
                            {matiere.enseignant_prenom} {matiere.enseignant_nom}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  {canManageClasse && (
                    <button
                      onClick={() => handleRemoveMatiere(matiere.id)}
                      className="icon-btn-danger shrink-0"
                      title="Retirer cette matière"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-xl bg-gray-50 py-8 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">Aucune matière assignée à cette classe.</p>
            {canManageClasse && (
              <p className="text-xs text-gray-400 mt-1">Cliquez sur "Ajouter une matière" ci-dessus.</p>
            )}
          </div>
        )}
      </div>

      <div className="card-flush">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
          <h2 className="flex items-center gap-2 text-base font-display font-semibold text-gray-900">
            <Users className="h-4 w-4 text-primary-600" />
            Liste des élèves
          </h2>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
            {classe.eleves?.length || 0} élève{(classe.eleves?.length || 0) > 1 ? 's' : ''}
          </span>
        </div>

        {classe.eleves && classe.eleves.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Matricule</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Élève</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Sexe</th>
                  {canOpenEleveDetail && <th className="px-4 py-2.5 w-16" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {classe.eleves.map((eleve: any) => (
                  <tr key={eleve.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-gray-700 whitespace-nowrap">{eleve.matricule}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${eleve.sexe === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                          {eleve.prenom?.[0]}{eleve.nom?.[0]}
                        </div>
                        {canOpenEleveDetail ? (
                          <Link to={`/eleves/${eleve.id}`} className="font-medium text-primary-600 hover:underline">
                            {eleve.nom} {eleve.prenom}
                          </Link>
                        ) : (
                          <span className="font-medium text-gray-900">{eleve.nom} {eleve.prenom}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${eleve.sexe === 'M' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'}`}>
                        {eleve.sexe === 'M' ? 'Garçon' : 'Fille'}
                      </span>
                    </td>
                    {canOpenEleveDetail && (
                      <td className="px-4 py-2.5">
                        <Link to={`/eleves/${eleve.id}`} className="icon-btn" title="Voir le dossier">
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-10 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
              <Users className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500">Aucun élève dans cette classe.</p>
          </div>
        )}
      </div>

      {userRole !== 'ENSEIGNANT' && (
      <div className="card-sm">
        <h2 className="mb-4 flex items-center gap-2 text-base font-display font-semibold text-gray-900">
          <FileText className="h-4 w-4 text-primary-600" />
          Bulletins de classe
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">Période</label>
            <select value={bulletinPeriode} onChange={(e) => setBulletinPeriode(e.target.value)} className="input text-sm">
              {bulletinPeriodes.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">Année scolaire</label>
            <input
              type="text"
              className="input w-36 text-sm"
              value={bulletinAnneeScolaire}
              onChange={(e) => setBulletinAnneeScolaire(e.target.value)}
              placeholder="2024-2025"
            />
          </div>
          <button
            onClick={handleGenerateBulletins}
            disabled={generatingBulletins || !classe?.eleves?.length}
            className="btn btn-primary disabled:opacity-50"
          >
            {generatingBulletins
              ? <><span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />Génération...</>
              : <><Printer className="h-4 w-4" />Imprimer bulletins ({classe?.eleves?.length || 0})</>
            }
          </button>
        </div>
        {!classe?.eleves?.length && (
          <p className="mt-2 text-xs text-gray-400">Aucun élève dans cette classe.</p>
        )}
      </div>
      )}
    </div>
  )
}


