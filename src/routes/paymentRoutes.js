const express = require('express');
const router = express.Router();
const { submitProof } = require('../controllers/paymentController');

router.post('/submit-proof/:memberId', submitProof);

module.exports = router;
