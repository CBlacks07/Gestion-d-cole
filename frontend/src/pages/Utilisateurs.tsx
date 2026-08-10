import { useEffect, useState } from 'react'
import api from '../services/api'
import { useToast } from '../contexts/ToastContext'
import { useAuthStore } from '../store/authStore'
import { format } from 'date-fns'
import { Plus, Edit2, Trash2, ShieldCheck, UserCheck, UserX } from 'lucide-react'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'

// Doit rester synchronisé avec role_enum côté backend (voir schema.sql) —
// "COMPTABLE" a été retiré : il n'a jamais existé dans l'enum Postgres,
// choisir ce rôle faisait échouer la création d'utilisateur (500).
const ROLES = ['ADMIN', 'DIRECTEUR', 'ENSEIGNANT', 'SECRETAIRE'] as const
type Role = typeof ROLES[number]

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-800',
  DIRECTEUR: 'bg-purple-100 text-purple-800',
  ENSEIGNANT: 'bg-blue-100 text-blue-800',
  SECRETAIRE: 'bg-green-100 text-green-800',
}

interface UserData {
  id: string
  nom: string
  prenom: string
  email: string
  role: Role
  telephone?: string
  actif: boolean
  created_at: string
  enseignant_id?: string | null
}

interface EnseignantOption {
  id: string
  nom: string
  prenom: string
  matricule: string
  email: string
  telephone: string
}

interface UserForm {
  nom: string
  prenom: string
  email: string
  telephone: string
  role: Role
  motDePasse: string
  enseignantId: string
}

const emptyForm: UserForm = {
  nom: '', prenom: '', email: '', telephone: '', role: 'SECRETAIRE', motDePasse: '', enseignantId: ''
}

