const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const staffSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, default: null },
    role: {
        type: String,
        enum: ['super_admin', 'admin', 'sales', 'support'],
        required: true
    },
    isActive: { type: Boolean, default: true },
    inviteToken: { type: String, default: null },
    inviteExpires: { type: Date, default: null },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', default: null },
    lastLogin: { type: Date, default: null }
}, { timestamps: true });

staffSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    if (!this.password) return next();
    if (this.password.startsWith('$2')) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

staffSchema.methods.comparePassword = async function(candidatePassword) {
    if (!this.password) return false;
    return await bcrypt.compare(candidatePassword, this.password);
};

staffSchema.methods.toJSON = function() {
    const obj = this.toObject();
    delete obj.password;
    delete obj.inviteToken;
    return obj;
};

module.exports = mongoose.model('Staff', staffSchema);
