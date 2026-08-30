const Member = require('../models/Member');
const Payment = require('../models/Payment');
const Settings = require('../models/Settings');
const MembershipCard = require('../models/MembershipCard');
const pdfService = require('../services/pdfService');
const emailService = require('../services/emailService');
const cloudinaryService = require('../services/cloudinaryService');

/**
 * Submit manual payment proof (UPI screenshot + transaction details)
 * POST /api/payments/submit-proof/:memberId
 */
const submitProof = async (req, res) => {
  const { memberId } = req.params;
  const { utr, screenshotUrl, screenshotPublicId, paymentDate, amountPaid } = req.body;

  try {
    const member = await Member.findById(memberId);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member profile not found.' });
    }

    const settings = await Settings.findOne();
    const finalAmountPaid = amountPaid || (settings ? settings.membershipFee : 500);
    const finalPaymentDate = paymentDate ? new Date(paymentDate) : new Date();

    // Auto-generate transaction reference if not entered
    const finalUtr = utr && utr.trim()
      ? utr.trim()
      : `UPIAUTO${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;

    const finalScreenshotUrl = screenshotUrl || 'https://res.cloudinary.com/dummy/image/upload/v1/usva/placeholder.jpg';
    const finalScreenshotPublicId = screenshotPublicId || 'placeholder';

    // Prevent duplicate UTR submissions
    const existingPayment = await Payment.findOne({ utr: finalUtr });
    if (existingPayment) {
      return res.status(400).json({
        success: false,
        message: 'This transaction identifier has already been processed.'
      });
    }

    // Create payment record
    const payment = await Payment.create({
      memberId: member._id,
      orderId: 'upi_' + finalUtr,
      utr: finalUtr,
      amount: finalAmountPaid,
      currency: 'INR',
      paymentMethod: 'UPI',
      status: 'paid',
      paidAt: finalPaymentDate,
      screenshotUrl: finalScreenshotUrl,
      screenshotPublicId: finalScreenshotPublicId
    });

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
    member.paymentStatus = 'paid';
    member.applicationStatus = 'approved';
    await member.save();

    // 2. Generate PDF and upload to Cloudinary (both Portrait and Landscape layouts)
    const validity = settings ? settings.membershipValidity : 'Mar 2028';

    console.log(`Generating Portrait card PDF for member ID: ${membershipId}...`);
    const pdfBuffer = await pdfService.generateMemberPDF(member, validity, 'portrait');
    
    console.log(`Generating Landscape card PDF for member ID: ${membershipId}...`);
    const landscapePdfBuffer = await pdfService.generateMemberPDF(member, validity, 'landscape');
    
    // Upload PDF files to Cloudinary
    console.log('Uploading PDFs to Cloudinary...');
    const cloudinaryResponse = await cloudinaryService.uploadBuffer(
      pdfBuffer,
      'usva_pdfs',
      `USVA_Membership_${membershipId}`,
      'raw'
    );
    const cloudinaryLandscapeResponse = await cloudinaryService.uploadBuffer(
      landscapePdfBuffer,
      'usva_pdfs',
      `USVA_Membership_Landscape_${membershipId}`,
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
    }

    res.status(201).json({
      success: true,
      message: 'Payment verified and membership card generated successfully!',
      data: {
        member,
        card,
        emailSent,
        emailError: emailErrorMsg
      }
    });

  } catch (error) {
    console.error('Submit proof controller error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error processing payment proof: ' + error.message
    });
  }
};

module.exports = {
  submitProof
};
