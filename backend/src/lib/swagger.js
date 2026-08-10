const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API SchoolTogo',
      version: '3.0.0',
      description: `
API REST complète pour la gestion d'établissements scolaires au Togo.
Supporte les cycles Primaire, Collège et Lycée.

**Authentification :** Bearer JWT (access token 15 min) + Refresh token httpOnly cookie (7 jours).

**Pagination :** Les endpoints liste acceptent \`?page=1&limit=50\`.
`,
      contact: {
        name: 'SchoolTogo',
      },
    },
    servers: [
      { url: '/api/v1', description: 'API v1' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Pagination: {
          type: 'object',
          properties: {
            total:      { type: 'integer', example: 120 },
            page:       { type: 'integer', example: 1 },
            limit:      { type: 'integer', example: 50 },
            totalPages: { type: 'integer', example: 3 },
            hasNext:    { type: 'boolean', example: true },
            hasPrev:    { type: 'boolean', example: false },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error:   { type: 'string', example: 'Message d\'erreur' },
          },
        },
        Eleve: {
          type: 'object',
          properties: {
            id:          { type: 'string', format: 'uuid' },
            matricule:   { type: 'string', example: 'EL2025001' },
            nom:         { type: 'string', example: 'Kofi' },
            prenom:      { type: 'string', example: 'Ama' },
            sexe:        { type: 'string', enum: ['M', 'F'] },
            statut:      { type: 'string', enum: ['ACTIF', 'INACTIF', 'DIPLOME', 'TRANSFERE'] },
            annee_scolaire: { type: 'string', example: '2025-2026' },
            classe:      { $ref: '#/components/schemas/ClasseRef' },
          },
        },
        ClasseRef: {
          type: 'object',
          properties: {
            id:     { type: 'string', format: 'uuid' },
            nom:    { type: 'string', example: 'CM2 A' },
            niveau: { type: 'string', example: 'CM2' },
            cycle:  { type: 'string', enum: ['PRIMAIRE', 'COLLEGE', 'LYCEE'] },
          },
        },
        Enseignant: {
          type: 'object',
          properties: {
            id:        { type: 'string', format: 'uuid' },
            matricule: { type: 'string', example: 'EN2025001' },
            nom:       { type: 'string' },
            prenom:    { type: 'string' },
            statut:    { type: 'string', enum: ['ACTIF', 'INACTIF', 'CONGE', 'RETRAITE'] },
          },
        },
        Paiement: {
          type: 'object',
          properties: {
            id:            { type: 'string', format: 'uuid' },
            type_paiement: { type: 'string', enum: ['INSCRIPTION', 'SCOLARITE', 'CANTINE', 'TRANSPORT', 'UNIFORME', 'AUTRES'] },
            montant:       { type: 'number', example: 15000 },
            devise:        { type: 'string', example: 'XOF' },
            date_paiement: { type: 'string', format: 'date' },
            statut:        { type: 'string', enum: ['PAYE', 'EN_ATTENTE', 'ANNULE'] },
          },
        },
        AuthLogin: {
          type: 'object',
          required: ['email', 'motDePasse'],
          properties: {
            email:      { type: 'string', format: 'email' },
            motDePasse: { type: 'string', minLength: 8 },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            id:     { type: 'string', format: 'uuid' },
            nom:    { type: 'string' },
            prenom: { type: 'string' },
            email:  { type: 'string' },
            role:   { type: 'string', enum: ['ADMIN', 'DIRECTEUR', 'ENSEIGNANT', 'SECRETAIRE'] },
            token:  { type: 'string', description: 'Access token JWT (15 min)' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth',        description: 'Authentification & sessions' },
      { name: 'Élèves',      description: 'Gestion des élèves' },
      { name: 'Enseignants', description: 'Gestion des enseignants' },
      { name: 'Classes',     description: 'Gestion des classes' },
      { name: 'Notes',       description: 'Saisie et consultation des notes' },
      { name: 'Absences',    description: 'Gestion des absences' },
      { name: 'Paiements',   description: 'Gestion des paiements' },
      { name: 'Rapports',    description: 'Rapports et statistiques' },
      { name: 'Utilisateurs',description: 'Gestion des comptes utilisateurs' },
      { name: 'Audit',       description: 'Journal d\'audit' },
      { name: 'Système',     description: 'Santé, backup, configuration' },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
