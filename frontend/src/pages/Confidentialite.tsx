import { Link } from 'react-router-dom'
import { School, ArrowLeft } from 'lucide-react'
import { useAppSettings } from '../contexts/AppSettingsContext'

export default function Confidentialite() {
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
        <h1 className="text-2xl font-display font-bold text-gray-900 mb-1">Politique de confidentialité</h1>
        <p className="text-sm text-gray-400 mb-8">Dernière mise à jour : 20 août 2026</p>

        <div className="space-y-8 text-sm text-gray-700 leading-relaxed">
          <section>
            <p>
              Cette politique explique quelles données {appName} collecte, pourquoi, comment
              elles sont protégées et quels droits vous avez. Elle s'applique aux
              établissements scolaires (« l'établissement »), à leur personnel, ainsi qu'aux
              informations relatives aux élèves saisies par l'établissement.
            </p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold text-gray-900 mb-2">1. Responsable du traitement</h2>
            <p>
              <strong>OPS CORPORATION</strong>, éditeur de {appName}, est responsable du
              traitement pour les aspects techniques de la plateforme (hébergement,
              sécurité, sauvegardes). Pour les données des élèves, du personnel enseignant et
              des tuteurs qu'il saisit, <strong>chaque établissement scolaire est responsable
              du traitement</strong> vis-à-vis de sa propre communauté (élèves, parents,
              personnel) : c'est lui qui décide quelles données saisir et qui y a accès en son
              sein.
            </p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold text-gray-900 mb-2">2. Données collectées</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Comptes utilisateurs</strong> : nom, prénom, email, téléphone, rôle, mot de passe (haché, jamais stocké en clair).</li>
              <li><strong>Élèves</strong> : identité, date et lieu de naissance, sexe, classe, coordonnées du tuteur/parent, statut, matricule.</li>
              <li><strong>Scolarité</strong> : notes, évaluations, moyennes, absences, bulletins.</li>
              <li><strong>Finances</strong> : paiements de scolarité, montants, modes de paiement, statut de recouvrement.</li>
              <li><strong>Journal d'audit</strong> : action effectuée, utilisateur, horodatage, adresse IP — à des fins de sécurité et de traçabilité.</li>
              <li><strong>Cookie technique</strong> : un unique cookie (jeton de rafraîchissement de session), nécessaire au fonctionnement de la connexion, en aucun cas utilisé à des fins publicitaires ou de suivi.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold text-gray-900 mb-2">3. Finalités</h2>
            <p>Ces données sont utilisées exclusivement pour :</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>la gestion administrative et pédagogique de l'établissement (inscriptions, notes, bulletins, absences) ;</li>
              <li>le suivi des paiements de scolarité ;</li>
              <li>la sécurité du service (authentification, journal d'audit, détection d'usage anormal) ;</li>
              <li>l'envoi, si l'établissement l'active, d'une sauvegarde périodique de ses données par email à ses administrateurs.</li>
            </ul>
            <p className="mt-2">
              Aucune donnée n'est vendue, louée ou utilisée à des fins publicitaires.
            </p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold text-gray-900 mb-2">4. Base légale</h2>
            <p>
              Le traitement repose sur l'exécution du contrat liant l'établissement à
              {' '}{appName} (fourniture du service), et sur l'intérêt légitime de
              l'établissement à administrer sa scolarité et de OPS CORPORATION à assurer la
              sécurité et le bon fonctionnement de la plateforme.
            </p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold text-gray-900 mb-2">5. Isolation entre établissements</h2>
            <p>
              Chaque établissement dispose d'un espace strictement isolé : la base de données
              applique une séparation technique au niveau des lignes (Row-Level Security)
              garantissant qu'aucun établissement ne peut accéder, même par erreur applicative,
              aux données d'un autre établissement.
            </p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold text-gray-900 mb-2">6. Destinataires et sous-traitants</h2>
            <p>Les données sont accessibles :</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>au personnel autorisé de l'établissement, selon son rôle (administrateur, directeur, enseignant, secrétaire) ;</li>
              <li>à nos hébergeurs techniques, <strong>Vercel</strong> (application) et <strong>Neon</strong> (base de données), qui n'accèdent aux données que pour la fourniture de leur service d'infrastructure ;</li>
              <li>à <strong>Resend</strong>, service d'envoi d'email, uniquement si l'établissement active la sauvegarde automatique par email, et uniquement pour transmettre cette sauvegarde aux adresses configurées par l'établissement.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold text-gray-900 mb-2">7. Transferts de données</h2>
            <p>
              Nos hébergeurs (Vercel, Neon) opèrent une infrastructure internationale ; les
              données peuvent donc être stockées ou traitées sur des serveurs situés hors du
              Togo, y compris dans des pays dont le niveau de protection des données diffère.
              Nous sélectionnons des prestataires appliquant des standards de sécurité
              reconnus (chiffrement en transit et au repos, contrôle d'accès).
            </p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold text-gray-900 mb-2">8. Durée de conservation</h2>
            <p>
              Les données sont conservées pendant la durée d'utilisation du service par
              l'établissement. En cas de résiliation, l'établissement peut exporter
              l'intégralité de ses données avant fermeture de son espace (Configuration &gt;
              Sauvegarde). Les journaux d'audit sont conservés pour une durée limitée à des
              fins de sécurité, puis purgés automatiquement.
            </p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold text-gray-900 mb-2">9. Sécurité</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Mots de passe hachés (bcrypt), jamais stockés ni transmis en clair.</li>
              <li>Connexions chiffrées (HTTPS/TLS) de bout en bout.</li>
              <li>Authentification par jeton à durée de vie limitée (15 minutes), renouvelé via un jeton de rafraîchissement sécurisé (cookie httpOnly).</li>
              <li>Isolation stricte des données entre établissements (voir section 5).</li>
              <li>Verrouillage temporaire d'un compte après plusieurs tentatives de connexion échouées.</li>
              <li>Journal d'audit des actions sensibles.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold text-gray-900 mb-2">10. Vos droits</h2>
            <p>
              Toute personne dont les données sont traitées (personnel, tuteur, élève majeur)
              dispose d'un droit d'accès, de rectification, d'effacement et d'opposition sur
              ses données. Ces demandes doivent être adressées en premier lieu à
              l'établissement scolaire concerné, qui est le mieux placé pour les traiter
              rapidement (il peut lui-même consulter, corriger ou exporter les données depuis
              la plateforme). À défaut de réponse, vous pouvez contacter OPS CORPORATION à
              {' '}<a href="mailto:cmaathey@gmail.com" className="text-primary-600 font-medium">cmaathey@gmail.com</a>.
            </p>
            <p className="mt-2">
              Vous pouvez également saisir l'autorité togolaise compétente en matière de
              protection des données à caractère personnel (APDP).
            </p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold text-gray-900 mb-2">11. Modifications</h2>
            <p>
              Cette politique peut évoluer. La date de dernière mise à jour figure en haut de
              cette page. Les changements significatifs seront communiqués aux établissements
              utilisateurs.
            </p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold text-gray-900 mb-2">12. Contact</h2>
            <p>
              Pour toute question relative à cette politique :{' '}
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
