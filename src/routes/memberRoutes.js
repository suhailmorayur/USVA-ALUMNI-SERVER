const express = require('express');
const router = express.Router();
const { 
  checkStatus, 
  uploadPhoto, 
  getCardDetails, 
  createMemberProfile, 
  searchCard, 
  getPublicMemberProfile,
  downloadPortraitCard
} = require('../controllers/memberController');

router.get('/status-check', checkStatus);
router.post('/upload-photo', uploadPhoto);
router.get('/card-details', getCardDetails);
router.get('/search-card', searchCard);
router.get('/:id/download-portrait', downloadPortraitCard);
router.get('/:id', getPublicMemberProfile);
router.post('/', createMemberProfile);

module.exports = router;
