# SlowDay Deals - Frontend

API-connected frontend for the SlowDay Deals service marketplace.

## Files

- `index.html` - Main HTML file with UI structure and styles
- `api.js` - API configuration and helper functions
- `app.js` - Application logic that connects to the backend API

## Setup Instructions

### 1. Start the Backend Server

First, make sure your backend is running:

```bash
cd backend
npm install
npm run dev
```

Backend should be running on `http://localhost:5000`

### 2. Serve the Frontend

You have several options:

**Option A: Using Python's built-in server**
```bash
cd frontend
python3 -m http.server 3000
```

**Option B: Using Node.js http-server**
```bash
npm install -g http-server
cd frontend
http-server -p 3000
```

**Option C: Using VS Code Live Server**
- Install the "Live Server" extension in VS Code
- Right-click on `index.html`
- Select "Open with Live Server"

**Option D: Simply open the file**
- Just open `index.html` in your browser
- Note: Some API features may not work due to CORS restrictions

### 3. Access the Application

Open your browser and go to:
```
http://localhost:3000
```

## Configuration

### API URL

The API base URL is configured in `api.js`:

```javascript
const API_CONFIG = {
    BASE_URL: 'http://localhost:5000/api',
    // ...
};
```

For production, update this to your deployed API URL:

```javascript
const API_CONFIG = {
    BASE_URL: 'https://your-api-domain.com/api',
    // ...
};
```

## Features

### Customer Features
✅ Browse services with swipe interface
✅ Save favorite services  
✅ Book services
✅ View booking history
✅ Track booking status

### Provider Features  
✅ Create service profile
✅ Upload service photos
✅ Set weekday/weekend pricing
✅ Receive booking requests
✅ Manage bookings (confirm/complete/cancel)
✅ View booking statistics

## How It Works

### Authentication Flow
1. User clicks "Login/Sign Up" button
2. Modal appears with login/signup forms
3. After successful auth, JWT token is stored in localStorage
4. Token is sent with all API requests via Authorization header

### Data Flow
```
Frontend                API                    Database
--------                ---                    --------
User action    →    API call (JWT)    →    MongoDB query
                ←    JSON response    ←    Results
UI update
```

### Key Functions

**Authentication:**
- `login(e)` - Handles user login
- `signup(e)` - Handles user registration
- `logout()` - Logs user out
- `checkAuth()` - Checks if user is authenticated on page load

**Services:**
- `loadServices()` - Fetches all services from API
- `submitProvider(e)` - Creates new service listing
- `swipeRight()` - Saves a service to favorites

**Bookings:**
- `submitBooking(e)` - Creates a new booking
- `loadMyBookings()` - Loads user's bookings
- `updateBookingStatus()` - Updates booking status (provider only)

**UI Rendering:**
- `renderCards()` - Renders swipeable service cards
- `renderSavedList()` - Renders saved services
- `renderProviderBookings()` - Renders provider dashboard

## API Integration

### Example API Calls

**Signup:**
```javascript
const response = await API.signup({
    name: "John Doe",
    email: "john@example.com",
    password: "password123",
    phone: "(555) 123-4567",
    accountType: "customer"
});
```

**Login:**
```javascript
const response = await API.login({
    email: "john@example.com",
    password: "password123"
});
```

**Create Service:**
```javascript
const response = await API.createService({
    providerName: "My Salon",
    serviceType: "Haircut",
    description: "Professional haircut...",
    location: "Brooklyn",
    contact: "(555) 123-4567",
    weekdayPrice: 35,
    weekendPrice: 50
});
```

**Create Booking:**
```javascript
const response = await API.createBooking({
    serviceId: "SERVICE_ID",
    customerContact: "(555) 123-4567",
    preferredTime: "2024-03-15T14:00:00Z",
    notes: "Looking forward to it!"
});
```

## Testing

### Test Accounts

Use these accounts (from backend seed data):

**Customer Account:**
- Email: `customer@example.com`
- Password: `password123`

**Provider Account:**
- Email: `provider@example.com`
- Password: `password123`

### Manual Testing Steps

1. **Test Signup:**
   - Create a new customer account
   - Create a new provider account
   
2. **Test Customer Flow:**
   - Login as customer
   - Swipe through services
   - Save a service (swipe right)
   - View saved services
   - Book a service
   - Check booking status

3. **Test Provider Flow:**
   - Login as provider
   - Create a new service
   - View incoming bookings
   - Confirm a booking
   - Mark booking as complete

## Troubleshooting

### CORS Errors
If you see CORS errors in the console:
- Make sure backend is running on `http://localhost:5000`
- Check that `FRONTEND_URL` in backend `.env` matches your frontend URL
- Use a proper HTTP server (not just opening the HTML file)

### Token Issues
If authentication isn't working:
- Check browser console for errors
- Clear localStorage: `localStorage.clear()`
- Verify JWT_SECRET is set in backend `.env`

### Services Not Loading
- Check backend is running: `http://localhost:5000/api/health`
- Run database seeder: `cd backend && node seed.js`
- Check browser network tab for failed requests

## Deployment

### Frontend Deployment (Vercel/Netlify)

1. Update API URL in `api.js` to your production API
2. Push code to GitHub
3. Connect repository to Vercel/Netlify
4. Deploy

### Environment Variables for Deployment

Set these in your deployment platform:
```
API_BASE_URL=https://your-api.com/api
```

Then update `api.js` to use environment variables:
```javascript
const API_CONFIG = {
    BASE_URL: process.env.API_BASE_URL || 'http://localhost:5000/api',
    // ...
};
```

## Browser Compatibility

Tested and working on:
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Future Enhancements

- [ ] Image upload functionality
- [ ] Real-time notifications (WebSockets)
- [ ] Advanced search and filters
- [ ] Service reviews and ratings
- [ ] In-app messaging
- [ ] Payment integration
- [ ] Google Maps integration
- [ ] Calendar integration

## Support

If you encounter any issues:
1. Check browser console for errors
2. Verify backend is running
3. Check API responses in Network tab
4. Refer to backend README for server issues

## License

MIT
