const router = require('express').Router();
const { editorOrAdmin, adminOnly } = require('../middleware/admin');
const admin = require('../controllers/adminController');

router.use(editorOrAdmin);
router.get('/', admin.index);
router.get('/:resource', admin.getResource, admin.list);
router.get('/:resource/new', admin.getResource, admin.newForm);
router.post('/:resource', admin.getResource, admin.save);
router.get('/:resource/:id/edit', admin.getResource, admin.editForm);
router.put('/:resource/:id', admin.getResource, admin.save);
router.post('/:resource/:id', admin.getResource, admin.save);
router.delete('/:resource/:id', adminOnly, admin.getResource, admin.remove);
router.post('/:resource/:id/delete', adminOnly, admin.getResource, admin.remove);

module.exports = router;
