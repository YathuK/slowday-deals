# SlowDay Deals - Backend API

A complete backend API for the SlowDay Deals service marketplace platform.

## Features

- ✅ User authentication (JWT)
- ✅ Customer and Provider account types
- ✅ Service CRUD operations
- ✅ Booking management system
- ✅ Saved services functionality
- ✅ Provider dashboard statistics
- ✅ Secure password hashing
- ✅ Input validation
- ✅ MongoDB database

## Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **express-validator** - Input validation

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or MongoDB Atlas)
- npm or yarn

### Installation

1. **Clone and navigate to backend directory**
```bash
cd backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env
```

Edit `.env` file with your configuration:
```
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/slowday-deals
JWT_SECRET=your_secret_key_here
FRONTEND_URL=http://localhost:3000
```

4. **Start MongoDB**
```bash
# If using local MongoDB
mongod

# Or use MongoDB Atlas connection string in .env
```

5. **Start the server**
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

Server will run on `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (requires auth)

### Services
- `GET /api/services` - Get all services (with filters)
- `GET /api/services/:id` - Get single service
- `POST /api/services` - Create service (provider only)
- `PUT /api/services/:id` - Update service (provider only)
- `DELETE /api/services/:id` - Delete service (provider only)
- `GET /api/services/provider/my-services` - Get provider's services

### Bookings
- `POST /api/bookings` - Create booking
- `GET /api/bookings/customer` - Get customer bookings
- `GET /api/bookings/provider` - Get provider bookings
- `GET /api/bookings/:id` - Get single booking
- `PUT /api/bookings/:id/status` - Update booking status
- `GET /api/bookings/stats/dashboard` - Provider dashboard stats

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update profile
- `POST /api/users/saved-services/:serviceId` - Save service
- `DELETE /api/users/saved-services/:serviceId` - Remove saved service
- `GET /api/users/saved-services` - Get saved services

## API Request Examples

### Signup
```bash
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "phone": "(555) 123-4567",
    "accountType": "customer"
  }'
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

### Create Service (Provider)
```bash
curl -X POST http://localhost:5000/api/services \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "providerName": "My Salon",
    "serviceType": "Haircut",
    "description": "Professional haircut service...",
    "location": "Brooklyn",
    "contact": "(555) 123-4567",
    "weekdayPrice": 35,
    "weekendPrice": 50
  }'
```

### Create Booking
```bash
curl -X POST http://localhost:5000/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "serviceId": "SERVICE_ID_HERE",
    "customerContact": "(555) 123-4567",
    "preferredTime": "2024-03-15T14:00:00Z",
    "notes": "Looking forward to it!"
  }'
```

## Database Schema

### User
- name, email, password (hashed)
- phone, accountType (customer/provider)
- savedServices (array of service IDs)
- timestamps

### Service
- provider (User reference)
- providerName, serviceType, description
- location, contact
- weekdayPrice, weekendPrice
- photos (array of URLs)
- rating, reviewCount
- isActive
- timestamps

### Booking
- customer, provider (User references)
- service (Service reference)
- customerName, customerContact
- preferredTime, notes
- status (pending/confirmed/completed/cancelled)
- price, isWeekend
- timestamps

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. After login/signup, include the token in requests:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

Tokens expire after 30 days.

## Error Handling

All endpoints return JSON responses with this structure:

**Success:**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

**Error:**
```json
{
  "success": false,
  "message": "Error description",
  "errors": []
}
```

## User Experience Flows

### Customer Flow
1. Sign up → Browse services → Swipe/like services
2. View service details → Book service
3. See booking confirmation
4. Check "My Bookings" for status updates
5. View saved services anytime

### Provider Flow
1. Sign up as provider → Create service profile
2. Upload photos, set weekday/weekend prices
3. Receive booking notifications
4. View all bookings in dashboard
5. Update booking status (confirm/complete)
6. See revenue statistics

### Booking Confirmation Experience
When a booking is created:
- Customer sees: "Booking submitted! Provider will contact you soon"
- Booking appears in customer's "My Bookings" with status "Pending"
- Provider receives booking in their dashboard
- Provider can confirm → status changes to "Confirmed"
- Customer gets updated status
- After service → Provider marks "Completed"

## Production Deployment

### Environment Setup
```bash
NODE_ENV=production
MONGODB_URI=your_production_db
JWT_SECRET=strong_random_secret
FRONTEND_URL=https://yourapp.com
```

### Recommended Hosting
- **Backend**: Heroku, Railway, Render, DigitalOcean
- **Database**: MongoDB Atlas (free tier available)
- **Frontend**: Vercel, Netlify

## Security Best Practices

- ✅ Passwords hashed with bcrypt
- ✅ JWT tokens for authentication
- ✅ Input validation on all routes
- ✅ CORS configured
- ✅ Environment variables for secrets
- ✅ Authorization checks on protected routes

## Future Enhancements

- [ ] Email notifications
- [ ] SMS reminders
- [ ] Payment integration (Stripe)
- [ ] Review/rating system
- [ ] Real-time chat between customer and provider
- [ ] Image upload to cloud storage (Cloudinary)
- [ ] Advanced search filters
- [ ] Geolocation-based search

## Support

For issues or questions, please create an issue in the repository.

## License

MIT
