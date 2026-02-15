const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
    provider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    providerName: {
        type: String,
        required: [true, 'Provider name is required']
    },
    serviceType: {
        type: String,
        required: [true, 'Service type is required'],
        enum: ['Haircut', 'Barber', 'Cleaning', 'Massage', 'Nails', 'Spa', 
               'Personal Training', 'Dog Walking', 'Tutoring', 'Photography', 
               'Car Detailing', 'Laundry Service', 'Other']
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        minlength: [20, 'Description must be at least 20 characters']
    },
    location: {
        type: String,
        required: [true, 'Location is required']
    },
    contact: {
        type: String,
        required: [true, 'Contact information is required']
    },
    weekdayPrice: {
        type: Number,
        required: [true, 'Weekday price is required'],
        min: [0, 'Price must be positive']
    },
    weekendPrice: {
        type: Number,
        required: [true, 'Weekend price is required'],
        min: [0, 'Price must be positive']
    },
    photos: [{
        type: String
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    reviewCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Index for searching
serviceSchema.index({ serviceType: 1, location: 1, isActive: 1 });

module.exports = mongoose.model('Service', serviceSchema);
