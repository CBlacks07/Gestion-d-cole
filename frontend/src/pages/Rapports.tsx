import { useEffect, useState } from 'react'
import api from '../services/api'
import { FileText, Download } from 'lucide-react'

export default function Rapports() {
  const [dashboard, setDashboard] = useState<any>(null)
  const [loading, setLoading] = useState(true)

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

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>
  }

  const rapportTypes = [
    {
      name: 'Rapport financier',
      description: 'État des recettes et dépenses',
      icon: FileText,
      color: 'bg-green-500',
    },
    {
      name: 'Rapport d\'assiduité',
      description: 'Statistiques d\'absences par classe',
      icon: FileText,
      color: 'bg-blue-500',
    },
    {
      name: 'Rapport de notes',
      description: 'Résultats scolaires par période',
      icon: FileText,
      color: 'bg-purple-500',
    },
    {
      name: 'Rapport d\'effectifs',
      description: 'Répartition des élèves',
      icon: FileText,
      color: 'bg-orange-500',
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
                <button className="btn btn-primary flex items-center text-sm">
                  <Download className="h-4 w-4 mr-2" />
                  Générer le rapport
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
    </div>
  )
}
