const mongoose = require('mongoose');

const callLogSchema = new mongoose.Schema({
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
    caller: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
    callerName: { type: String, default: '' },
    startedAt: { type: Date, required: true },
    duration: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    twilioCallSid: { type: String, default: null },
    status: { type: String, enum: ['in-progress', 'completed', 'failed', 'no-answer', 'busy', 'canceled'], default: 'completed' }
}, { timestamps: true });

module.exports = mongoose.model('CallLog', callLogSchema);
