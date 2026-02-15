# 🎉 SlowDay Deals - Complete Full-Stack Application

A complete service marketplace platform where providers can offer special pricing on slow days, and customers can discover and book services through a TikTok-style swipe interface.

## 📁 Project Structure

```
slowday-deals/
├── backend/                 # Node.js + Express + MongoDB API
│   ├── models/             # Mongoose schemas
│   ├── routes/             # API endpoints
│   ├── middleware/         # Authentication & validation
│   ├── server.js           # Main server file
│   ├── seed.js             # Database seeder
│   └── README.md           # Backend documentation
│
└── frontend/               # HTML + CSS + Vanilla JavaScript
    ├── index.html          # Main UI
    ├── api.js              # API helper functions
    ├── app.js              # Application logic
    └── README.md           # Frontend documentation
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v14+)
- MongoDB (local or MongoDB Atlas)
- Modern web browser

### 1. Setup Backend

```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret

# Seed database with sample data
node seed.js

# Start server
npm run dev
```

Backend will run on `http://localhost:5000`

### 2. Setup Frontend

```bash
# Navigate to frontend
cd frontend

# Serve the frontend (choose one method)
python3 -m http.server 3000
# OR
npx http-server -p 3000
# OR just open index.html in your browser
```

Frontend will run on `http://localhost:3000`

### 3. Test the Application

Use these test accounts:

**Customer:**
- Email: `customer@example.com`
- Password: `password123`

**Provider:**
- Email: `provider@example.com`
- Password: `password123`

## ✨ Features

### For Customers 🛍️
- ✅ **Browse Services**: Swipe through services TikTok-style
- ✅ **Save Favorites**: Swipe right to save services
- ✅ **Book Services**: Easy booking with pre-filled info
- ✅ **Track Bookings**: Monitor booking status in real-time
- ✅ **Special Pricing**: See weekday vs weekend prices
- ✅ **Search & Filter**: Find exactly what you need

### For Service Providers 💼
- ✅ **Create Profile**: Showcase your services with photos
- ✅ **Flexible Pricing**: Set different prices for weekdays/weekends
- ✅ **Booking Management**: Accept, decline, or complete bookings
- ✅ **Dashboard**: View statistics and revenue
- ✅ **Customer Info**: Access customer contact details
- ✅ **Status Updates**: Change booking status easily

## 🎨 User Experience

### Customer Journey
```
1. Sign up → Browse services → Swipe right on favorites
2. View details → Book service → Receive confirmation
3. Track status: Pending 🟡 → Confirmed ✅ → Completed ✔️
```

### Provider Journey
```
1. Sign up as provider → Create service profile
2. Upload photos → Set weekday/weekend prices
3. Receive bookings → Confirm appointments
4. Complete service → Track revenue
```

## 🛠️ Technology Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **JWT** - Authentication
- **bcryptjs** - Password hashing

### Frontend
- **HTML5** - Structure
- **CSS3** - Styling (with gradients, animations)
- **Vanilla JavaScript** - Logic
- **Fetch API** - HTTP requests
- **LocalStorage** - Token management

## 📊 Database Schema

### User
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  phone: String,
  accountType: 'customer' | 'provider',
  savedServices: [ObjectId],
  timestamps: true
}
```

### Service
```javascript
{
  provider: ObjectId (User),
  providerName: String,
  serviceType: String,
  description: String,
  location: String,
  contact: String,
  weekdayPrice: Number,
  weekendPrice: Number,
  photos: [String],
  isActive: Boolean,
  rating: Number,
  timestamps: true
}
```

### Booking
```javascript
{
  customer: ObjectId (User),
  service: ObjectId (Service),
  provider: ObjectId (User),
  customerName: String,
  customerContact: String,
  preferredTime: Date,
  notes: String,
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled',
  price: Number,
  isWeekend: Boolean,
  timestamps: true
}
```

## 🔐 API Endpoints

### Authentication
```
POST   /api/auth/signup      - Register new user
POST   /api/auth/login       - Login user
GET    /api/auth/me          - Get current user (protected)
```

### Services
```
GET    /api/services         - Get all services
GET    /api/services/:id     - Get single service
POST   /api/services         - Create service (provider only)
PUT    /api/services/:id     - Update service (provider only)
DELETE /api/services/:id     - Delete service (provider only)
```

### Bookings
```
POST   /api/bookings                  - Create booking
GET    /api/bookings/customer         - Get customer bookings
GET    /api/bookings/provider         - Get provider bookings
PUT    /api/bookings/:id/status       - Update booking status
```

### Users
```
GET    /api/users/profile             - Get user profile
PUT    /api/users/profile             - Update profile
POST   /api/users/saved-services/:id  - Save service
DELETE /api/users/saved-services/:id  - Remove saved service
GET    /api/users/saved-services      - Get saved services
```

## 🎯 Key Features Explained

### Swipe Interface
- Swipe left or tap ❌ to skip
- Swipe right or tap ❤️ to save
- Tap ℹ️ or card to view details
- Smooth animations and visual feedback

### Booking System
- Automatic price calculation (weekday vs weekend)
- Pre-filled customer information
- Status tracking: Pending → Confirmed → Completed
- Both parties can cancel

### Authentication
- JWT token-based authentication
- Secure password hashing with bcrypt
- Token stored in localStorage
- Auto-logout on token expiration

### Real-time Status Updates
- Customer sees: "Booking submitted!"
- Provider receives notification
- Provider confirms → Customer sees "Confirmed ✅"
- Service completed → Both see "Completed ✔️"

## 📱 Mobile-First Design

The interface is optimized for mobile devices:
- Touch-friendly buttons (minimum 44px)
- Natural swipe gestures
- Bottom navigation for easy thumb access
- Full-screen modals
- Responsive layout (works on all screen sizes)

## 🚢 Deployment

### Backend Deployment (Heroku Example)

```bash
# Install Heroku CLI and login
heroku login

