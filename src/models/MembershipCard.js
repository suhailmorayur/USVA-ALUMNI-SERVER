const mongoose = require('mongoose');

const membershipCardSchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      required: true
    },
    membershipId: {
      type: String,
      required: true,
      unique: true
    },
    frontCardUrl: {
      type: String
    },
    backCardUrl: {
      type: String
    },
    pdfUrl: {
      type: String
    },
    landscapePdfUrl: {
      type: String
    },
    qrVerificationUrl: {
      type: String
    },
    generatedAt: {
      type: Date,
      default: Date.now
    },
    version: {
      type: Number,
      default: 1
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('MembershipCard', membershipCardSchema);
