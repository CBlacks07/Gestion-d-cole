const express = require('express');
const router = express.Router();
const {
  getNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
  getBulletin
} = require('../controllers/note.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getNotes)
  .post(authorize('admin', 'directeur', 'enseignant'), createNote);

router.get('/bulletin/:eleveId', getBulletin);

router.route('/:id')
  .get(getNoteById)
  .put(authorize('admin', 'directeur', 'enseignant'), updateNote)
  .delete(authorize('admin', 'directeur'), deleteNote);

module.exports = router;
