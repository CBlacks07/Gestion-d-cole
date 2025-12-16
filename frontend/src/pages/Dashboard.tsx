import { useEffect, useState } from 'react'
import api from '../services/api'
import { Users, School, DollarSign, TrendingUp } from 'lucide-react'

interface DashboardStats {
  totalEleves: number
  totalClasses: number
  elevesParCycle: Array<{ _id: string; count: number }>
  recettesTotal: number
  devise: string
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const response = await api.get('/rapports/dashboard')
      setStats(response.data)
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>
  }

  const statsCards = [
    {
      name: 'Élèves actifs',
      value: stats?.totalEleves || 0,
      icon: Users,
      color: 'bg-blue-500',
    },
    {
      name: 'Classes',
      value: stats?.totalClasses || 0,
      icon: School,
      color: 'bg-green-500',
    },
    {
      name: 'Recettes totales',
      value: `${stats?.recettesTotal.toLocaleString() || 0} ${stats?.devise}`,
      icon: DollarSign,
      color: 'bg-yellow-500',
    },
  ]

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Tableau de bord</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {statsCards.map((stat) => (
          <div key={stat.name} className="card">
            <div className="flex items-center">
              <div className={`p-3 rounded-full ${stat.color} text-white mr-4`}>
                <stat.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-gray-600">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Élèves par cycle */}
      <div className="card mb-8">
        <h2 className="text-xl font-bold mb-4">Répartition des élèves par cycle</h2>
        <div className="space-y-4">
          {stats?.elevesParCycle.map((cycle) => (
            <div key={cycle._id}>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">{cycle._id}</span>
                <span className="text-sm font-medium">{cycle.count} élèves</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full"
                  style={{
                    width: `${(cycle.count / (stats?.totalEleves || 1)) * 100}%`,
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bienvenue */}
      <div className="card bg-gradient-to-r from-primary-500 to-primary-700 text-white">
        <h2 className="text-2xl font-bold mb-2">Bienvenue sur le système de gestion</h2>
        <p className="text-primary-100">
          Application de gestion d'établissement scolaire adaptée au système éducatif togolais.
          Gérez efficacement vos élèves, enseignants, classes, notes, absences et paiements.
        </p>
      </div>
    </div>
  )
}
