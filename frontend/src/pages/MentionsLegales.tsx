import { Link } from 'react-router-dom'
import { School, ArrowLeft } from 'lucide-react'
import { useAppSettings } from '../contexts/AppSettingsContext'

export default function MentionsLegales() {
  const { settings } = useAppSettings()
  const appName = settings.appName || 'SchoolTogo'
  const logoUrl = settings.logoUrl || ''

  return (
    <div className="min-h-screen bg-cream-100">
      <header className="border-b border-cream-300 bg-white">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link to="/login" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-forest-900 flex items-center justify-center overflow-hidden shrink-0">
              {logoUrl
                ? <img src={logoUrl} alt="Logo" className="h-full w-full object-contain p-1" />
                : <School className="h-4 w-4 text-primary-400" />
              }
            </div>
            <span className="font-display font-bold text-gray-900">{appName}</span>
          </Link>
          <Link to="/login" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-4 w-4" /> Retour
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-10">
        <h1 className="text-2xl font-display font-bold text-gray-900 mb-1">Mentions légales</h1>
        <p className="text-sm text-gray-400 mb-8">Dernière mise à jour : 20 août 2026</p>

        <div className="space-y-8 text-sm text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-base font-display font-semibold text-gray-900 mb-2">1. Éditeur</h2>
            <p>
              {appName} est édité par <strong>OPS CORPORATION</strong>.
            </p>
            <ul className="mt-2 space-y-1 list-none">
              <li>Directeur général : MAATHEY K. Caringthon</li>
              <li>Siège social : [Adresse du siège social à compléter]</li>
              <li>Numéro RCCM / immatriculation : [À compléter]</li>
              <li>Téléphone : +228 93 91 46 94</li>
              <li>Email : cmaathey@gmail.com</li>
            </ul>
            <p className="mt-2 text-xs text-gray-400">
              Les informations d'immatriculation ci-dessus sont à compléter par OPS CORPORATION
              avant toute mise en production destinée au public.
            </p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold text-gray-900 mb-2">2. Hébergement</h2>
            <p>
              L'application (interface web et serveur) est hébergée par <strong>Vercel Inc.</strong>
              {' '}(340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis — vercel.com).
              La base de données est hébergée par <strong>Neon Inc.</strong> (neon.tech), un
              service de base de données PostgreSQL. Ces prestataires peuvent héberger les
              données sur des infrastructures situées hors du Togo — voir la section
              « Transferts de données » de la{' '}
              <Link to="/confidentialite" className="text-primary-600 font-medium">politique de confidentialité</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold text-gray-900 mb-2">3. Objet du service</h2>
            <p>
              {appName} est une plateforme de gestion scolaire (élèves, enseignants, classes,
              notes, absences, paiements, bulletins) destinée aux établissements scolaires au
              Togo. Chaque établissement dispose d'un espace indépendant et isolé — voir la
              politique de confidentialité pour le détail des mesures de séparation des données.
            </p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold text-gray-900 mb-2">4. Propriété intellectuelle</h2>
            <p>
              La structure générale, les textes, graphismes, logos et éléments visuels de{' '}
              {appName} sont la propriété d'OPS CORPORATION ou de ses concédants, sauf mention
              contraire. Toute reproduction, représentation ou exploitation, totale ou
              partielle, sans autorisation préalable est interdite.
            </p>
            <p className="mt-2">
              Les données saisies par un établissement (élèves, notes, paiements, etc.)
              demeurent la propriété exclusive de cet établissement. OPS CORPORATION n'en
              revendique aucun droit de propriété et ne les utilise que pour fournir le
              service, conformément à la politique de confidentialité.
            </p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold text-gray-900 mb-2">5. Responsabilité</h2>
            <p>
              {appName} est fourni « en l'état ». OPS CORPORATION met en œuvre des moyens
              raisonnables pour assurer la disponibilité et la fiabilité du service, sans
              garantie d'absence d'interruption ou d'erreur. Chaque établissement est
              responsable de l'exactitude des données qu'il saisit et de l'usage qu'il fait
              de la plateforme, notamment de la bonne gestion des accès de son personnel.
            </p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold text-gray-900 mb-2">6. Contact</h2>
            <p>
              Pour toute question relative à ces mentions légales :{' '}
              <a href="mailto:cmaathey@gmail.com" className="text-primary-600 font-medium">cmaathey@gmail.com</a>
              {' '}ou +228 93 91 46 94.
            </p>
          </section>
        </div>

        <p className="text-center text-xs text-gray-400 mt-12">
          © {new Date().getFullYear()} {appName} — Développé par OPS CORPORATION
        </p>
      </main>
    </div>
  )
}
