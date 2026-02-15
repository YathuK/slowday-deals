# SlowDay Deals - User Experience Flows

## 1. CUSTOMER JOURNEY

### A. Account Creation & Login
```
┌─────────────────┐
│  Landing Page   │
└────────┬────────┘
         │
         ├─→ Click "Login/Sign Up" (circular button)
         │
         ▼
┌─────────────────┐
│  Auth Modal     │
│                 │
│  [Login] [Signup] ← Toggle tabs
│                 │
│  Signup Form:   │
│  • Account Type │ ← Select "Customer"
│  • Name         │
│  • Email        │
│  • Password     │
│  • Phone        │
│                 │
│  [Create Account]│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Success!        │
│ JWT Token saved │
│ User logged in  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Main App View   │
│ Name in header  │
└─────────────────┘
```

### B. Browsing & Swiping Services
```
┌─────────────────┐
│  Discover Tab   │ ← Default view
│                 │
│  ┌───────────┐  │
│  │ Service   │  │ ← Card shows:
│  │ Card      │  │   - Photo
│  │           │  │   - Service type
│  │ $35 | $50 │  │   - Provider name
│  └───────────┘  │   - Weekday/Weekend price
│                 │   - Description
│  [❌] [ℹ️] [❤️]  │ ← Action buttons
└─────────────────┘

Actions:
• Swipe Left / Tap ❌  → Skip service
• Tap ℹ️              → View full details
• Swipe Right / Tap ❤️ → Save service
```

### C. Booking a Service
```
┌─────────────────┐
│  Card / Detail  │
│     View        │
└────────┬────────┘
         │
         ├─→ Tap "Book Now"
         │
         ▼
┌─────────────────┐
│ Booking Modal   │
│                 │
│ Your Name:      │ ← Pre-filled
│ [Jane Customer] │
│                 │
│ Contact:        │
│ [(555) 111-2222]│
│                 │
│ Preferred Time: │
│ [Date picker]   │ ← Choose date/time
│                 │
│ Notes:          │
│ [Text area]     │ ← Optional
│                 │
│ Price: $35      │ ← Auto-calculated
│                 │   (weekday/weekend)
│ [Confirm Booking]│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   ✅ Success!   │
│                 │
│ Booking sent!   │
│ Provider will   │
│ contact you soon│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Booking appears │
│ in "My Bookings"│
│ Status: PENDING │
└─────────────────┘
```

### D. Viewing Bookings
```
┌─────────────────────────┐
│   My Bookings Tab       │
│                         │
│ ┌─────────────────────┐ │
│ │ 📅 Haircut          │ │
│ │ Sarah's Hair Studio │ │
│ │                     │ │
│ │ Status: PENDING 🟡  │ │ ← Changes color by status
│ │ Date: Mar 15, 2PM   │ │
│ │ Price: $35          │ │
│ │                     │ │
│ │ [View Details]      │ │
│ │ [Cancel]            │ │
│ └─────────────────────┘ │
│                         │
│ ┌─────────────────────┐ │
│ │ 📅 Cleaning         │ │
│ │ Status: CONFIRMED ✅│ │
│ └─────────────────────┘ │
└─────────────────────────┘

Status Colors:
🟡 PENDING    - Awaiting provider confirmation
✅ CONFIRMED  - Provider confirmed appointment
✔️ COMPLETED  - Service finished
❌ CANCELLED  - Booking cancelled
```

---

## 2. PROVIDER JOURNEY

### A. Account Creation & Login
```
┌─────────────────┐
│  Landing Page   │
└────────┬────────┘
         │
         ├─→ Click "Login/Sign Up"
         │
         ▼
┌─────────────────┐
│  Auth Modal     │
│                 │
│  Signup Form:   │
│  • Account Type │ ← Select "Provider"
│  • Name         │
│  • Email        │
│  • Password     │
│  • Phone        │
│                 │
│  [Create Account]│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Provider View   │ ← Auto-redirected
│ Create Profile  │
└─────────────────┘
```

### B. Creating Service Profile
```
┌─────────────────────────┐
│  "I'm a Provider" Tab   │
│                         │
│ Provider Form:          │
│                         │
│ Business Name:          │
│ [Sarah's Hair Studio]   │
│                         │
│ Service Type:           │
│ [Dropdown: Haircut ▼]   │
│                         │
│ Description:            │
│ [Text area...]          │
│                         │
│ Location:               │
│ [Brooklyn]              │
│                         │
│ Contact:                │
│ [(555) 123-4567]        │
│                         │
│ Pricing:                │
│ Weekdays: [$35]         │
│ Weekends: [$50]         │
│                         │
│ Photos:                 │
│ [📷 Upload photos]      │ ← Up to 6 photos
│ [▢][▢][▢][▢][▢][▢]      │
│                         │
│ [Create My Profile]     │
└────────┬────────────────┘
         │
         ▼
┌─────────────────┐
│   ✅ Success!   │
│                 │
│ Service is live!│
│ Customers can   │
│ now find you    │
└─────────────────┘
```

