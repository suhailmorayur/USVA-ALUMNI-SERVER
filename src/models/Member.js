const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    sand: {
      type: [String],
      enum: ['umari', 'faizy'],
      default: []
    },
    place: {
      type: String,
      required: true,
      trim: true
    },
    admissionNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    photoUrl: {
      type: String,
      required: true
    },
    photoPublicId: {
      type: String,
      required: true
    },
    membershipId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },
    applicationStatus: {
      type: String,
      enum: ['draft', 'payment_pending', 'payment_completed', 'under_review', 'approved', 'rejected', 'card_generated', 'email_sent'],
      default: 'payment_pending'
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'created', 'paid', 'failed', 'refunded'],
      default: 'pending'
    },
    rejectionReason: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Member', memberSchema);
