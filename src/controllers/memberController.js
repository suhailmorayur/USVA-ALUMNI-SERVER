const Member = require('../models/Member');
const MembershipCard = require('../models/MembershipCard');
const { uploadImage } = require('../services/cloudinaryService');

/**
 * Fetch card metadata for the current student
 * GET /api/members/card-details
 */
const getCardDetails = async (req, res) => {
  try {
    const card = await MembershipCard.findOne({ memberId: req.user._id });
    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Membership card has not been generated yet. Admin review is pending.'
      });
    }

    res.json({
      success: true,
      data: card
    });
  } catch (error) {
    console.error('Fetch card details error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving card details'
    });
  }
};

/**
 * Public status tracking query
 * GET /api/members/status-check
 */
const checkStatus = async (req, res) => {
  const { admissionNumber } = req.query;

  try {
    if (!admissionNumber) {
      return res.status(400).json({
        success: false,
        message: 'Admission number is required'
      });
    }

    const member = await Member.findOne({ admissionNumber: admissionNumber.trim() });
    
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'No registration found for this admission number. Please register first.'
      });
    }

    const maskName = (name) => {
      return name
        .split(' ')
        .map((part) => {
          if (part.length <= 2) return part;
          return part.slice(0, 2) + '*'.repeat(part.length - 2);
        })
        .join(' ');
    };

    res.json({
      success: true,
      data: {
        fullName: maskName(member.fullName),
        applicationStatus: member.applicationStatus,
        paymentStatus: member.paymentStatus,
        createdAt: member.createdAt
      }
    });

  } catch (error) {
    console.error('Public status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving status details'
    });
  }
};

/**
 * Upload base64 cropped photo to Cloudinary
 * POST /api/members/upload-photo
 */
const uploadPhoto = async (req, res) => {
  const { photo } = req.body;

  try {
    if (!photo) {
      return res.status(400).json({
        success: false,
        message: 'No photo data provided'
      });
    }

    const result = await uploadImage(photo, 'usva_member_photos');

    res.json({
      success: true,
      data: {
        photoUrl: result.url,
        photoPublicId: result.publicId
      }
    });

  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload photo: ' + error.message
    });
  }
};

/**
 * Submit Member details before payment
 * POST /api/members
 */
const createMemberProfile = async (req, res) => {
  const { fullName, sand, place, admissionNumber, phone, email, photoUrl, photoPublicId } = req.body;

  try {
    if (!fullName || !place || !admissionNumber || !phone || !email || !photoUrl) {
      return res.status(400).json({
        success: false,
        message: 'Missing required profile fields'
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedAdNo = admissionNumber.trim();

    const existing = await Member.findOne({
      $or: [
        { email: trimmedEmail },
        { admissionNumber: trimmedAdNo }
      ]
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A profile with this email or admission number already exists'
      });
    }

    const newMember = await Member.create({
      fullName: fullName.trim(),
      sand: sand || [],
      place: place.trim(),
      admissionNumber: trimmedAdNo,
      phone: phone.trim(),
      email: trimmedEmail,
      photoUrl,
      photoPublicId,
      applicationStatus: 'payment_pending',
      paymentStatus: 'pending'
    });

    res.status(201).json({
      success: true,
      message: 'Member profile created. Redirecting to payment...',
      data: newMember
    });

  } catch (error) {
    console.error('Create member profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating member profile'
    });
  }
};

/**
 * Public search and download endpoint
 * GET /api/members/search-card
 */
const searchCard = async (req, res) => {
  const { email, admissionNumber } = req.query;

  try {
    if (!email && !admissionNumber) {
      return res.status(400).json({
        success: false,
        message: 'Please provide either an email address or an admission number.'
      });
    }

    const query = {};
    if (email) {
      query.email = email.trim().toLowerCase();
    } else if (admissionNumber) {
      query.admissionNumber = admissionNumber.trim();
    }

    const member = await Member.findOne(query);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'No registered member found with the provided details.'
      });
    }

    if (!['approved', 'card_generated', 'email_sent'].includes(member.applicationStatus)) {
      return res.status(400).json({
        success: false,
        message: `Your membership application status is currently: ${member.applicationStatus}. Please complete the payment or wait for processing.`
      });
    }

    const card = await MembershipCard.findOne({ memberId: member._id });
    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Membership card has not been generated yet. Please contact administration.'
      });
    }

    res.json({
      success: true,
      data: {
        member,
        card
      }
    });

  } catch (error) {
    console.error('Search card error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error searching for card'
    });
  }
};

/**
 * Retrieve public member profile by ID (e.g. for the payment page details verification)
 * GET /api/members/:id
 */
const getPublicMemberProfile = async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member profile not found'
      });
    }

    res.json({
      success: true,
      data: {
        member
      }
    });
  } catch (error) {
    console.error('Fetch public member profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving profile details'
    });
  }
};

module.exports = {
  getCardDetails,
  checkStatus,
  uploadPhoto,
  createMemberProfile,
  searchCard,
  getPublicMemberProfile
};
