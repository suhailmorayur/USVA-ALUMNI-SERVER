const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      required: true
    },
    orderId: {
      type: String,
      required: true,
      unique: true
    },
    paymentId: {
      type: String
    },
    signature: {
      type: String
    },
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'INR'
    },
    paymentMethod: {
      type: String,
      default: 'UPI'
    },
    status: {
      type: String,
      enum: ['pending', 'created', 'paid', 'failed', 'refunded'],
      default: 'pending'
    },
    paidAt: {
      type: Date
    },
    webhookStatus: {
      type: String
    },
    screenshotUrl: {
      type: String
    },
    screenshotPublicId: {
      type: String
    },
    utr: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Payment', paymentSchema);