export default function Utilisateurs() {
  const { success, error: toastError } = useToast()
  const { user: currentUser } = useAuthStore()
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState<'TOUS' | Role>('TOUS')
  const [enseignants, setEnseignants] = useState<EnseignantOption[]>([])

  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<UserData | null>(null)
  const [form, setForm] = useState<UserForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: '', nom: '' })

  useEffect(() => {
    loadUsers()
    api.get('/enseignants', { params: { limit: 500 } }).then(res => {
      const raw = Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
      setEnseignants(raw.map((e: any) => ({ id: e.id, nom: e.nom, prenom: e.prenom, matricule: e.matricule, email: e.email || '', telephone: e.telephone || '' })))
    }).catch(() => {})
  }, [])

  const loadUsers = async () => {
    try {
      const res = await api.get('/users')
      setUsers(res.data)
    } catch (error: any) {
      toastError(error.response?.data?.message || 'Erreur lors du chargement des utilisateurs')
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditingUser(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEdit = (u: UserData) => {
    setEditingUser(u)
    setForm({ nom: u.nom, prenom: u.prenom, email: u.email, telephone: u.telephone || '', role: u.role, motDePasse: '', enseignantId: u.enseignant_id || '' })
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editingUser) {
        const payload: any = { nom: form.nom, prenom: form.prenom, telephone: form.telephone, role: form.role, enseignantId: form.enseignantId || null }
        if (form.motDePasse) payload.motDePasse = form.motDePasse
        await api.put(`/users/${editingUser.id}`, payload)
        success('Utilisateur mis à jour avec succès')
      } else {
        if (!form.motDePasse) { toastError('Le mot de passe est requis'); setSaving(false); return }
        await api.post('/auth/register', { ...form, enseignantId: form.enseignantId || undefined })
        success('Utilisateur créé avec succès')
      }
      setShowModal(false)
      await loadUsers()
    } catch (error: any) {
      toastError(error.response?.data?.message || "Erreur lors de l'enregistrement")
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActif = async (u: UserData) => {
    try {
      await api.put(`/users/${u.id}`, { actif: !u.actif })
      success(u.actif ? 'Utilisateur désactivé' : 'Utilisateur activé')
      await loadUsers()
    } catch (error: any) {
      toastError(error.response?.data?.message || 'Erreur lors du changement de statut')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/users/${id}`)
      success('Utilisateur supprimé avec succès')
      setDeleteConfirm({ show: false, id: '', nom: '' })
      await loadUsers()
    } catch (error: any) {
      toastError(error.response?.data?.message || 'Erreur lors de la suppression')
    }
  }

  const filtered = roleFilter === 'TOUS' ? users : users.filter((u) => u.role === roleFilter)
  const isAdmin = currentUser?.role === 'ADMIN'

  if (loading) return <div className="py-12 text-center">Chargement...</div>

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-gray-900">Utilisateurs</h1>
          <p className="mt-1 text-sm text-gray-500">Gestion des comptes et des droits d'accès.</p>
        </div>
        <button onClick={openCreate} className="btn btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nouvel utilisateur
        </button>
      </div>

      {/* Stats + filtres */}
      <div className="card-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setRoleFilter('TOUS')}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
              roleFilter === 'TOUS' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Tous ({users.length})
          </button>
          {ROLES.map((role) => {
            const count = users.filter((u) => u.role === role).length
            if (count === 0) return null
            return (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                  roleFilter === role ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {role} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Table */}
      <div className="card-flush">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Utilisateur</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Email</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Rôle</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Profil lié</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Statut</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Créé le</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-xs shrink-0">
                        {u.prenom?.[0]}{u.nom?.[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{u.prenom} {u.nom}</p>
                        {u.telephone && <p className="text-xs text-gray-500">{u.telephone}</p>}
                      </div>
                      {u.id === currentUser?.id && (
                        <span className="rounded bg-primary-50 px-1.5 py-0.5 text-xs text-primary-700 font-medium">Vous</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-700'}`}>
                      <ShieldCheck className="h-3 w-3" />
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.role === 'ENSEIGNANT' && (
                      u.enseignant_id
                        ? (() => {
                            const ens = enseignants.find(e => e.id === u.enseignant_id)
                            return ens
                              ? <span className="text-xs text-emerald-700 font-medium">{ens.nom} {ens.prenom}</span>
                              : <span className="text-xs text-amber-600">ID lié</span>
                          })()
                        : <span className="text-xs text-red-500">Non lié</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      u.actif ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {u.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {u.created_at ? format(new Date(u.created_at), 'dd/MM/yyyy') : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(u)}
                        className="p-1.5 rounded text-gray-600 hover:bg-gray-100 transition-colors"
                        title="Modifier"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      {isAdmin && u.id !== currentUser?.id && (
                        <button
                          onClick={() => handleToggleActif(u)}
                          className={`p-1.5 rounded transition-colors ${
                            u.actif
                              ? 'text-orange-600 hover:bg-orange-50'
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                          title={u.actif ? 'Désactiver' : 'Activer'}
                        >
                          {u.actif ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        </button>
                      )}
                      {isAdmin && u.id !== currentUser?.id && (
                        <button
                          onClick={() => setDeleteConfirm({ show: true, id: u.id, nom: `${u.prenom} ${u.nom}` })}
                          className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    Aucun utilisateur trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal créer/modifier */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Rôle</label>
            <select className="input" value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Role, enseignantId: e.target.value !== 'ENSEIGNANT' ? '' : form.enseignantId })}
              disabled={!isAdmin}
            >
              {ROLES.map((r) => (
                <option key={r} value={r} disabled={r === 'ADMIN' && !isAdmin}>{r}</option>
              ))}
            </select>
            {!isAdmin && <p className="mt-1 text-xs text-gray-500">Seul un ADMIN peut changer les rôles.</p>}
          </div>

          {form.role === 'ENSEIGNANT' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Profil enseignant lié
              </label>
              <select className="input" value={form.enseignantId}
                onChange={(e) => {
                  const ensId = e.target.value
                  const ens = enseignants.find(en => en.id === ensId)
                  if (ens && !editingUser) {
                    setForm(prev => ({
                      ...prev,
                      enseignantId: ensId,
                      nom: ens.nom || prev.nom,
                      prenom: ens.prenom || prev.prenom,
                      email: ens.email || prev.email,
                      telephone: ens.telephone || prev.telephone,
                    }))
                  } else {
                    setForm(prev => ({ ...prev, enseignantId: ensId }))
                  }
                }}
              >
                <option value="">— Aucun profil lié —</option>
                {enseignants.map((ens) => (
                  <option key={ens.id} value={ens.id}>
                    {ens.nom} {ens.prenom} ({ens.matricule})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Sélectionner un profil pré-remplit les champs ci-dessous.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Prénom</label>
              <input className="input" value={form.prenom} required
                onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Nom</label>
              <input className="input" value={form.nom} required
                onChange={(e) => setForm({ ...form, nom: e.target.value })} />
            </div>
          </div>

          {!editingUser && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input type="email" className="input" value={form.email} required
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Téléphone</label>
            <input className="input" value={form.telephone}
              onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {editingUser ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe'}
            </label>
            <input type="password" className="input" value={form.motDePasse}
              required={!editingUser}
              onChange={(e) => setForm({ ...form, motDePasse: e.target.value })}
              placeholder={editingUser ? '••••••••' : ''} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Enregistrement...' : editingUser ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation suppression */}
      <ConfirmDialog
        isOpen={deleteConfirm.show}
        title="Supprimer l'utilisateur"
        message={`Êtes-vous sûr de vouloir supprimer "${deleteConfirm.nom}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        onConfirm={() => handleDelete(deleteConfirm.id)}
        onCancel={() => setDeleteConfirm({ show: false, id: '', nom: '' })}
        variant="danger"
      />
    </div>
  )
}
