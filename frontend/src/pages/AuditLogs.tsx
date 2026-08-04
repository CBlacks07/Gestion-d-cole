import { useEffect, useState, useCallback } from 'react'
import api from '../services/api'
import { useToast } from '../contexts/ToastContext'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Shield, ChevronLeft, ChevronRight, Filter, RefreshCw } from 'lucide-react'

interface AuditLog {
  id: number
  action: string
  entity: string | null
  entity_id: string | null
  status: string
  details: Record<string, any> | null
  ip_address: string | null
  created_at: string
  nom: string | null
  prenom: string | null
  email: string | null
  role: string | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

const STATUS_COLORS: Record<string, string> = {
  SUCCESS: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  WARNING: 'bg-amber-100 text-amber-800',
}

const ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: 'Connexion réussie',
  LOGIN_FAILED: 'Connexion échouée',
  LOGIN_BLOCKED: 'Connexion bloquée',
  USER_REGISTER: 'Création utilisateur',
  USER_UPDATED: 'Modification utilisateur',
  USER_DELETED: 'Suppression utilisateur',
  PASSWORD_CHANGED: 'Changement MDP',
  PASSWORD_CHANGE_FAILED: 'Échec changement MDP',
}

export default function AuditLogs() {
  const { error: toastError } = useToast()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, pages: 0 })
  const [loading, setLoading] = useState(true)
  const [actions, setActions] = useState<string[]>([])

  const [filters, setFilters] = useState({ action: '', dateFrom: '', dateTo: '' })
  const [page, setPage] = useState(1)

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { page: String(page), limit: '50' }
      if (filters.action) params.action = filters.action
      if (filters.dateFrom) params.dateFrom = filters.dateFrom
      if (filters.dateTo) params.dateTo = filters.dateTo

      const res = await api.get('/audit-logs', { params })
      setLogs(res.data.data)
      setPagination(res.data.pagination)
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Erreur lors du chargement des logs')
    } finally {
      setLoading(false)
    }
  }, [page, filters, toastError])

  useEffect(() => {
    api.get('/audit-logs/actions').then(res => setActions(res.data)).catch(() => {})
  }, [])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    loadLogs()
  }

  const resetFilters = () => {
    setFilters({ action: '', dateFrom: '', dateTo: '' })
    setPage(1)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary-600" />
            Journal d'audit
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Historique des actions sensibles — {pagination.total} entrées au total
          </p>
        </div>
        <button onClick={loadLogs} className="btn btn-secondary flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Rafraîchir
        </button>
      </div>

      {/* Filtres */}
      <form onSubmit={handleFilter} className="card-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 shrink-0">
            <Filter className="h-4 w-4" />
            Filtres
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Action</label>
            <select
              className="input input-sm"
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
            >
              <option value="">Toutes</option>
              {actions.map((a) => (
                <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Du</label>
            <input
              type="date"
              className="input input-sm"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Au</label>
            <input
              type="date"
              className="input input-sm"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-sm">Filtrer</button>
          <button type="button" onClick={resetFilters} className="btn btn-secondary btn-sm">Réinitialiser</button>
        </div>
      </form>

      {/* Table */}
      <div className="card-flush">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Date / Heure</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Action</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Statut</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Utilisateur</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">IP</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">Chargement...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">Aucun log trouvé.</td>
                </tr>
              ) : logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: fr })}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLORS[log.status] || 'bg-gray-100 text-gray-700'}`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {log.email ? (
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{log.prenom} {log.nom}</p>
                        <p className="text-xs text-gray-500">{log.email}</p>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                    {log.ip_address || '—'}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    {log.details ? (
                      <details className="cursor-pointer">
                        <summary className="text-xs text-primary-600 hover:underline">Voir</summary>
                        <pre className="mt-1 text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-2 rounded overflow-auto max-h-32">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 px-4 py-3">
            <p className="text-sm text-gray-500">
              Page {pagination.page} sur {pagination.pages} ({pagination.total} entrées)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn btn-secondary btn-xs disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                className="btn btn-secondary btn-xs disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
