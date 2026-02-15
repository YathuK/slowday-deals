const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Service = require('./models/Service');
const Booking = require('./models/Booking');

dotenv.config();

const services = [
    {
        providerName: "Sarah's Hair Studio",
        serviceType: "Haircut",
        description: "Professional haircut and styling with 10+ years experience. Specializing in modern cuts and color.",
        location: "Downtown Brooklyn",
        weekdayPrice: 35,
        weekendPrice: 50,
        photos: ["https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400"],
        contact: "(555) 123-4567"
    },
    {
        providerName: "Mike's Barbershop",
        serviceType: "Barber",
        description: "Classic barbershop experience. Fades, beard trims, and hot towel shaves.",
        location: "Williamsburg",
        weekdayPrice: 25,
        weekendPrice: 35,
        photos: ["https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400"],
        contact: "(555) 234-5678"
    },
    {
        providerName: "Sparkle Clean Co",
        serviceType: "Cleaning",
        description: "Deep cleaning service for homes and apartments. Eco-friendly products, thorough and reliable.",
        location: "Manhattan",
        weekdayPrice: 80,
        weekendPrice: 100,
        photos: ["https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400"],
        contact: "(555) 345-6789"
    },
    {
        providerName: "Zen Massage Therapy",
        serviceType: "Massage",
        description: "Relaxing Swedish and deep tissue massage. Licensed therapist with 8 years experience.",
        location: "East Village",
        weekdayPrice: 60,
        weekendPrice: 80,
        photos: ["https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400"],
        contact: "(555) 456-7890"
    },
    {
        providerName: "Glam Nails",
        serviceType: "Nails",
        description: "Full nail service including manicures, pedicures, gel nails, and nail art.",
        location: "SoHo",
        weekdayPrice: 40,
        weekendPrice: 55,
        photos: ["https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400"],
        contact: "(555) 567-8901"
    }
];

const seedDatabase = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/slowday-deals', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('📦 Connected to MongoDB');

        // Clear existing data
        await User.deleteMany({});
        await Service.deleteMany({});
        await Booking.deleteMany({});
        console.log('🗑️  Cleared existing data');

        // Create sample users
        const customerUser = await User.create({
            name: 'Jane Customer',
            email: 'customer@example.com',
            password: 'password123',
            phone: '(555) 111-2222',
            accountType: 'customer'
        });

        const providerUser = await User.create({
            name: 'John Provider',
            email: 'provider@example.com',
            password: 'password123',
            phone: '(555) 333-4444',
            accountType: 'provider'
        });

        console.log('✅ Created sample users');
        console.log('   Customer: customer@example.com / password123');
        console.log('   Provider: provider@example.com / password123');

        // Create services
        const createdServices = [];
        for (const serviceData of services) {
            const service = await Service.create({
                ...serviceData,
                provider: providerUser._id
            });
            createdServices.push(service);
        }

        console.log(`✅ Created ${createdServices.length} sample services`);

        // Create a sample booking
        const sampleBooking = await Booking.create({
            customer: customerUser._id,
            service: createdServices[0]._id,
            provider: providerUser._id,
            customerName: customerUser.name,
            customerContact: customerUser.phone,
            preferredTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
            notes: 'Looking forward to the service!',
            price: createdServices[0].weekdayPrice,
            isWeekend: false,
            status: 'pending'
        });

        console.log('✅ Created sample booking');

        // Save a service for the customer
        customerUser.savedServices.push(createdServices[1]._id);
        await customerUser.save();

        console.log('✅ Added saved service for customer');

        console.log('\n🎉 Database seeded successfully!');
        console.log('\n📊 Summary:');
        console.log(`   Users: ${await User.countDocuments()}`);
        console.log(`   Services: ${await Service.countDocuments()}`);
        console.log(`   Bookings: ${await Booking.countDocuments()}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding error:', error);
        process.exit(1);
    }
};

seedDatabase();
