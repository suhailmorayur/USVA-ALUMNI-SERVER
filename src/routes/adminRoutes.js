const express = require('express');
const router = express.Router();
const {
  loginAdmin,
  getDashboardStats,
  getMembers,
  getMemberById,
  updateMember,
  approveMember,
  rejectMember,
  regenerateCard,
  resendEmail,
  exportCSV,
  bulkGeneratePDFs,
  updateSettings,
  downloadLandscapeCard,
  deleteMember
} = require('../controllers/adminController');
const { protectAdmin } = require('../middleware/authMiddleware');

router.post('/login', loginAdmin);
router.get('/dashboard', protectAdmin, getDashboardStats);
router.get('/members', protectAdmin, getMembers);
router.get('/members/:id', protectAdmin, getMemberById);
router.put('/members/:id', protectAdmin, updateMember);
router.post('/members/:id/approve', protectAdmin, approveMember);
router.post('/members/:id/reject', protectAdmin, rejectMember);
router.post('/members/:id/generate-card', protectAdmin, regenerateCard);
router.post('/members/:id/resend-email', protectAdmin, resendEmail);
router.get('/members/:id/download-landscape', protectAdmin, downloadLandscapeCard);
router.delete('/members/:id', protectAdmin, deleteMember);
router.get('/export', protectAdmin, exportCSV);
router.post('/bulk-generate', protectAdmin, bulkGeneratePDFs);
router.put('/settings', protectAdmin, updateSettings);

module.exports = router;
