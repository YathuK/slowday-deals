// SlowDay Deals - API Connected Frontend
// This file replaces localStorage with real API calls

// Override the existing functions with API-connected versions

// ============================================
// AUTHENTICATION FUNCTIONS
// ============================================

async function login(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await API.login({ email, password });
        
        if (response.success) {
            // Save token
            API.setToken(response.token);
            currentUser = response.user;
            
            showAuthenticatedView();
            closeAuthModal();
            e.target.reset();
        }
    } catch (error) {
        alert(error.message || 'Login failed. Please check your credentials.');
    }
}

async function signup(e) {
    e.preventDefault();
    
    const userData = {
        name: document.getElementById('signupName').value,
        email: document.getElementById('signupEmail').value,
        password: document.getElementById('signupPassword').value,
        phone: document.getElementById('signupPhone').value,
        accountType: document.getElementById('signupAccountType').value
    };

    try {
        const response = await API.signup(userData);
        
        if (response.success) {
            // Save token
            API.setToken(response.token);
            currentUser = response.user;
            
            showAuthenticatedView();
            closeAuthModal();
            e.target.reset();
            
            alert(`🎉 Welcome to SlowDay Deals, ${currentUser.name}!`);
        }
    } catch (error) {
        alert(error.message || 'Signup failed. Please try again.');
    }
}

function logout() {
    if (confirm('Are you sure you want to log out?')) {
        currentUser = null;
        API.removeToken();
        location.reload();
    }
}

async function showAuthenticatedView() {
    // Show user menu, hide guest menu
    document.getElementById('userMenu').style.display = 'flex';
    document.getElementById('guestMenu').style.display = 'none';
    document.getElementById('userName').textContent = `👋 ${currentUser.name}`;

    // Load user's data
    await loadSavedServices();
    await loadServices();

    // If provider, show provider view by default
    if (currentUser.accountType === 'provider') {
        switchMode('provider');
        await loadMyBookings();
    } else {
        renderCards();
        renderSavedList();
        await loadMyBookings();
    }
}

// ============================================
// SERVICE FUNCTIONS
// ============================================

async function loadServices() {
    try {
        const response = await API.getServices();
        services = response.services || [];
        renderCards();
    } catch (error) {
        console.error('Error loading services:', error);
        services = [];
        renderCards();
    }
}

async function submitProvider(e) {
    e.preventDefault();

    if (!currentUser) {
        alert('Please log in to create a profile');
        return;
    }
    
    const serviceData = {
        providerName: document.getElementById('providerName').value,
        serviceType: document.getElementById('serviceType').value,
        description: document.getElementById('serviceDesc').value,
        location: document.getElementById('location').value,
        contact: document.getElementById('providerContact').value,
        weekdayPrice: parseFloat(document.getElementById('weekdayPrice').value),
        weekendPrice: parseFloat(document.getElementById('weekendPrice').value),
        photos: [] // TODO: Implement photo upload
    };

    try {
        const response = await API.createService(serviceData);
        
        if (response.success) {
            alert('✅ Profile created successfully! Your service is now live for customers to discover.');
            e.target.reset();
            document.getElementById('photoPreview').innerHTML = '';
            
            // Reload services
            await loadServices();
            
            // Switch to customer view to see the new listing
            switchMode('customer');
            currentCardIndex = 0;
            renderCards();
        }
    } catch (error) {
        alert(error.message || 'Error creating service. Please try again.');
    }
}

// ============================================
// SAVED SERVICES FUNCTIONS
// ============================================

async function loadSavedServices() {
    if (!currentUser) {
        savedServices = [];
        return;
    }

    try {
        const response = await API.getSavedServices();
        savedServices = response.services || [];
    } catch (error) {
        console.error('Error loading saved services:', error);
        savedServices = [];
    }
}

async function swipeRight() {
    if (!currentUser) {
        alert('Please log in to save services!');
        showAuthModal();
        swipeCard('right');
        return;
    }
    
    const service = services[currentCardIndex];
    
    try {
        // Check if already saved
        if (!savedServices.find(s => s._id === service._id)) {
            await API.saveService(service._id);
            await loadSavedServices(); // Reload to get updated list
        }
    } catch (error) {
        console.error('Error saving service:', error);
    }
    
    swipeCard('right');
}

