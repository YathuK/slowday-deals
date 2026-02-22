const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema({
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
    senderName: { type: String, default: '' },
    to: { type: String, required: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    sentAt: { type: Date, required: true },
    status: { type: String, enum: ['sent', 'failed'], default: 'sent' }
}, { timestamps: true });

module.exports = mongoose.model('EmailLog', emailLogSchema);
