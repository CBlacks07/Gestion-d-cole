import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../services/api'
import { Eleve } from '../types'
import { format } from 'date-fns'
import { User, Phone, Mail, MapPin } from 'lucide-react'

export default function EleveDetail() {
  const { id } = useParams()
  const [eleve, setEleve] = useState<Eleve | null>(null)
  const [loading, setLoading] = useState(true)

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
              <button className="w-full btn btn-primary text-sm">
                Voir les notes
              </button>
              <button className="w-full btn btn-secondary text-sm">
                Voir les absences
              </button>
              <button className="w-full btn btn-secondary text-sm">
                Historique des paiements
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