### C. Managing Bookings
```
┌─────────────────────────────┐
│  Provider Dashboard         │
│                             │
│  📊 Statistics:             │
│  • Total Bookings: 12       │
│  • Pending: 3               │
│  • Confirmed: 5             │
│  • Completed: 4             │
│  • Revenue: $540            │
│                             │
│  📋 Recent Bookings:        │
│  ┌─────────────────────────┐│
│  │ 🆕 New Booking!         ││
│  │ Jane Customer           ││
│  │ Haircut - $35           ││
│  │ Mar 15, 2024 at 2PM     ││
│  │ Phone: (555) 111-2222   ││
│  │ Notes: "First time!"    ││
│  │                         ││
│  │ Status: PENDING 🟡      ││
│  │                         ││
│  │ [Confirm] [Decline]     ││ ← Actions
│  └─────────────────────────┘│
│                             │
│  ┌─────────────────────────┐│
│  │ Mike Johnson            ││
│  │ Status: CONFIRMED ✅    ││
│  │ Mar 12, 10AM            ││
│  │ [Mark Complete]         ││
│  └─────────────────────────┘│
└─────────────────────────────┘
```

### D. Booking Status Updates
```
Provider Actions → Customer Sees:

1. New Booking Created
   Provider: Sees "PENDING 🟡"
   Customer: Sees "PENDING 🟡"
   
2. Provider Confirms
   Provider: Clicks [Confirm]
   Customer: Status → "CONFIRMED ✅"
   
3. Service Completed
   Provider: Clicks [Mark Complete]
   Customer: Status → "COMPLETED ✔️"
   
4. Cancellation
   Provider OR Customer: Clicks [Cancel]
   Both: Status → "CANCELLED ❌"
```

---

## 3. REAL-TIME NOTIFICATIONS (Future Enhancement)

```
┌─────────────────────────┐
│  Customer Experience    │
│                         │
│  You swipe right ❤️     │
│  ↓                      │
│  Service saved          │
│                         │
│  You book service       │
│  ↓                      │
│  "Booking submitted!"   │
│  ↓                      │
│  [Wait for provider]    │
│  ↓                      │
│  🔔 "Booking confirmed!"│
│  ↓                      │
│  [Service day]          │
│  ↓                      │
│  🔔 "Service completed!"│
└─────────────────────────┘

┌─────────────────────────┐
│  Provider Experience    │
│                         │
│  🔔 "New booking!"      │
│  ↓                      │
│  Review details         │
│  ↓                      │
│  Click [Confirm]        │
│  ↓                      │
│  Customer notified      │
│  ↓                      │
│  [Service day]          │
│  ↓                      │
│  Click [Mark Complete]  │
│  ↓                      │
│  Customer notified      │
│  💰 Revenue tracked     │
└─────────────────────────┘
```

---

## 4. KEY UI STATES

### Saved Services Tab
```
┌─────────────────────────┐
│   Saved Services        │
│                         │
│ ┌─────────────────────┐ │
│ │ [Photo] Haircut     │ │
│ │ Sarah's Studio      │ │
│ │ Brooklyn            │ │
│ │ $35 | $50           │ │
│ │ [Book] [Remove]     │ │
│ └─────────────────────┘ │
│                         │
│ ┌─────────────────────┐ │
│ │ [Photo] Massage     │ │
│ │ ...                 │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

### Empty States
```
No Services Yet:
┌─────────────────┐
│      💫         │
│                 │
│ No more services│
│ Check back soon!│
└─────────────────┘

No Saved Services:
┌─────────────────┐
│      ❤️         │
│                 │
│ No saved yet    │
│ Swipe right on  │
│ services you    │
│ like!           │
└─────────────────┘

No Bookings Yet:
┌─────────────────┐
│      📅         │
│                 │
│ No bookings yet │
│ Start browsing! │
└─────────────────┘
```

---

## 5. MOBILE-FIRST DESIGN

All screens are optimized for mobile:
- Touch-friendly buttons (min 44px)
- Swipe gestures work naturally
- Bottom navigation for thumbs
- Full-screen modals
- Large, readable text
- High contrast colors

Desktop view adds:
- Centered container (max 500px)
- Shadow effects
- Hover states
- Side margins
