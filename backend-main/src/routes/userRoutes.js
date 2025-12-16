const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { validateUUIDParam } = require('../middlewares/validationMiddleware');

// ==================== User Profile Routes ====================
router.put('/profile', protect, userController.updateProfile);
router.put('/change-password', protect, userController.changePassword);

// ==================== Admin User Management Routes ====================
router.get('/', protect, authorize('admin'), userController.getAllUsers);
router.get('/role/:role', protect, userController.getUsersByRole);
router.get('/:id', protect, validateUUIDParam('id'), userController.getUserById);
router.put('/:id', protect, authorize('admin'), validateUUIDParam('id'), userController.updateUser);
router.delete('/:id', protect, authorize('admin'), validateUUIDParam('id'), userController.deleteUser);

module.exports = router;