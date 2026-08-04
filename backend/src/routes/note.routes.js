const express = require('express');
const router = express.Router();
const {
  getNotes,
  getNoteById,
  createNote,
  createNotesBatch,
  updateNote,
  deleteNote,
  getBulletin
} = require('../controllers/note.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getNotes)
  .post(authorize('admin', 'directeur', 'enseignant'), createNote);

router.post('/batch', authorize('admin', 'directeur', 'enseignant'), createNotesBatch);

router.get('/bulletin/:eleveId', authorize('admin', 'directeur', 'secretaire'), getBulletin);

router.route('/:id')
  .get(getNoteById)
  .put(authorize('admin', 'directeur', 'enseignant'), updateNote)
  .delete(authorize('admin', 'directeur', 'enseignant'), deleteNote);

module.exports = router;