async function removeSaved(serviceId) {
    try {
        await API.removeSavedService(serviceId);
        await loadSavedServices();
        renderSavedList();
    } catch (error) {
        alert('Error removing service. Please try again.');
    }
}

// ============================================
// BOOKING FUNCTIONS
// ============================================

async function loadMyBookings() {
    if (!currentUser) return;

    try {
        let response;
        if (currentUser.accountType === 'provider') {
            response = await API.getProviderBookings();
        } else {
            response = await API.getCustomerBookings();
        }
        
        myBookings = response.bookings || [];
        
        // If provider, show bookings dashboard
        if (currentUser.accountType === 'provider') {
            renderProviderBookings();
        }
    } catch (error) {
        console.error('Error loading bookings:', error);
        myBookings = [];
    }
}

async function submitBooking(e) {
    e.preventDefault();

    if (!currentUser) {
        alert('Please log in to book services');
        showAuthModal();
        return;
    }
    
    const bookingData = {
        serviceId: currentBookingService._id,
        customerContact: document.getElementById('customerContact').value,
        preferredTime: document.getElementById('preferredTime').value,
        notes: document.getElementById('bookingNotes').value
    };

    try {
        const response = await API.createBooking(bookingData);
        
        if (response.success) {
            document.getElementById('bookingSuccess').style.display = 'block';
            document.getElementById('bookingSuccess').textContent = response.message;
            e.target.reset();

            // Reload bookings
            await loadMyBookings();

            setTimeout(() => {
                closeBookingModal();
            }, 2000);
        }
    } catch (error) {
        alert(error.message || 'Error creating booking. Please try again.');
    }
}

async function updateBookingStatus(bookingId, status) {
    try {
        const response = await API.updateBookingStatus(bookingId, status);
        
        if (response.success) {
            alert(response.message);
            await loadMyBookings();
        }
    } catch (error) {
        alert(error.message || 'Error updating booking status.');
    }
}

// ============================================
// RENDER FUNCTIONS
// ============================================

function renderSavedList() {
    const savedList = document.getElementById('savedList');
    
    if (savedServices.length === 0) {
        savedList.innerHTML = `
            <div class="no-cards">
                <svg width="60" height="60" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                <h3>No saved services yet</h3>
                <p>Swipe right on services you like!</p>
            </div>
        `;
        return;
    }

    savedList.innerHTML = savedServices.map(service => {
        const serviceId = service._id || service.id;
        const imageContent = service.photos && service.photos[0]
            ? `<img src="${service.photos[0]}" alt="${service.serviceType}">`
            : `<div style="width: 80px; height: 80px; border-radius: 10px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 32px;">${getServiceEmoji(service.serviceType)}</div>`;

        return `
            <div class="saved-card">
                ${imageContent}
                <div class="saved-card-content">
                    <h3>${service.serviceType}</h3>
                    <p>${service.providerName} • ${service.location}</p>
                    <p style="color: #667eea; font-weight: 600;">Weekdays: $${service.weekdayPrice} | Weekends: $${service.weekendPrice}</p>
                    <div class="saved-card-actions">
                        <button class="book-btn-small" onclick="openBookingModalWithService('${serviceId}')">Book</button>
                        <button class="remove-btn" onclick="removeSaved('${serviceId}')">Remove</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function openBookingModalWithService(serviceId) {
    const service = savedServices.find(s => (s._id || s.id) === serviceId) || 
                    services.find(s => (s._id || s.id) === serviceId);
    
    if (service) {
        await openBookingModal(serviceId);
    }
}

function renderProviderBookings() {
    // This is a placeholder - you can expand this to show a provider dashboard
    console.log('Provider bookings:', myBookings);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Update the createCard function to use _id from MongoDB
const originalCreateCard = window.createCard;
window.createCard = function(service, stackPosition) {
    // Replace id with _id for MongoDB documents
    if (service._id && !service.id) {
        service.id = service._id;
    }
    return originalCreateCard ? originalCreateCard(service, stackPosition) : null;
};

// Make sure service IDs are handled correctly throughout
function normalizeServiceId(service) {
    return service._id || service.id;
}

console.log('✅ API-connected frontend loaded');
