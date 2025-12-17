import { useEffect, useState } from 'react'
import api from '../services/api'
import { Note } from '../types'
import { Plus, Search, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import NoteFormMultipleModal from '../components/NoteFormMultipleModal'

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => {
    loadNotes()
  }, [])

  const loadNotes = async () => {
    try {
      const response = await api.get('/notes')
      setNotes(response.data)
    } catch (error) {
      console.error('Erreur lors du chargement des notes', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, eleve: string, matiere: string) => {
    if (!confirm(`Voulez-vous vraiment supprimer cette note de ${matiere} pour ${eleve} ?`)) {
      return
    }
    try {
      await api.delete(`/notes/${id}`)
      await loadNotes()
    } catch (error) {
      alert('Erreur lors de la suppression de la note')
    }
  }

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Notes et Évaluations</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Nouvelle note
        </button>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">Élève</th>
                <th className="table-header">Matière</th>
                <th className="table-header">Type</th>
                <th className="table-header">Période</th>
                <th className="table-header">Note</th>
                <th className="table-header">Coefficient</th>
                <th className="table-header">Date</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {notes.map((note) => (
                <tr key={note.id} className="hover:bg-gray-50">
                  <td className="table-cell">
                    {note.eleve.prenom} {note.eleve.nom}
                  </td>
                  <td className="table-cell">{note.matiere.nom}</td>
                  <td className="table-cell">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {note.typeEvaluation}
                    </span>
                  </td>
                  <td className="table-cell">{note.periode}</td>
                  <td className="table-cell">
                    <span
                      className={`font-bold ${
                        note.note >= 10 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {note.note}/{note.noteMax}
                    </span>
                  </td>
                  <td className="table-cell">{note.coefficient}</td>
                  <td className="table-cell">
                    {format(new Date(note.dateEvaluation), 'dd/MM/yyyy')}
                  </td>
                  <td className="table-cell">
                    <button
                      onClick={() => handleDelete(note.id, `${note.eleve.prenom} ${note.eleve.nom}`, note.matiere.nom)}
                      className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal pour ajouter des notes */}
      <NoteFormMultipleModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={loadNotes}
      />
    </div>
  )
}
