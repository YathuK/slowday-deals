// API Configuration
const API_CONFIG = {
    BASE_URL: 'https://slowday-deals.onrender.com/api',
    
    ENDPOINTS: {
        // Auth
        SIGNUP: '/auth/signup',
        LOGIN: '/auth/login',
        ME: '/auth/me',
        
        // Services
        SERVICES: '/services',
        MY_SERVICES: '/services/provider/my-services',
        
        // Bookings
        BOOKINGS: '/bookings',
        CUSTOMER_BOOKINGS: '/bookings/customer',
        PROVIDER_BOOKINGS: '/bookings/provider',
        BOOKING_STATUS: '/bookings/:id/status',
        
        // Users
        PROFILE: '/users/profile',
        SAVED_SERVICES: '/users/saved-services',

        // SSO
        GOOGLE_AUTH: '/auth/google',
        FACEBOOK_AUTH: '/auth/facebook'
    }
};

// API Helper Functions
const API = {
    // Get auth token from localStorage
    getToken() {
        return localStorage.getItem('token');
    },
    
    // Set auth token
    setToken(token) {
        localStorage.setItem('token', token);
    },
    
    // Remove auth token
    removeToken() {
        localStorage.removeItem('token');
    },
    
    // Get headers with auth token
    getHeaders(includeAuth = true) {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (includeAuth) {
            const token = this.getToken();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }
        
        return headers;
    },
    
    // Generic API call
    async call(endpoint, method = 'GET', data = null, includeAuth = true) {
        const url = `${API_CONFIG.BASE_URL}${endpoint}`;
        
        const options = {
            method,
            headers: this.getHeaders(includeAuth)
        };
        
        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            options.body = JSON.stringify(data);
        }
        
        try {
            const response = await fetch(url, options);
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || 'API request failed');
            }
            
            return result;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },
    
    // Auth methods
    async signup(userData) {
        return await this.call(API_CONFIG.ENDPOINTS.SIGNUP, 'POST', userData, false);
    },
    
    async login(credentials) {
        return await this.call(API_CONFIG.ENDPOINTS.LOGIN, 'POST', credentials, false);
    },
    
    async getCurrentUser() {
        return await this.call(API_CONFIG.ENDPOINTS.ME);
    },
    
    // Service methods
    async getServices(filters = {}) {
        const queryString = new URLSearchParams(filters).toString();
        const endpoint = queryString 
            ? `${API_CONFIG.ENDPOINTS.SERVICES}?${queryString}`
            : API_CONFIG.ENDPOINTS.SERVICES;
        return await this.call(endpoint, 'GET', null, false);
    },
    
    async getService(id) {
        return await this.call(`${API_CONFIG.ENDPOINTS.SERVICES}/${id}`, 'GET', null, false);
    },
    
    async createService(serviceData) {
        return await this.call(API_CONFIG.ENDPOINTS.SERVICES, 'POST', serviceData);
    },
    
    async updateService(id, serviceData) {
        return await this.call(`${API_CONFIG.ENDPOINTS.SERVICES}/${id}`, 'PUT', serviceData);
    },
    
    async deleteService(id) {
        return await this.call(`${API_CONFIG.ENDPOINTS.SERVICES}/${id}`, 'DELETE');
    },
    
    async getMyServices() {
        return await this.call(API_CONFIG.ENDPOINTS.MY_SERVICES);
    },
    
    // Booking methods
    async createBooking(bookingData) {
        return await this.call(API_CONFIG.ENDPOINTS.BOOKINGS, 'POST', bookingData);
    },
    
    async getCustomerBookings(status = null) {
        const endpoint = status 
            ? `${API_CONFIG.ENDPOINTS.CUSTOMER_BOOKINGS}?status=${status}`
            : API_CONFIG.ENDPOINTS.CUSTOMER_BOOKINGS;
        return await this.call(endpoint);
    },
    
    async getProviderBookings(status = null) {
        const endpoint = status
            ? `${API_CONFIG.ENDPOINTS.PROVIDER_BOOKINGS}?status=${status}`
            : API_CONFIG.ENDPOINTS.PROVIDER_BOOKINGS;
        return await this.call(endpoint);
    },

    async getAnalytics() {
        return await this.call('/bookings/analytics');
    },
    
    async updateBookingStatus(id, status, newTime = null) {
        return await this.call(
            API_CONFIG.ENDPOINTS.BOOKING_STATUS.replace(':id', id),
            'PUT',
            { status, newTime }
        );
    },
    
    // User methods
    async saveService(serviceId) {
        return await this.call(`${API_CONFIG.ENDPOINTS.SAVED_SERVICES}/${serviceId}`, 'POST');
    },
    
    async removeSavedService(serviceId) {
        return await this.call(`${API_CONFIG.ENDPOINTS.SAVED_SERVICES}/${serviceId}`, 'DELETE');
    },
    
    async getSavedServices() {
        return await this.call(API_CONFIG.ENDPOINTS.SAVED_SERVICES);
    },
    
    async updateProfile(profileData) {
        return await this.call(API_CONFIG.ENDPOINTS.PROFILE, 'PUT', profileData);
    },

    async deleteAccount() {
        return await this.call('/users/account', 'DELETE');
    },

    async changePassword(currentPassword, newPassword) {
        return await this.call('/users/password', 'PUT', { currentPassword, newPassword });
    },

    async forgotPassword(emailOrPhone) {
        return await this.call('/auth/forgot-password', 'POST', { emailOrPhone });
    },

    async resetPassword(token, password) {
        return await this.call('/auth/reset-password', 'POST', { token, password });
    },

    async getSavingsLeaderboard() {
        return await this.call('/leaderboard/savings');
    },

    async getSubscriptionStatus() {
        return await this.call('/subscription/status');
    },

    async startSubscription() {
        return await this.call('/subscription/checkout', 'POST');
    },

    async cancelSubscription() {
        return await this.call('/subscription/cancel', 'POST');
    },

    // SSO methods
    async googleAuth(idToken) {
        return await this.call(API_CONFIG.ENDPOINTS.GOOGLE_AUTH, 'POST', { idToken }, false);
    },

    async facebookAuth(accessToken) {
        return await this.call(API_CONFIG.ENDPOINTS.FACEBOOK_AUTH, 'POST', { accessToken }, false);
    }
};
