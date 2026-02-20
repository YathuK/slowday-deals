const mongoose = require('mongoose');

const availabilityWindowSchema = new mongoose.Schema({
    day: { type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'], required: true },
    startTime: { type: String, required: true }, // "13:00"
    endTime:   { type: String, required: true }, // "17:00"
    sessionDuration: { type: Number, required: true } // minutes: 15,30,45,60,90,120
}, { _id: false });

const serviceSchema = new mongoose.Schema({
    provider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    providerName: { type: String, required: [true, 'Provider name is required'] },
    serviceType: {
        type: String,
        required: [true, 'Service type is required'],
        enum: ['Haircut', 'Barber', 'Cleaning', 'Massage', 'Nails', 'Spa',
               'Personal Training', 'Dog Walking', 'Tutoring', 'Photography',
               'Car Detailing', 'Laundry Service', 'Other']
    },
    description: { type: String, required: [true, 'Description is required'], minlength: [10, 'Description must be at least 10 characters'] },
    location:    { type: String, required: [true, 'Location is required'] },
    contact:     { type: String, required: [true, 'Contact information is required'] },
    email:       { type: String, default: '' },

    // Social media links (optional)
    instagram:   { type: String, default: '' },
    tiktok:      { type: String, default: '' },
    facebook:    { type: String, default: '' },

    // Normal (non-deal) price — used to show discount %
    normalPrice: { type: Number, default: null },

    // Deal prices
    weekdayPrice: { type: Number, required: [true, 'Weekday price is required'], min: [0, 'Price must be positive'] },
    weekendPrice: { type: Number, required: [true, 'Weekend price is required'], min: [0, 'Price must be positive'] },

    // Slot limits (null = unlimited)
    weekdaySlots:    { type: Number, default: null },
    weekendSlots:    { type: Number, default: null },
    weekdaySlotsUsed:{ type: Number, default: 0 },
    weekendSlotsUsed:{ type: Number, default: 0 },

    // Deal on/off toggle
    dealActive: { type: Boolean, default: true },

    // Availability windows (optional)
    availabilityWindows: [availabilityWindowSchema],

    photos:      [{ type: String }],
    isActive:    { type: Boolean, default: true },
    rating:      { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 }
}, { timestamps: true });

serviceSchema.index({ serviceType: 1, location: 1, isActive: 1 });
module.exports = mongoose.model('Service', serviceSchema);
