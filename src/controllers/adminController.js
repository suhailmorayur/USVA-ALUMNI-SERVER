const Admin = require('../models/Admin');
const Member = require('../models/Member');
const Payment = require('../models/Payment');
const MembershipCard = require('../models/MembershipCard');
const Settings = require('../models/Settings');
const EmailLog = require('../models/EmailLog');
const AuditLog = require('../models/AuditLog');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pdfService = require('../services/pdfService');
const emailService = require('../services/emailService');
const cloudinaryService = require('../services/cloudinaryService');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

/**
 * Admin Login
 * POST /api/admin/login
 */
const loginAdmin = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase().trim() });
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid administrative credentials' });
    }

    const isMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid administrative credentials' });
    }

    res.json({
      success: true,
      message: 'Admin authentication successful',
      data: {
        token: generateToken(admin._id),
        admin: {
          _id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role
        }
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success: false, message: 'Server error during admin login' });
  }
};

/**
 * Admin Dashboard Stats
 * GET /api/admin/dashboard
 */
const getDashboardStats = async (req, res) => {
  try {
    const totalApplications = await Member.countDocuments();
    const paidApplications = await Member.countDocuments({ paymentStatus: 'paid' });
    const pendingReview = await Member.countDocuments({ applicationStatus: 'under_review' });
    const approvedMembers = await Member.countDocuments({ applicationStatus: { $in: ['approved', 'card_generated', 'email_sent'] } });
    const rejectedApplications = await Member.countDocuments({ applicationStatus: 'rejected' });
    
    const cardsGenerated = await MembershipCard.countDocuments();
    const emailsSent = await EmailLog.countDocuments({ status: 'sent' });

    res.json({
      success: true,
      data: {
        totalApplications,
        paidApplications,
        pendingReview,
        approvedMembers,
        rejectedApplications,
        cardsGenerated,
        emailsSent
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ success: false, message: 'Server error gathering stats' });
  }
};

/**
 * Get paginated, searched, and filtered members list
 * GET /api/admin/members
 */
const getMembers = async (req, res) => {
  const { page = 1, limit = 20, search = '', sanad = '', place = '', appStatus = '', payStatus = '' } = req.query;

  try {
    const query = {};

    // Search query mapping
    if (search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { fullName: searchRegex },
        { admissionNumber: searchRegex },
        { membershipId: searchRegex },
        { phone: searchRegex },
        { email: searchRegex }
      ];
    }

    // Filter mapping
    if (sanad) {
      if (sanad === 'none') {
        query.sand = { $size: 0 };
      } else {
        query.sand = sanad; // matches if the array contains this value
      }
    }
    if (place) {
      query.place = new RegExp(place.trim(), 'i');
    }
    if (appStatus) {
      query.applicationStatus = appStatus;
    }
    if (payStatus) {
      query.paymentStatus = payStatus;
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 }
    };

    const skipIndex = (options.page - 1) * options.limit;

    const total = await Member.countDocuments(query);
    const members = await Member.find(query)
      .sort(options.sort)
      .skip(skipIndex)
      .limit(options.limit);

    // Retrieve card URLs for the current page of members
    const memberIds = members.map(m => m._id);
    const cards = await MembershipCard.find({ memberId: { $in: memberIds } });

    const membersWithCards = members.map(member => {
      const card = cards.find(c => c.memberId.toString() === member._id.toString());
      return {
        ...member.toObject(),
        pdfUrl: card ? card.pdfUrl : null,
        landscapePdfUrl: card ? card.landscapePdfUrl : null
      };
    });

    res.json({
      success: true,
      data: {
        members: membersWithCards,
        total,
        page: options.page,
        pages: Math.ceil(total / options.limit)
      }
    });

  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving members list' });
  }
};

/**
 * Get individual member details
 * GET /api/admin/members/:id
 */
