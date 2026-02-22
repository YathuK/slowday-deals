const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    email: {
        type: String,
        sparse: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        minlength: [6, 'Password must be at least 6 characters']
    },
    phone: {
        type: String
    },
    accountType: {
        type: String,
        enum: ['customer', 'provider'],
        required: true
    },
    avatar: {
        type: String,
        default: null
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    savedServices: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service'
    }],
    resetPasswordToken: {
        type: String,
        default: null
    },
    resetPasswordExpires: {
        type: Date,
        default: null
    },
    googleId: {
        type: String,
        default: null,
        sparse: true,
        unique: true
    },
    facebookId: {
        type: String,
        default: null,
        sparse: true,
        unique: true
    },
    authProvider: {
        type: String,
        enum: ['local', 'google', 'facebook'],
        default: 'local'
    },
    providerSetupToken: {
        type: String,
        default: null
    },
    providerSetupExpires: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    if (!this.password) return next();

    // Safety guard: never re-hash an already-hashed bcrypt password
    if (this.password.startsWith('$2')) return next();

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
    if (!this.password) return false;
    return await bcrypt.compare(candidatePassword, this.password);
};

// Remove sensitive fields from JSON output
userSchema.methods.toJSON = function() {
    const obj = this.toObject();
    delete obj.password;
    delete obj.googleId;
    delete obj.facebookId;
    delete obj.providerSetupToken;
    return obj;
};

module.exports = mongoose.model('User', userSchema);
