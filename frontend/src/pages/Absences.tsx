import { useEffect, useState } from 'react'
import api from '../services/api'
import { Absence } from '../types'
import { Plus } from 'lucide-react'
import { format } from 'date-fns'

export default function Absences() {
  const [absences, setAbsences] = useState<Absence[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAbsences()
  }, [])

  const loadAbsences = async () => {
    try {
      const response = await api.get('/absences')
      setAbsences(response.data)
    } catch (error) {
      console.error('Erreur lors du chargement des absences', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Absences</h1>
        <button className="btn btn-primary flex items-center">
          <Plus className="h-5 w-5 mr-2" />
          Nouvelle absence
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card">
          <p className="text-sm text-gray-600">Total</p>
          <p className="text-2xl font-bold">{absences.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Justifiées</p>
          <p className="text-2xl font-bold text-green-600">
            {absences.filter((a) => a.justifiee).length}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Non justifiées</p>
          <p className="text-2xl font-bold text-red-600">
            {absences.filter((a) => !a.justifiee).length}
          </p>
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">Date</th>
                <th className="table-header">Élève</th>
                <th className="table-header">Classe</th>
                <th className="table-header">Période</th>
                <th className="table-header">Statut</th>
                <th className="table-header">Motif</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {absences.map((absence) => (
                <tr key={absence._id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium">
                    {format(new Date(absence.date), 'dd/MM/yyyy')}
                  </td>
                  <td className="table-cell">
                    {absence.eleve.prenom} {absence.eleve.nom}
                  </td>
                  <td className="table-cell">{absence.classe.nom}</td>
                  <td className="table-cell">{absence.periode}</td>
                  <td className="table-cell">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        absence.justifiee
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {absence.justifiee ? 'Justifiée' : 'Non justifiée'}
                    </span>
                  </td>
                  <td className="table-cell">{absence.motif || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
