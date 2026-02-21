const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
    businessName: { type: String, required: true, trim: true },
    contactName:  { type: String, default: '', trim: true },
    phone:        { type: String, default: '' },
    email:        { type: String, default: '' },
    address:      { type: String, default: '' },
    website:      { type: String, default: '' },
    serviceType:  { type: String, default: '' },
    city:         { type: String, default: '' },
    status: {
        type: String,
        enum: ['new', 'contacted', 'interested', 'onboarded', 'rejected'],
        default: 'new'
    },
    notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Lead', leadSchema);