const getMemberById = async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    // Fetch related payment transaction
    const payment = await Payment.findOne({ memberId: member._id }).sort({ createdAt: -1 });
    // Fetch related membership card metadata
    const card = await MembershipCard.findOne({ memberId: member._id });
    // Fetch email log history
    const emailLogs = await EmailLog.find({ memberId: member._id }).sort({ sentAt: -1 });

    res.json({
      success: true,
      data: {
        member,
        payment,
        card,
        emailLogs
      }
    });

  } catch (error) {
    console.error('Get member details error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching member details' });
  }
};

/**
 * Edit member details from admin dashboard
 * PUT /api/admin/members/:id
 */
const updateMember = async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const updates = req.body;
    const allowedUpdates = ['fullName', 'sand', 'place', 'admissionNumber', 'phone', 'email'];

    allowedUpdates.forEach((key) => {
      if (updates[key] !== undefined) {
        member[key] = updates[key];
      }
    });

    await member.save();

    await AuditLog.create({
      adminId: req.admin._id,
      action: 'update_member_details',
      memberId: member._id,
      metadata: { updates }
    });

    res.json({
      success: true,
      message: 'Member details updated successfully',
      data: member
    });

  } catch (error) {
    console.error('Admin update member error:', error);
    res.status(500).json({ success: false, message: 'Server error updating member details' });
  }
};

/**
 * Approve member and automatically trigger QR & PDF generation & email sending
 * POST /api/admin/members/:id/approve
 */
const approveMember = async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    if (member.applicationStatus === 'approved' || member.membershipId) {
      return res.status(400).json({ success: false, message: 'Member is already approved' });
    }

    const settings = await Settings.findOne();
    const validity = settings ? settings.membershipValidity : 'Mar 2028';

    // 1. Safe Sequence / Counter Mechanism for unique Membership ID
    // Format: ALUMNI-YYYY-00001
    const currentYear = new Date().getFullYear();
    const prefix = `ALUMNI-${currentYear}-`;
    
    // Sort in descending order to get the highest sequence number in the database
    const latestMember = await Member.findOne({
      membershipId: { $regex: '^' + prefix }
    }).sort({ membershipId: -1 });

    let nextSeq = 1;
    if (latestMember && latestMember.membershipId) {
      const parts = latestMember.membershipId.split('-');
      const lastSeq = parseInt(parts[2], 10);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }

    const membershipId = `${prefix}${String(nextSeq).padStart(5, '0')}`;

    member.membershipId = membershipId;
    member.applicationStatus = 'approved';
    await member.save();

    // 2. Generate PDF and upload to Cloudinary (both Portrait and Landscape layouts)
    console.log(`Generating Portrait card PDF for member ID: ${membershipId}...`);
    const pdfBuffer = await pdfService.generateMemberPDF(member, validity, 'portrait');
    
    console.log(`Generating Landscape card PDF for member ID: ${membershipId}...`);
    const landscapePdfBuffer = await pdfService.generateMemberPDF(member, validity, 'landscape');
    
    // Upload PDF files to Cloudinary
    console.log('Uploading PDFs to Cloudinary...');
    const cloudinaryResponse = await cloudinaryService.uploadBuffer(
      pdfBuffer,
      'usva_pdfs',
      `USVA_Membership_${membershipId}.pdf`,
      'raw'
    );
    const cloudinaryLandscapeResponse = await cloudinaryService.uploadBuffer(
      landscapePdfBuffer,
      'usva_pdfs',
      `USVA_Membership_Landscape_${membershipId}.pdf`,
      'raw'
    );

    // Save/Update Card document
    const frontendUrl = process.env.FRONTEND_URL || 'https://usva-alumni.org';
    const qrVerificationUrl = `${frontendUrl}/verify/${membershipId}`;

    const card = await MembershipCard.findOneAndUpdate(
      { memberId: member._id },
      {
        membershipId,
        pdfUrl: cloudinaryResponse.url,
        landscapePdfUrl: cloudinaryLandscapeResponse.url,
        qrVerificationUrl,
        generatedAt: new Date(),
        version: 1
      },
      { upsert: true, new: true }
    );

    member.applicationStatus = 'card_generated';
    await member.save();

    // 3. Send approval email automatically
    console.log('Sending approval notification email...');
    let emailSent = false;
    let emailErrorMsg = '';

    try {
      await emailService.sendMembershipEmail(member, pdfBuffer, settings);
      emailSent = true;
      member.applicationStatus = 'email_sent';
      await member.save();
    } catch (emailErr) {
      console.error('Automatic email delivery failed:', emailErr.message);
      emailErrorMsg = emailErr.message;
      // Note: "If email fails, DO NOT cancel membership approval. Membership remains approved."
    }

    // 4. Log Audit Action
    await AuditLog.create({
      adminId: req.admin._id,
      action: 'approve_membership',
      memberId: member._id,
      metadata: {
        membershipId,
        emailStatus: emailSent ? 'sent' : 'failed',
        emailError: emailErrorMsg
      }
    });

    res.json({
      success: true,
      message: emailSent 
        ? 'Membership approved, card generated, and email sent successfully!'
        : `Membership approved and card generated, but email delivery failed: ${emailErrorMsg}. Admin can resend from dashboard.`,
      data: { member, card }
    });

  } catch (error) {
    console.error('Approval controller error:', error);
    res.status(500).json({ success: false, message: 'Approval failed: ' + error.message });
  }
};

