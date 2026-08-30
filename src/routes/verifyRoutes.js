const express = require('express');
const router = express.Router();
const Member = require('../models/Member');
const Settings = require('../models/Settings');

/**
 * Public Verification route
 * GET /api/verify/:membershipId
 */
router.get('/:membershipId', async (req, res) => {
  const { membershipId } = req.params;

  try {
    const member = await Member.findOne({ membershipId: membershipId.trim().toUpperCase() });
    
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Membership Not Found'
      });
    }

    // Membership is only verified if the application is approved, card generated, or email sent
    const isApproved = ['approved', 'card_generated', 'email_sent'].includes(member.applicationStatus);
    
    if (!isApproved) {
      return res.status(400).json({
        success: false,
        message: 'Membership Inactive'
      });
    }

    const settings = await Settings.findOne();
    const validity = settings ? settings.membershipValidity : 'Mar 2028';

    // Parse Sanad display name
    let sanadText = '';
    if (member.sand && member.sand.length > 0) {
      if (member.sand.includes('umari') && member.sand.includes('faizy')) {
        sanadText = 'Umari Faizy';
      } else if (member.sand.includes('umari')) {
        sanadText = 'Umari';
      } else if (member.sand.includes('faizy')) {
        sanadText = 'Faizy';
      }
    }

    res.json({
      success: true,
      message: 'Membership Verified ✓',
      data: {
        fullName: member.fullName,
        sand: sanadText,
        membershipId: member.membershipId,
        status: 'Active',
        validity: validity
      }
    });

  } catch (error) {
    console.error('Public verification API error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during public verification lookup'
    });
  }
});

module.exports = router;
