import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../services/api'
import { Eleve } from '../types'
import { format } from 'date-fns'
import { User, Phone, Mail, MapPin } from 'lucide-react'
import Modal from '../components/Modal'

export default function EleveDetail() {
  const { id } = useParams()
  const [eleve, setEleve] = useState<Eleve | null>(null)
  const [loading, setLoading] = useState(true)
  const [showNotesModal, setShowNotesModal] = useState(false)
  const [showAbsencesModal, setShowAbsencesModal] = useState(false)
  const [showPaiementsModal, setShowPaiementsModal] = useState(false)
  const [notesData, setNotesData] = useState<any>(null)
  const [absencesData, setAbsencesData] = useState<any>(null)
  const [paiementsData, setPaiementsData] = useState<any[]>([])
  const [loadingModal, setLoadingModal] = useState(false)

  useEffect(() => {
    loadEleve()
  }, [id])

  // Helper pour formater les dates en toute sécurité
  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return '-'
      return format(date, 'dd/MM/yyyy')
    } catch {
      return '-'
    }
  }

  const loadEleve = async () => {
    try {
      const response = await api.get(`/eleves/${id}`)
      const data = response.data

      // Mapper les données du backend (snake_case) vers le frontend (camelCase)
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
    } catch (error) {
      console.error('Erreur lors du chargement de l\'élève', error)
    } finally {
      setLoading(false)
    }
  }

  const handleVoirNotes = async () => {
    setLoadingModal(true)
    setShowNotesModal(true)
    try {
      const response = await api.get(`/notes/bulletin/${id}`)
      setNotesData(response.data)
    } catch (error: any) {
      console.error('Erreur lors du chargement des notes', error)
      alert(error.response?.data?.message || 'Erreur lors du chargement des notes')
      setShowNotesModal(false)
    } finally {
      setLoadingModal(false)
    }
  }

  const handleVoirAbsences = async () => {
    setLoadingModal(true)
    setShowAbsencesModal(true)
    try {
      const response = await api.get(`/absences/stats/${id}`)
      setAbsencesData(response.data)
    } catch (error: any) {
      console.error('Erreur lors du chargement des absences', error)
      alert(error.response?.data?.message || 'Erreur lors du chargement des absences')
      setShowAbsencesModal(false)
    } finally {
      setLoadingModal(false)
    }
  }

  const handleHistoriquePaiements = async () => {
    setLoadingModal(true)
    setShowPaiementsModal(true)
    try {
      const response = await api.get(`/paiements/historique/${id}`)
      setPaiementsData(response.data)
    } catch (error: any) {
      console.error('Erreur lors du chargement de l\'historique', error)
      alert(error.response?.data?.message || 'Erreur lors du chargement de l\'historique')
      setShowPaiementsModal(false)
    } finally {
      setLoadingModal(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>
  }

  if (!eleve) {
    return <div className="text-center py-12">Élève non trouvé</div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        {eleve.prenom} {eleve.nom}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Informations personnelles */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Informations personnelles</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Matricule</p>
                <p className="font-medium">{eleve.matricule}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Sexe</p>
                <p className="font-medium">{eleve.sexe === 'M' ? 'Garçon' : 'Fille'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Date de naissance</p>
                <p className="font-medium">
                  {formatDate(eleve.dateNaissance)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Lieu de naissance</p>
                <p className="font-medium">{eleve.lieuNaissance}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Classe</p>
                <p className="font-medium">{eleve.classe?.nom || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Statut</p>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    eleve.statut === 'actif'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {eleve.statut}
                </span>
              </div>
            </div>
          </div>

          {/* Informations tuteur */}
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Informations du tuteur</h2>
            <div className="space-y-3">
              <div className="flex items-center">
                <User className="h-5 w-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm text-gray-600">Nom complet</p>
                  <p className="font-medium">
                    {eleve.tuteur.prenom} {eleve.tuteur.nom}
                  </p>
                </div>
              </div>
              <div className="flex items-center">
                <Phone className="h-5 w-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm text-gray-600">Téléphone</p>
                  <p className="font-medium">{eleve.tuteur.telephone}</p>
                </div>
              </div>
              {eleve.tuteur.email && (
                <div className="flex items-center">
                  <Mail className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium">{eleve.tuteur.email}</p>
                  </div>
                </div>
              )}
              {eleve.tuteur.adresse && (
                <div className="flex items-center">
                  <MapPin className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm text-gray-600">Adresse</p>
                    <p className="font-medium">{eleve.tuteur.adresse}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Photo */}
          <div className="card">
            <div className="w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center">
              <User className="h-24 w-24 text-gray-400" />
            </div>
          </div>

          {/* Actions rapides */}
          <div className="card">
            <h3 className="font-bold mb-3">Actions rapides</h3>
            <div className="space-y-2">
              <button
                onClick={handleVoirNotes}
                className="w-full btn btn-primary text-sm"
              >
                Voir les notes
              </button>
              <button
                onClick={handleVoirAbsences}
                className="w-full btn btn-secondary text-sm"
              >
                Voir les absences
              </button>
              <button
                onClick={handleHistoriquePaiements}
                className="w-full btn btn-secondary text-sm"
              >
                Historique des paiements
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal des notes */}
      <Modal
        isOpen={showNotesModal}
        onClose={() => setShowNotesModal(false)}
        title={`Bulletin de ${eleve.prenom} ${eleve.nom}`}
        size="lg"
      >
        {loadingModal ? (
          <div className="text-center py-8">Chargement...</div>
        ) : notesData ? (
          <div className="max-h-96 overflow-y-auto">
            <div className="mb-6">
              <p className="text-lg font-semibold">
                Moyenne générale: <span className="text-primary-600">{notesData.moyenneGenerale}/20</span>
              </p>
            </div>

            <h3 className="font-bold mb-2">Notes par matière</h3>
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Matière</th>
                  <th className="text-right py-2">Note</th>
                  <th className="text-right py-2">Coef.</th>
                  <th className="text-right py-2">Période</th>
                </tr>
              </thead>
              <tbody>
                {notesData.notes?.map((note: any) => (
                  <tr key={note.id} className="border-b">
                    <td className="py-2">{note.matiere?.nom || '-'}</td>
                    <td className="text-right">{note.note}/20</td>
                    <td className="text-right">{note.matiere?.coefficient || 1}</td>
                    <td className="text-right text-sm text-gray-600">{note.periode}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {(!notesData.notes || notesData.notes.length === 0) && (
              <p className="text-center py-8 text-gray-500">Aucune note disponible</p>
            )}
          </div>
        ) : null}
      </Modal>

      {/* Modal des absences */}
      <Modal
        isOpen={showAbsencesModal}
        onClose={() => setShowAbsencesModal(false)}
        title={`Absences de ${eleve.prenom} ${eleve.nom}`}
      >
        {loadingModal ? (
          <div className="text-center py-8">Chargement...</div>
        ) : absencesData ? (
          <div className="max-h-96 overflow-y-auto">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">{absencesData.total || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Justifiées</p>
                <p className="text-2xl font-bold text-green-600">{absencesData.justifiees || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Non justifiées</p>
                <p className="text-2xl font-bold text-red-600">{absencesData.nonJustifiees || 0}</p>
              </div>
            </div>

            {absencesData.absences && absencesData.absences.length > 0 ? (
              <div>
                <h3 className="font-bold mb-2">Détails des absences</h3>
                <div className="space-y-2">
                  {absencesData.absences.map((absence: any) => (
                    <div key={absence.id} className="border-l-4 border-gray-300 pl-3 py-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{formatDate(absence.date)}</p>
                          <p className="text-sm text-gray-600">{absence.periode}</p>
                          {absence.motif && (
                            <p className="text-sm text-gray-600 mt-1">{absence.motif}</p>
                          )}
                        </div>
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            absence.justifiee
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {absence.justifiee ? 'Justifiée' : 'Non justifiée'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-center py-8 text-gray-500">Aucune absence enregistrée</p>
            )}
          </div>
        ) : null}
      </Modal>

      {/* Modal de l'historique des paiements */}
      <Modal
        isOpen={showPaiementsModal}
        onClose={() => setShowPaiementsModal(false)}
        title={`Historique des paiements - ${eleve.prenom} ${eleve.nom}`}
        size="lg"
      >
        {loadingModal ? (
          <div className="text-center py-8">Chargement...</div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {paiementsData && paiementsData.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Date</th>
                    <th className="text-left py-2">Type</th>
                    <th className="text-right py-2">Montant</th>
                    <th className="text-left py-2">Mode</th>
                    <th className="text-left py-2">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {paiementsData.map((paiement: any) => (
                    <tr key={paiement.id} className="border-b">
                      <td className="py-2">{formatDate(paiement.datePaiement || paiement.date_paiement)}</td>
                      <td>{paiement.typePaiement || paiement.type_paiement}</td>
                      <td className="text-right font-medium">
                        {paiement.montant.toLocaleString()} {paiement.devise || 'XOF'}
                      </td>
                      <td>{paiement.modePaiement || paiement.mode_paiement}</td>
                      <td>
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            paiement.statut === 'VALIDE'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {paiement.statut}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-center py-8 text-gray-500">Aucun paiement enregistré</p>
            )}

            {paiementsData && paiementsData.length > 0 && (
              <div className="mt-6 pt-4 border-t">
                <p className="text-right font-bold">
                  Total: {paiementsData.reduce((sum: number, p: any) => sum + p.montant, 0).toLocaleString()} XOF
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
