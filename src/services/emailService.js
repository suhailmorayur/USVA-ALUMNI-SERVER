const nodemailer = require('nodemailer');
const EmailLog = require('../models/EmailLog');

/**
 * Transporter setup using SMTP env variables
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_PORT === '465', // true for 465, false for others
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

/**
 * Sends the membership card PDF to the approved member
 * @param {Object} member - The member document
 * @param {Buffer} pdfBuffer - The generated 2-page PDF buffer
 * @param {Object} settings - Configured settings (e.g. emailSenderName)
 * @returns {Promise<Object>} Status of the email delivery
 */
const sendMembershipEmail = async (member, pdfBuffer, settings) => {
  const transporter = createTransporter();
  
  const senderName = settings?.emailSenderName || 'USVA Office';
  const mailOptions = {
    from: `"${senderName}" <${process.env.EMAIL_USER}>`,
    to: member.email,
    subject: 'Your USVA Alumni Membership Has Been Approved!',
    html: `
      <div style="font-family: sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0f766e;">Dear ${member.fullName},</h2>
        <p style="font-size: 16px; color: #334155;">Congratulations!</p>
        <p style="font-size: 16px; color: #334155;">Your alumni membership application for <strong>Umariyya Students Venerable Association (USVA)</strong> has been successfully approved.</p>
        
        <div style="background-color: #f1f5f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <table style="width: 100%;">
            <tr>
              <td style="font-weight: bold; width: 150px; color: #475569;">Membership ID:</td>
              <td style="font-weight: bold; color: #0f766e; font-size: 18px;">${member.membershipId}</td>
            </tr>
            <tr>
              <td style="font-weight: bold; color: #475569;">Admission No:</td>
              <td>${member.admissionNumber}</td>
            </tr>
            <tr>
              <td style="font-weight: bold; color: #475569;">Place:</td>
              <td>${member.place}</td>
            </tr>
          </table>
        </div>
        
        <p style="font-size: 16px; color: #334155;">Your official <strong>digital membership card (PDF)</strong> is attached to this email.</p>
        <p style="font-size: 16px; color: #334155;">You can also log in to your student dashboard to preview and download your front-side card, back-side card, or the combined PDF at any time.</p>
        
        <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 14px; color: #64748b;">
          <p style="margin: 0;">Regards,</p>
          <p style="margin: 0; font-weight: bold; color: #0f766e;">USVA Alumni Office</p>
          <p style="margin: 0;">Umarali Shihab Thangal Islamic Academy, Arimbra</p>
        </div>
      </div>
    `,
    attachments: [
      {
        filename: `USVA_Membership_${member.membershipId}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  };

  // Log in db
  const emailLog = new EmailLog({
    memberId: member._id,
    email: member.email,
    type: 'approval_card',
    status: 'pending'
  });

  try {
    await transporter.sendMail(mailOptions);
    
    emailLog.status = 'sent';
    emailLog.sentAt = new Date();
    await emailLog.save();

    return { success: true };
  } catch (error) {
    console.error('Email sending error:', error);
    
    emailLog.status = 'failed';
    emailLog.errorMessage = error.message;
    await emailLog.save();

    // Throw error so controller handles the tracking view (does not rollback membership approval!)
    throw error;
  }
};

module.exports = {
  sendMembershipEmail
};
