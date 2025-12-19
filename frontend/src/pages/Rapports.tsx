import { useEffect, useState } from 'react'
import api from '../services/api'
import { FileText, Download, X } from 'lucide-react'
import Modal from '../components/Modal'

export default function Rapports() {
  const [dashboard, setDashboard] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [rapportData, setRapportData] = useState<any>(null)
  const [showRapportModal, setShowRapportModal] = useState(false)
  const [rapportType, setRapportType] = useState('')
  const [generatingRapport, setGeneratingRapport] = useState(false)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      const response = await api.get('/rapports/dashboard')
      setDashboard(response.data)
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
        case 'notes':
          // Utiliser le dashboard pour les notes (ou créer un nouvel endpoint)
          response = await api.get('/rapports/dashboard')
          break
        case 'effectifs':
          response = await api.get('/rapports/dashboard')
          break
        default:
          throw new Error('Type de rapport inconnu')
      }

      setRapportData(response.data)
      setShowRapportModal(true)
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erreur lors de la génération du rapport')
    } finally {
      setGeneratingRapport(false)
    }
  }

  const exportToCSV = () => {
    if (!rapportData) return

    let csvContent = ''
    let filename = ''

    switch (rapportType) {
      case 'financier':
        filename = 'rapport_financier.csv'
        csvContent = 'Type de paiement,Nombre,Montant total\n'
        rapportData.parType?.forEach((item: any) => {
          csvContent += `${item._id},${item.count},${item.total}\n`
        })
        break
      case 'assiduite':
        filename = 'rapport_assiduite.csv'
        csvContent = 'Matricule,Nom,Prénom,Total absences,Justifiées,Non justifiées\n'
        rapportData.absencesParEleve?.forEach((item: any) => {
          csvContent += `${item.eleve.matricule},${item.eleve.nom},${item.eleve.prenom},${item.total},${item.justifiees},${item.nonJustifiees}\n`
        })
        break
      case 'effectifs':
        filename = 'rapport_effectifs.csv'
        csvContent = 'Cycle,Nombre d\'élèves\n'
        rapportData.elevesParCycle?.forEach((item: any) => {
          csvContent += `${item._id},${item.count}\n`
        })
        break
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
  }

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>
  }

  const rapportTypes = [
    {
      name: 'Rapport financier',
      description: 'État des recettes et dépenses',
      icon: FileText,
      color: 'bg-green-500',
      type: 'financier',
    },
    {
      name: 'Rapport d\'assiduité',
      description: 'Statistiques d\'absences par classe',
      icon: FileText,
      color: 'bg-blue-500',
      type: 'assiduite',
    },
    {
      name: 'Rapport de notes',
      description: 'Résultats scolaires par période',
      icon: FileText,
      color: 'bg-purple-500',
      type: 'notes',
    },
    {
      name: 'Rapport d\'effectifs',
      description: 'Répartition des élèves',
      icon: FileText,
      color: 'bg-orange-500',
      type: 'effectifs',
    },
  ]

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Rapports et Statistiques</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {rapportTypes.map((rapport) => (
          <div key={rapport.name} className="card hover:shadow-lg transition-shadow">
            <div className="flex items-start">
              <div className={`p-3 rounded-lg ${rapport.color} text-white mr-4`}>
                <rapport.icon className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-1">{rapport.name}</h3>
                <p className="text-sm text-gray-600 mb-4">{rapport.description}</p>
                <button
                  onClick={() => handleGenerateRapport(rapport.type)}
                  disabled={generatingRapport}
                  className="btn btn-primary flex items-center text-sm disabled:opacity-50"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {generatingRapport && rapportType === rapport.type ? 'Génération...' : 'Générer le rapport'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="text-xl font-bold mb-4">Vue d'ensemble</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-gray-600">Élèves actifs</p>
            <p className="text-3xl font-bold text-primary-600">{dashboard?.totalEleves}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Classes</p>
            <p className="text-3xl font-bold text-primary-600">{dashboard?.totalClasses}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Recettes</p>
            <p className="text-3xl font-bold text-green-600">
              {dashboard?.recettesTotal.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">{dashboard?.devise}</p>
          </div>
        </div>
      </div>

      {/* Modal d'affichage des rapports */}
      <Modal
        isOpen={showRapportModal}
        onClose={() => {
          setShowRapportModal(false)
          setRapportData(null)
        }}
        title={`Rapport ${rapportType}`}
      >
        <div className="max-h-96 overflow-y-auto">
          {rapportType === 'financier' && rapportData && (
            <div>
              <div className="mb-6">
                <p className="text-lg font-semibold mb-2">
                  Total des recettes: {rapportData.totalRecettes.toLocaleString()} {rapportData.devise}
                </p>
                <p className="text-sm text-gray-600">
                  Nombre de paiements: {rapportData.nombrePaiements}
                </p>
              </div>

              <h3 className="font-bold mb-2">Par type de paiement</h3>
              <table className="w-full mb-4">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Type</th>
                    <th className="text-right py-2">Nombre</th>
                    <th className="text-right py-2">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {rapportData.parType?.map((item: any) => (
                    <tr key={item._id} className="border-b">
                      <td className="py-2">{item._id}</td>
                      <td className="text-right">{item.count}</td>
                      <td className="text-right">{item.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3 className="font-bold mb-2 mt-4">Par mode de paiement</h3>
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Mode</th>
                    <th className="text-right py-2">Nombre</th>
                    <th className="text-right py-2">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {rapportData.parModePaiement?.map((item: any) => (
                    <tr key={item._id} className="border-b">
                      <td className="py-2">{item._id}</td>
                      <td className="text-right">{item.count}</td>
                      <td className="text-right">{item.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {rapportType === 'assiduite' && rapportData && (
            <div>
              <div className="mb-6">
                <p className="text-lg font-semibold mb-2">
                  Total des absences: {rapportData.totalAbsences}
                </p>
              </div>

              <h3 className="font-bold mb-2">Absences par élève</h3>
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Matricule</th>
                    <th className="text-left py-2">Nom</th>
                    <th className="text-right py-2">Total</th>
                    <th className="text-right py-2">Justifiées</th>
                    <th className="text-right py-2">Non justifiées</th>
                  </tr>
                </thead>
                <tbody>
                  {rapportData.absencesParEleve?.map((item: any) => (
                    <tr key={item.eleve.id} className="border-b">
                      <td className="py-2">{item.eleve.matricule}</td>
                      <td>{item.eleve.prenom} {item.eleve.nom}</td>
                      <td className="text-right">{item.total}</td>
                      <td className="text-right text-green-600">{item.justifiees}</td>
                      <td className="text-right text-red-600">{item.nonJustifiees}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {rapportType === 'effectifs' && rapportData && (
            <div>
              <div className="mb-6">
                <p className="text-lg font-semibold mb-2">
                  Total des élèves: {rapportData.totalEleves}
                </p>
              </div>

              <h3 className="font-bold mb-2">Répartition par cycle</h3>
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Cycle</th>
                    <th className="text-right py-2">Nombre d'élèves</th>
                  </tr>
                </thead>
                <tbody>
                  {rapportData.elevesParCycle?.map((item: any) => (
                    <tr key={item._id} className="border-b">
                      <td className="py-2">{item._id}</td>
                      <td className="text-right">{item.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {rapportType === 'notes' && rapportData && (
            <div>
              <div className="mb-6">
                <p className="text-lg font-semibold mb-2">
                  Statistiques des résultats scolaires
                </p>
              </div>

              <p className="text-sm text-gray-600">
                Cette fonctionnalité affichera les moyennes par classe et par élève.
                Utilisez la page "Classes" pour voir les détails par classe.
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => {
              setShowRapportModal(false)
              setRapportData(null)
            }}
            className="btn btn-secondary"
          >
            Fermer
          </button>
          {rapportType !== 'notes' && (
            <button
              onClick={exportToCSV}
              className="btn btn-primary flex items-center"
            >
              <Download className="h-4 w-4 mr-2" />
              Exporter en CSV
            </button>
          )}
        </div>
      </Modal>
    </div>
  )
}
