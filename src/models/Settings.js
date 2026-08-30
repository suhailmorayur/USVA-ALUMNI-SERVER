const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    collegeName: {
      type: String,
      required: true,
      default: 'Umarali Shihab Thangal Islamic Academy, Arimbra'
    },
    alumniName: {
      type: String,
      required: true,
      default: 'Umariyya Students Venerable Association (USVA)'
    },
    membershipFee: {
      type: Number,
      required: true,
      default: 500
    },
    currency: {
      type: String,
      required: true,
      default: 'INR'
    },
    membershipValidity: {
      type: String,
      required: true,
      default: 'Mar 2028'
    },
    contactEmail: {
      type: String,
      default: 'info@usva.com'
    },
    contactPhone: {
      type: String,
      default: '+91 73562 26704'
    },
    address: {
      type: String,
      default: 'Arimbra, Malappuram, Kerala, India'
    },
    logoUrl: {
      type: String
    },
    emailSenderName: {
      type: String,
      required: true,
      default: 'USVA Office'
    },
    upiId: {
      type: String,
      required: true,
      default: 'usva@upi'
    },
    payeeName: {
      type: String,
      required: true,
      default: 'USVA Alumni Association'
    }
  },
  {
    timestamps: { createdAt: false, updatedAt: true }
  }
);

module.exports = mongoose.model('Settings', settingsSchema);