# Create app
heroku create slowday-deals-api

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set MONGODB_URI=your_mongodb_atlas_uri
heroku config:set JWT_SECRET=your_secret_key
heroku config:set FRONTEND_URL=https://your-frontend.com

# Deploy
git push heroku main
```

### Frontend Deployment (Vercel Example)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd frontend
vercel

# Update API_CONFIG.BASE_URL in api.js to your backend URL
```

### Environment Variables

**Backend (.env):**
```
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/slowday-deals
JWT_SECRET=your_super_secret_jwt_key_here
FRONTEND_URL=https://your-frontend-domain.com
```

**Frontend (api.js):**
```javascript
const API_CONFIG = {
    BASE_URL: 'https://your-backend-domain.com/api'
};
```

## 🧪 Testing

### Manual Testing Checklist

**Customer Flow:**
- [ ] Sign up as customer
- [ ] Browse services
- [ ] Save a service (swipe right)
- [ ] View saved services
- [ ] Book a service
- [ ] View booking in "My Bookings"
- [ ] Check booking status

**Provider Flow:**
- [ ] Sign up as provider
- [ ] Create service profile
- [ ] Upload photos (if implemented)
- [ ] View bookings dashboard
- [ ] Confirm a booking
- [ ] Mark booking as complete
- [ ] View revenue statistics

### API Testing

Use tools like Postman or curl:

```bash
# Test signup
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123","phone":"555-1234","accountType":"customer"}'

# Test login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

## 🐛 Troubleshooting

### Backend Issues

**MongoDB connection failed:**
- Check MONGODB_URI in .env
- Ensure MongoDB is running (local) or accessible (Atlas)
- Check firewall settings

**JWT errors:**
- Verify JWT_SECRET is set in .env
- Check token format in Authorization header
- Clear browser localStorage and re-login

### Frontend Issues

**CORS errors:**
- Ensure backend is running
- Check FRONTEND_URL in backend .env
- Serve frontend via HTTP server (not file://)

**API calls failing:**
- Check API_CONFIG.BASE_URL in api.js
- Verify backend is running on correct port
- Check browser Network tab for errors

**Authentication not working:**
- Clear localStorage: `localStorage.clear()`
- Check token is being sent with requests
- Verify backend authentication middleware

## 📚 Documentation

- `backend/README.md` - Backend setup and API docs
- `backend/USER_FLOWS.md` - Detailed user journey diagrams
- `frontend/README.md` - Frontend setup and integration docs

## 🔮 Future Enhancements

### Phase 1 (Next Features)
- [ ] Image upload to Cloudinary
- [ ] Email notifications
- [ ] SMS reminders
- [ ] Review and rating system
- [ ] Advanced search filters

### Phase 2 (Advanced Features)
- [ ] Real-time chat between customer and provider
- [ ] Payment integration (Stripe)
- [ ] Calendar integration
- [ ] Geolocation-based search
- [ ] Push notifications
- [ ] Multi-language support

### Phase 3 (Scale Features)
- [ ] Admin dashboard
- [ ] Analytics and insights
- [ ] Marketing tools
- [ ] Loyalty programs
- [ ] Subscription plans
- [ ] API for third-party integrations

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - feel free to use this project for learning or commercial purposes.

## 💡 Credits

Built with ❤️ for the service industry professionals who work hard every day.

## 📞 Support

For issues or questions:
- Check the troubleshooting section
- Review backend and frontend READMEs
- Check browser console and network tab
- Verify backend logs

---

**Happy coding! 🚀**