/**
 * Reject member application with rejection reason
 * POST /api/admin/members/:id/reject
 */
const rejectMember = async (req, res) => {
  const { rejectionReason } = req.body;

  try {
    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide a reason for rejection.' });
    }

    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    member.applicationStatus = 'rejected';
    member.rejectionReason = rejectionReason.trim();
    await member.save();

    await AuditLog.create({
      adminId: req.admin._id,
      action: 'reject_membership',
      memberId: member._id,
      metadata: { rejectionReason }
    });

    res.json({
      success: true,
      message: 'Application rejected successfully. Student will see the reason on their dashboard.',
      data: member
    });

  } catch (error) {
    console.error('Rejection controller error:', error);
    res.status(500).json({ success: false, message: 'Rejection failed: ' + error.message });
  }
};

/**
 * Manually regenerate card / increment version
 * POST /api/admin/members/:id/generate-card
 */
const regenerateCard = async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    if (!member.membershipId) {
      return res.status(400).json({ success: false, message: 'Member does not have a membership ID yet. Approve first.' });
    }

    const settings = await Settings.findOne();
    const validity = settings ? settings.membershipValidity : 'Mar 2028';

    const pdfBuffer = await pdfService.generateMemberPDF(member, validity, 'portrait');
    const landscapePdfBuffer = await pdfService.generateMemberPDF(member, validity, 'landscape');
    
    // Upload raw PDF buffers to Cloudinary
    const cloudinaryResponse = await cloudinaryService.uploadBuffer(
      pdfBuffer,
      'usva_pdfs',
      `USVA_Membership_${member.membershipId}.pdf`,
      'raw'
    );
    const cloudinaryLandscapeResponse = await cloudinaryService.uploadBuffer(
      landscapePdfBuffer,
      'usva_pdfs',
      `USVA_Membership_Landscape_${member.membershipId}.pdf`,
      'raw'
    );

    // Increment Card version
    const card = await MembershipCard.findOne({ memberId: member._id });
    const currentVersion = card ? card.version : 0;

    const updatedCard = await MembershipCard.findOneAndUpdate(
      { memberId: member._id },
      {
        pdfUrl: cloudinaryResponse.url,
        landscapePdfUrl: cloudinaryLandscapeResponse.url,
        generatedAt: new Date(),
        version: currentVersion + 1
      },
      { upsert: true, new: true }
    );

    await AuditLog.create({
      adminId: req.admin._id,
      action: 'regenerate_card',
      memberId: member._id,
      metadata: { version: updatedCard.version }
    });

    res.json({
      success: true,
      message: `Card version ${updatedCard.version} regenerated successfully!`,
      data: updatedCard
    });

  } catch (error) {
    console.error('Regenerate card error:', error);
    res.status(500).json({ success: false, message: 'Card regeneration failed: ' + error.message });
  }
};

