import { useState, useEffect, useRef } from 'react'
import Modal from './Modal'
import api from '../services/api'
import { Eleve } from '../types'
import { printRecu } from '../utils/printRecu'
import { useToast } from '../contexts/ToastContext'

interface PaiementToEdit {
  id: string
  eleveId: string
  eleveName: string
  typePaiement: string
  montant: number
  datePaiement: string
  moisConcerne?: string
  modePaiement: string
  numeroPiece?: string
  remarques?: string
  statut?: string
}

interface PaiementFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  paiement?: PaiementToEdit
}

interface CreatedPaiementData {
  id?: string
  eleve?: { nom: string; prenom: string; matricule?: string; classe?: { nom: string } }
  typePaiement: string
  montant: number
  devise: string
  datePaiement: string
  modePaiement: string
  moisConcerne?: string
  numeroPiece?: string
  remarques?: string
  statut: string
  montantDu?: number
  totalPayeAnnuel?: number
}

export default function PaiementFormModal({ isOpen, onClose, onSuccess, paiement }: PaiementFormModalProps) {
  const { error: toastError } = useToast()
  const isEditing = !!paiement
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'form' | 'confirm'>('form')
  const [createdPaiementData, setCreatedPaiementData] = useState<CreatedPaiementData | null>(null)
  const [eleves, setEleves] = useState<Eleve[]>([])
  const [anneeActive, setAnneeActive] = useState<string>('')
  const [eleveSearch, setEleveSearch] = useState('')
  const [showEleveDropdown, setShowEleveDropdown] = useState(false)
  const eleveDropdownRef = useRef<HTMLDivElement>(null)
  const [classeTarifs, setClasseTarifs] = useState<{ montantScolarite: number; montantMensuel: number; montantInscription: number } | null>(null)
  const [eleveHistorique, setEleveHistorique] = useState<{ totalPaye: number; resteAPayer: number; totalDu: number } | null>(null)
  const [formData, setFormData] = useState({
    eleveId: '',
    typePaiement: 'SCOLARITE',
    montant: '',
    datePaiement: new Date().toISOString().split('T')[0],
    moisConcerne: '',
    modePaiement: 'ESPECES',
    numeroPiece: '',
    remarques: '',
    statut: 'VALIDE'
  })

  useEffect(() => {
    if (isOpen) {
      setStep('form')
      setCreatedPaiementData(null)
      if (isEditing && paiement) {
        setFormData({
          eleveId: paiement.eleveId,
          typePaiement: paiement.typePaiement,
          montant: String(paiement.montant),
          datePaiement: paiement.datePaiement
            ? paiement.datePaiement.split('T')[0]
            : new Date().toISOString().split('T')[0],
          moisConcerne: paiement.moisConcerne || '',
          modePaiement: paiement.modePaiement,
          numeroPiece: paiement.numeroPiece || '',
          remarques: paiement.remarques || '',
          statut: paiement.statut || 'VALIDE'
        })
      } else {
        resetForm()
        loadEleves()
        loadAnneeActive()
      }
    }
  }, [isOpen, paiement])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (eleveDropdownRef.current && !eleveDropdownRef.current.contains(e.target as Node)) {
        setShowEleveDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredEleveSuggestions = eleveSearch.trim().length >= 1
    ? eleves.filter(e =>
        `${e.prenom} ${e.nom} ${e.matricule}`.toLowerCase().includes(eleveSearch.toLowerCase())
      ).slice(0, 8)
    : []

  const loadEleves = async () => {
    try {
      const response = await api.get('/eleves', { params: { all: true } })
      const elevesRaw = Array.isArray(response.data) ? response.data : (response.data?.data ?? [])
      const mappedEleves = elevesRaw
        .map((data: any) => ({
          id: data.id,
          matricule: data.matricule,
          nom: data.nom,
          prenom: data.prenom,
          statut: data.statut,
          classe: data.classe ? {
            id: data.classe.id,
            nom: data.classe.nom
          } : null
        }))
        .filter((e: any) => String(e.statut || '').toUpperCase() === 'ACTIF')
        .sort((a: any, b: any) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr'))
      setEleves(mappedEleves)
    } catch (error) {
      console.error('Erreur lors du chargement des élèves', error)
    }
  }

  const loadAnneeActive = async () => {
    try {
      const response = await api.get('/annees/active')
      setAnneeActive(response.data?.annee || '')
    } catch (error) {
      console.error('Erreur lors du chargement de l annee active', error)
      setAnneeActive('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const montant = parseFloat(formData.montant)
      if (Number.isNaN(montant) || montant <= 0) {
        toastError('Montant invalide')
        setLoading(false)
        return
      }

      const data = {
        typePaiement: formData.typePaiement,
        montant,
        devise: 'XOF',
        datePaiement: formData.datePaiement,
        moisConcerne: formData.moisConcerne.trim() || undefined,
        modePaiement: formData.modePaiement,
        numeroPiece: formData.numeroPiece.trim() || undefined,
        remarques: formData.remarques.trim() || undefined,
        statut: formData.statut
      }

      if (isEditing && paiement) {
        await api.put(`/paiements/${paiement.id}`, data)
        onSuccess()
        onClose()
      } else {
        if (!anneeActive) {
          toastError('Aucune année scolaire active. Activez une année avant d\'enregistrer un paiement.')
          setLoading(false)
          return
        }
        const res = await api.post('/paiements', {
          ...data,
          eleveId: formData.eleveId,
          anneeScolaire: anneeActive
        })

        // Prépare les données pour l'impression du reçu
        const selectedEleve = eleves.find(e => e.id === formData.eleveId)
        const montantNum = parseFloat(formData.montant) || 0
        const tarif = classeTarifs
          ? (formData.typePaiement === 'INSCRIPTION'
              ? classeTarifs.montantInscription
              : formData.typePaiement === 'SCOLARITE'
              ? (classeTarifs.montantScolarite || classeTarifs.montantMensuel)
              : 0)
          : 0
        const totalPayeApres = (eleveHistorique?.totalPaye || 0) + montantNum

        setCreatedPaiementData({
          id: res.data?.id,
          eleve: selectedEleve ? {
            nom: selectedEleve.nom,
            prenom: selectedEleve.prenom,
            matricule: selectedEleve.matricule,
            classe: selectedEleve.classe ? { nom: selectedEleve.classe.nom } : undefined
          } : undefined,
          typePaiement: formData.typePaiement,
          montant: montantNum,
          devise: 'XOF',
          datePaiement: formData.datePaiement,
          modePaiement: formData.modePaiement,
          moisConcerne: formData.moisConcerne || undefined,
          numeroPiece: formData.numeroPiece || undefined,
          remarques: formData.remarques || undefined,
          statut: formData.statut,
          montantDu: tarif > 0 ? tarif : undefined,
          totalPayeAnnuel: tarif > 0 ? totalPayeApres : undefined
        })
        setStep('confirm')
        resetForm()
      }
    } catch (error: any) {
      console.error('Erreur lors de l\'enregistrement du paiement', error)
      toastError(error.response?.data?.message || 'Erreur lors de l\'enregistrement du paiement')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      eleveId: '',
      typePaiement: 'SCOLARITE',
      montant: '',
      datePaiement: new Date().toISOString().split('T')[0],
      moisConcerne: '',
      modePaiement: 'ESPECES',
      numeroPiece: '',
      remarques: '',
      statut: 'VALIDE'
    })
    setEleveSearch('')
    setShowEleveDropdown(false)
    setClasseTarifs(null)
    setEleveHistorique(null)
  }

  const handleEleveSelect = async (eleve: Eleve) => {
    setFormData(prev => ({ ...prev, eleveId: eleve.id }))
    setEleveSearch(`${eleve.prenom} ${eleve.nom}`)
    setShowEleveDropdown(false)
    setClasseTarifs(null)
    setEleveHistorique(null)

    // Charger tarifs classe + solde élève en parallèle
    const [classeRes, soldeRes] = await Promise.allSettled([
      eleve.classe?.id ? api.get(`/classes/${eleve.classe.id}`) : Promise.reject(),
      api.get(`/paiements/solde/${eleve.id}`)
    ])

    let tarifs = { montantScolarite: 0, montantMensuel: 0, montantInscription: 0 }
    if (classeRes.status === 'fulfilled') {
      const d = classeRes.value.data
      tarifs = {
        montantScolarite: Number(d.montant_scolarite || d.montantScolarite || 0),
        montantMensuel: Number(d.montant_mensuel || d.montantMensuel || 0),
        montantInscription: Number(d.montant_inscription || d.montantInscription || 0)
      }
      setClasseTarifs(tarifs)
    }

    let histo = { totalPaye: 0, resteAPayer: 0, totalDu: 0 }
    if (soldeRes.status === 'fulfilled') {
      const s = soldeRes.value.data
      histo = {
        totalPaye: Number(s.totalPaye || 0),
        resteAPayer: Number(s.resteAPayer || 0),
        totalDu: Number(s.totalDu || 0)
      }
      setEleveHistorique(histo)
    }

    // Ne pas auto-remplir le montant — laisser l'utilisateur saisir
    setFormData(prev => ({ ...prev, montant: '' }))
  }

  const handleTypeChange = (type: string) => {
    setFormData(prev => {
      let montant = prev.montant
      if (classeTarifs) {
        // Changement de type : vider le montant, l'utilisateur saisit lui-même
        montant = ''
      }
      return { ...prev, typePaiement: type, montant }
    })
  }

  const mois = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ]

  const handlePrintConfirm = (print: boolean) => {
    if (print && createdPaiementData) {
      printRecu(createdPaiementData)
    }
    onSuccess()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Modifier un paiement' : 'Enregistrer un paiement'} size="lg">
      {step === 'confirm' && createdPaiementData ? (
        <div className="flex flex-col items-center py-6 px-4 space-y-6">
          {/* Icône succès */}
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          {/* Message */}
          <div className="text-center space-y-1">
            <p className="text-lg font-semibold text-gray-900">Paiement enregistré avec succès</p>
            <p className="text-sm text-gray-500">
              {createdPaiementData.eleve
                ? `${createdPaiementData.eleve.prenom} ${createdPaiementData.eleve.nom} · ${createdPaiementData.montant.toLocaleString()} XOF`
                : `${createdPaiementData.montant.toLocaleString()} XOF`}
            </p>
          </div>

          {/* Question */}
          <div className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-center space-y-4">
            <p className="text-sm font-medium text-gray-800">Voulez-vous imprimer le reçu ?</p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => handlePrintConfirm(true)}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Oui, imprimer
              </button>
              <button
                type="button"
                onClick={() => handlePrintConfirm(false)}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Non, fermer
              </button>
            </div>
          </div>
        </div>
      ) : (
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informations de base */}
        <div>
          <h3 className="text-lg font-display font-semibold mb-4 text-gray-900">Informations de base</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Élève</label>
              {isEditing ? (
                <div className="input bg-gray-50 text-gray-700">{paiement?.eleveName || '-'}</div>
              ) : (
                <div ref={eleveDropdownRef} className="relative">
                  <input
                    type="text"
                    required={!formData.eleveId}
                    className="input"
                    placeholder="Rechercher par nom ou matricule..."
                    value={eleveSearch}
                    onChange={(e) => {
                      setEleveSearch(e.target.value)
                      setShowEleveDropdown(true)
                      if (!e.target.value) {
                        setFormData(prev => ({ ...prev, eleveId: '' }))
                      }
                    }}
                    onFocus={() => { if (eleveSearch) setShowEleveDropdown(true) }}
                    autoComplete="off"
                  />
                  {formData.eleveId && (
                    <p className="mt-1 text-xs text-green-700 font-medium">
                      ✓ {eleves.find(e => e.id === formData.eleveId)?.classe?.nom || 'Sans classe'}
                    </p>
                  )}
                  {showEleveDropdown && filteredEleveSuggestions.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-52 overflow-y-auto">
                      {filteredEleveSuggestions.map(eleve => (
                        <button
                          key={eleve.id}
                          type="button"
                          className="w-full text-left px-3 py-2.5 hover:bg-primary-50 transition-colors border-b border-gray-50 last:border-0"
                          onClick={() => handleEleveSelect(eleve)}
                        >
                          <p className="text-sm font-medium text-gray-900">{eleve.prenom} {eleve.nom}</p>
                          <p className="text-xs text-gray-500">{eleve.matricule} · {eleve.classe?.nom || 'Sans classe'}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  {showEleveDropdown && eleveSearch.trim().length >= 1 && filteredEleveSuggestions.length === 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg px-3 py-3 text-sm text-gray-500">
                      Aucun élève trouvé
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type de paiement <span className="text-red-500">*</span>
              </label>
              <select
                className="input"
                value={formData.typePaiement}
                onChange={(e) => handleTypeChange(e.target.value)}
              >
                <option value="INSCRIPTION">Inscription</option>
                <option value="SCOLARITE">Scolarité</option>
                <option value="CANTINE">Cantine</option>
                <option value="TRANSPORT">Transport</option>
                <option value="UNIFORME">Uniforme</option>
                <option value="AUTRES">Autres</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Montant (FCFA) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                className="input"
                placeholder="25000"
                value={formData.montant}
                onChange={(e) => setFormData({ ...formData, montant: e.target.value })}
              />
              {(() => {
                if (!classeTarifs) return null
                const tarif = formData.typePaiement === 'INSCRIPTION'
                  ? classeTarifs.montantInscription
                  : formData.typePaiement === 'SCOLARITE'
                  ? (classeTarifs.montantScolarite || classeTarifs.montantMensuel)
                  : 0
                if (tarif <= 0) return null

                const dejaPayeAnnuel = eleveHistorique?.totalPaye || 0
                const saisiActuel = parseFloat(formData.montant) || 0
                const totalApres = dejaPayeAnnuel + saisiActuel
                const resteApres = Math.max(0, tarif - totalApres)
                const exces = totalApres > tarif ? totalApres - tarif : 0
                const isSolde = resteApres === 0 && exces === 0 && saisiActuel > 0
                const progress = Math.min(100, Math.round((totalApres / tarif) * 100))

                return (
                  <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2.5">
                    {/* Avertissement dépassement */}
                    {exces > 0 && (
                      <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
                        <span className="text-red-500 font-bold text-sm shrink-0">⚠</span>
                        <p className="text-xs text-red-700 font-medium">
                          Montant saisi dépasse le tarif de <span className="font-bold">{exces.toLocaleString()} FCFA</span>. Vérifiez avant d'enregistrer.
                        </p>
                      </div>
                    )}

                    {/* Barre de progression */}
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Tarif annuel</span>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, montant: String(Math.max(0, tarif - dejaPayeAnnuel)) }))}
                          className="font-semibold text-primary-600 hover:underline"
                          title="Cliquer pour remplir le montant restant"
                        >
                          {tarif.toLocaleString()} FCFA
                        </button>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            exces > 0 ? 'bg-red-500' : isSolde ? 'bg-emerald-500' : 'bg-amber-400'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="mt-0.5 text-right text-[11px] text-gray-400">{progress}%</div>
                    </div>

                    {/* Détail 3 colonnes */}
                    <div className="grid grid-cols-3 divide-x divide-gray-200 text-center">
                      <div className="px-2">
                        <p className="text-[11px] text-gray-400 uppercase tracking-wide">Déjà versé</p>
                        <p className={`mt-0.5 text-sm font-bold ${dejaPayeAnnuel > 0 ? 'text-gray-700' : 'text-gray-300'}`}>
                          {dejaPayeAnnuel > 0 ? dejaPayeAnnuel.toLocaleString() : '—'}
                        </p>
                      </div>
                      <div className="px-2">
                        <p className="text-[11px] text-gray-400 uppercase tracking-wide">Ce versement</p>
                        <p className={`mt-0.5 text-sm font-bold ${
                          exces > 0 ? 'text-red-600' : saisiActuel > 0 ? 'text-primary-600' : 'text-gray-300'
                        }`}>
                          {saisiActuel > 0 ? saisiActuel.toLocaleString() : '—'}
                        </p>
                      </div>
                      <div className="px-2">
                        <p className="text-[11px] text-gray-400 uppercase tracking-wide">Reste après</p>
                        <p className={`mt-0.5 text-sm font-bold ${
                          exces > 0 ? 'text-red-600' :
                          isSolde ? 'text-emerald-600' :
                          saisiActuel > 0 ? 'text-amber-600' : 'text-gray-300'
                        }`}>
                          {saisiActuel === 0 ? '—' :
                           exces > 0 ? `-${exces.toLocaleString()} excès` :
                           isSolde ? '✓ Soldé' :
                           resteApres.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de paiement <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                className="input"
                value={formData.datePaiement}
                onChange={(e) => setFormData({ ...formData, datePaiement: e.target.value })}
              />
            </div>
            {formData.typePaiement === 'SCOLARITE' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mois concerné
                </label>
                <select
                  className="input"
                  value={formData.moisConcerne}
                  onChange={(e) => setFormData({ ...formData, moisConcerne: e.target.value })}
                >
                  <option value="">Sélectionner un mois...</option>
                  {mois.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Mode de paiement */}
        <div>
          <h3 className="text-lg font-display font-semibold mb-4 text-gray-900">Mode de paiement</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mode de paiement <span className="text-red-500">*</span>
              </label>
              <select
                className="input"
                value={formData.modePaiement}
                onChange={(e) => setFormData({ ...formData, modePaiement: e.target.value })}
              >
                <option value="ESPECES">Espèces</option>
                <option value="CHEQUE">Chèque</option>
                <option value="VIREMENT">Virement</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
              </select>
            </div>
            {formData.modePaiement !== 'ESPECES' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Numéro de pièce
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder={
                    formData.modePaiement === 'CHEQUE'
                      ? 'Numéro de chèque'
                      : formData.modePaiement === 'VIREMENT'
                      ? 'Référence virement'
                      : 'Référence transaction'
                  }
                  value={formData.numeroPiece}
                  onChange={(e) => setFormData({ ...formData, numeroPiece: e.target.value })}
                />
              </div>
            )}
          </div>
        </div>

        {/* Statut (édition uniquement) */}
        {isEditing && (
          <div>
            <h3 className="text-lg font-display font-semibold mb-4 text-gray-900">Statut</h3>
            <select
              className="input"
              value={formData.statut}
              onChange={(e) => setFormData({ ...formData, statut: e.target.value })}
            >
              <option value="VALIDE">Validé</option>
              <option value="EN_ATTENTE">En attente</option>
              <option value="ANNULE">Annulé</option>
            </select>
          </div>
        )}

        {/* Remarques */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Remarques
          </label>
          <textarea
            className="input"
            rows={3}
            placeholder="Remarques éventuelles sur ce paiement..."
            value={formData.remarques}
            onChange={(e) => setFormData({ ...formData, remarques: e.target.value })}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={() => {
              onClose()
              resetForm()
            }}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
            disabled={loading}
          >
            Annuler
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Enregistrement...' : isEditing ? 'Modifier' : 'Enregistrer'}
          </button>
        </div>
      </form>
      )}
    </Modal>
  )
}
