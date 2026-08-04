export interface Eleve {
  id: string
  matricule: string
  nom: string
  prenom: string
  dateNaissance: string
  lieuNaissance: string
  sexe: 'M' | 'F'
  classe?: Classe
  photo?: string
  tuteur: {
    nom: string
    prenom: string
    telephone: string
    email: string
    profession: string
    adresse: string
  }
  groupeSanguin?: string
  allergies?: string[]
  maladiesChroniques?: string[]
  statut: 'actif' | 'inactif' | 'transfere' | 'diplome'
  anneeScolaire: string
  dateInscription: string
}

export interface Enseignant {
  id: string
  matricule: string
  nom: string
  prenom: string
  dateNaissance: string
  sexe: 'M' | 'F'
  telephone: string
  email?: string
  adresse?: string
  photo?: string
  diplomes: Array<{
    intitule: string
    etablissement: string
    anneeObtention: number
  }>
  specialites: Matiere[]
  classesAssignees: Classe[]
  dateRecrutement: string
  statut: 'actif' | 'conge' | 'suspendu' | 'demissionne'
  typeContrat: 'permanent' | 'vacataire' | 'contractuel'
  salaire?: number
}

export interface Classe {
  id: string
  nom: string
  niveau: string
  cycle: 'Primaire' | 'Collège' | 'Lycée'
  section?: string
  anneeScolaire: string
  enseignantPrincipal?: Enseignant
  effectifMax: number
  effectifActuel?: number
  salle?: string
  fraisScolarite: {
    montantInscription: number
    montantMensuel: number
    devise: string
  }
}

export interface Matiere {
  id: string
  nom: string
  code: string
  description?: string
  coefficient: number
  niveaux: string[]
  cycles: string[]
  couleur: string
}

export interface Note {
  id: string
  eleve: Eleve
  matiere: Matiere
  classe: Classe
  enseignant?: Enseignant
  typeEvaluation: 'Devoir' | 'Composition' | 'Interrogation' | 'TP' | 'Examen'
  periode: '1er Trimestre' | '2eme Trimestre' | '3eme Trimestre' | '1er Semestre' | '2eme Semestre'
  anneeScolaire: string
  note: number
  noteMax: number
  coefficient: number
  commentaire?: string
  dateEvaluation: string
}

export interface Absence {
  id: string
  eleve: Eleve
  classe: Classe
  date: string
  matiere?: Matiere
  periode: 'Matin' | 'Après-midi' | 'Toute la journée'
  justifiee: boolean
  motif?: string
  justificatif?: string
  anneeScolaire: string
}

export interface Paiement {
  id: string
  eleve: Eleve
  typePaiement: 'Inscription' | 'Scolarité' | 'Cantine' | 'Transport' | 'Uniforme' | 'Autres'
  montant: number
  devise: string
  datePaiement: string
  moisConcerne?: string
  anneeScolaire: string
  modePaiement: 'Espèces' | 'Chèque' | 'Virement' | 'Mobile Money'
  numeroPiece?: string
  statut: 'Validé' | 'En attente' | 'Annulé'
  remarques?: string
}