/**
 * Resend email with card PDF attached
 * POST /api/admin/members/:id/resend-email
 */
const resendEmail = async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    if (!member.membershipId) {
      return res.status(400).json({ success: false, message: 'No membership ID found. Approve first.' });
    }

    const settings = await Settings.findOne();
    const validity = settings ? settings.membershipValidity : 'Mar 2028';

    // Generate fresh PDF buffer on request
    const pdfBuffer = await pdfService.generateMemberPDF(member, validity);
    
    await emailService.sendMembershipEmail(member, pdfBuffer, settings);
    
    member.applicationStatus = 'email_sent';
    await member.save();

    await AuditLog.create({
      adminId: req.admin._id,
      action: 'resend_email',
      memberId: member._id
    });

    res.json({
      success: true,
      message: 'Card PDF resent to student email successfully!'
    });

  } catch (error) {
    console.error('Resend email error:', error);
    res.status(500).json({ success: false, message: 'Failed to send email: ' + error.message });
  }
};

/**
 * Export member database in CSV format
 * GET /api/admin/export
 */
const exportCSV = async (req, res) => {
  try {
    const members = await Member.find().sort({ createdAt: -1 });

    let csvContent = '\uFEFF'; // Add UTF-8 BOM for Excel formatting
    csvContent += 'Membership ID,Full Name,Sanad,Place,Admission Number,Phone,Email,Payment Status,Application Status,Registration Date\n';

    members.forEach((member) => {
      // Format Sanad
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

      const formattedRow = [
        member.membershipId || '',
        member.fullName.replace(/"/g, '""'),
        sanadText,
        member.place.replace(/"/g, '""'),
        member.admissionNumber,
        member.phone,
        member.email,
        member.paymentStatus,
        member.applicationStatus,
        member.createdAt.toISOString().slice(0, 10)
      ];

      csvContent += formattedRow.map(val => `"${val}"`).join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=USVA_Alumni_Members_${Date.now()}.csv`);
    res.status(200).send(csvContent);

  } catch (error) {
    console.error('Export CSV error:', error);
    res.status(500).json({ success: false, message: 'CSV export failed' });
  }
};

/**
 * Server-side merges multiple approved PDFs into a single bulk PDF doc for offline physical printing
 * POST /api/admin/bulk-generate
 */
const bulkGeneratePDFs = async (req, res) => {
  const { memberIds } = req.body;

  try {
    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide an array of member IDs.' });
    }

    const settings = await Settings.findOne();
    const validity = settings ? settings.membershipValidity : 'Mar 2028';

    // Retrieve approved member data
    const members = await Member.find({
      _id: { $in: memberIds },
      membershipId: { $exists: true }
    });

    if (members.length === 0) {
      return res.status(400).json({ success: false, message: 'No approved members found with the provided IDs.' });
    }

    const pdfBuffers = [];
    console.log(`Bulk generation: generating PDFs for ${members.length} members...`);

    for (const member of members) {
      const buffer = await pdfService.generateMemberPDF(member, validity, 'landscape');
      pdfBuffers.push(buffer);
    }

    console.log('Merging generated PDF buffers...');
    const mergedBuffer = await pdfService.mergePDFs(pdfBuffers);

    // Set headers to trigger file download directly
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=USVA_Bulk_Cards_${Date.now()}.pdf`);
    res.status(200).send(mergedBuffer);

  } catch (error) {
    console.error('Bulk generate PDF controller error:', error);
    res.status(500).json({ success: false, message: 'Bulk PDF generation failed: ' + error.message });
  }
};

/**
 * Fetch Organization/Campaign Settings
 * GET /api/settings
 */
const getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Get Settings error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve settings' });
  }
};

/**
 * Update Campaign Settings (Admin only)
 * PUT /api/admin/settings
 */
const updateSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }

    const updates = req.body;
    const allowedUpdates = [
      'collegeName',
      'alumniName',
      'membershipFee',
      'currency',
      'membershipValidity',
      'contactEmail',
      'contactPhone',
      'address',
      'logoUrl',
      'emailSenderName'
    ];

    allowedUpdates.forEach((key) => {
      if (updates[key] !== undefined) {
        settings[key] = updates[key];
      }
    });

    await settings.save();

    await AuditLog.create({
      adminId: req.admin._id,
      action: 'update_settings',
      metadata: { updates }
    });

    res.json({
      success: true,
      message: 'Campaign configurations updated successfully',
      data: settings
    });

  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ success: false, message: 'Failed to update campaign configurations' });
  }
};

