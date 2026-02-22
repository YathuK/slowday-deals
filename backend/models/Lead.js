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
    notes:         { type: String, default: '' },
    price:         { type: Number, default: null },
    discountPrice: { type: Number, default: null },
    days:          [{ type: String, enum: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] }],
    assignee:      { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', default: null }
}, { timestamps: true });

module.exports = mongoose.model('Lead', leadSchema);