/**
 * Generate and download Landscape PDF card directly for a member
 * GET /api/admin/members/:id/download-landscape
 */
const downloadLandscapeCard = async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    if (!member.membershipId) {
      return res.status(400).json({ success: false, message: 'Member does not have a membership ID yet. Approve first.' });
    }

    const settings = await Settings.findOne();
    const validity = settings ? settings.membershipValidity : 'Mar 2028';

    const pdfBuffer = await pdfService.generateMemberPDF(member, validity, 'landscape');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=USVA_Landscape_${member.membershipId}.pdf`);
    res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error('Download landscape controller error:', error);
    res.status(500).json({ success: false, message: 'Server error generating Landscape card: ' + error.message });
  }
};

/**
 * Securely delete a member registration and all associated Cloudinary assets
 * DELETE /api/admin/members/:id
 */
const deleteMember = async (req, res) => {
  const { id } = req.params;

  try {
    const member = await Member.findById(id);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member application profile not found'
      });
    }

    console.log(`Starting secure deletion for member application: ${member.fullName} (${member._id})...`);

    // 1. Collect and delete student photo from Cloudinary
    if (member.photoPublicId) {
      console.log(`Deleting student photo from Cloudinary: ${member.photoPublicId}`);
      try {
        await cloudinaryService.deleteImage(member.photoPublicId, 'image');
      } catch (err) {
        console.error('Failed to delete student photo from Cloudinary:', err.message);
      }
    }

    // 2. Find associated payment and delete screenshot from Cloudinary
    const payment = await Payment.findOne({ memberId: member._id });
    if (payment && payment.screenshotPublicId) {
      console.log(`Deleting payment proof screenshot from Cloudinary: ${payment.screenshotPublicId}`);
      try {
        await cloudinaryService.deleteImage(payment.screenshotPublicId, 'image');
      } catch (err) {
        console.error('Failed to delete payment screenshot from Cloudinary:', err.message);
      }
    }

    // 3. Find associated card and delete raw PDF files from Cloudinary
    const card = await MembershipCard.findOne({ memberId: member._id });
    if (member.membershipId) {
      console.log(`Deleting compiled card PDFs from Cloudinary for ID: ${member.membershipId}`);
      try {
        await cloudinaryService.deleteImage(`usva_pdfs/USVA_Membership_${member.membershipId}.pdf`, 'raw');
        await cloudinaryService.deleteImage(`usva_pdfs/USVA_Membership_Landscape_${member.membershipId}.pdf`, 'raw');
      } catch (err) {
        console.error('Failed to delete PDF cards from Cloudinary:', err.message);
      }
    }

    // 4. Delete database documents
    console.log('Deleting database documents...');
    await Member.findByIdAndDelete(member._id);
    await Payment.deleteMany({ memberId: member._id });
    await MembershipCard.deleteMany({ memberId: member._id });

    // Log action to audit trail
    await AuditLog.create({
      adminId: req.admin._id,
      action: 'delete_member_application',
      memberId: member._id,
      metadata: { fullName: member.fullName, admissionNumber: member.admissionNumber }
    });

    res.json({
      success: true,
      message: 'Application and all associated files deleted successfully.'
    });

  } catch (error) {
    console.error('Delete member controller error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error processing application deletion: ' + error.message
    });
  }
};

module.exports = {
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
  getSettings,
  updateSettings,
  downloadLandscapeCard,
  deleteMember
};
