const sgMail = require('@sendgrid/mail');
const twilio = require('twilio');

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@slowdaydeals.com';
const FROM_PHONE = process.env.TWILIO_PHONE_NUMBER;
const APP_URL = process.env.FRONTEND_URL || 'https://www.slowdaydeals.com';
const SITE_NAME = 'www.slowdaydeals.com';

const formatDate = (date) => new Date(date).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long',
    day: 'numeric', hour: '2-digit', minute: '2-digit'
});

const sendEmail = async (to, subject, html) => {
    if (!process.env.SENDGRID_API_KEY || !to || !to.includes('@')) {
        console.log(`[EMAIL SKIPPED] To: ${to}, Subject: ${subject}`);
        return;
    }
    try {
        await sgMail.send({ to, from: { email: FROM_EMAIL, name: 'SlowDay Deals' }, subject, html });
        console.log(`✅ Email sent to ${to}`);
    } catch (err) {
        console.error('❌ Email error:', err.message);
    }
};

const sendSMS = async (to, body) => {
    if (!twilioClient || !FROM_PHONE || !to) {
        console.log(`[SMS SKIPPED] To: ${to}`);
        return;
    }
    try {
        const digits = to.replace(/\D/g, '');
        if (digits.length < 10) return;
        const phone = to.startsWith('+') ? to : `+1${digits}`;
        await twilioClient.messages.create({ body, from: FROM_PHONE, to: phone });
        console.log(`✅ SMS sent to ${phone}`);
    } catch (err) {
        console.error('❌ SMS error:', err.message);
    }
};

const ctaButton = (label, url) => `
<div style="text-align:center;margin:20px 0;">
    <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#667eea,#764ba2);color:white;text-decoration:none;padding:14px 28px;border-radius:25px;font-size:15px;font-weight:700;letter-spacing:0.3px;">
        ${label}
    </a>
</div>`;

const baseTemplate = (content) => `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;background:#f8f9ff;padding:24px;border-radius:16px;">
    <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:24px;border-radius:12px;text-align:center;margin-bottom:20px;">
        <h1 style="color:white;margin:0;font-size:22px;">⚡ SlowDay Deals</h1>
        <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:13px;">Book services at special prices</p>
    </div>
    <div style="background:white;padding:24px;border-radius:12px;">${content}</div>
    <p style="text-align:center;color:#aaa;font-size:12px;margin-top:16px;">SlowDay Deals • <a href="https://www.slowdaydeals.com" style="color:#667eea;text-decoration:none;">www.slowdaydeals.com</a></p>
</div>`;

const bookingTable = (rows) => `
<table style="width:100%;border-collapse:collapse;margin-top:12px;">
    ${rows.map(([label, value, color]) => `
    <tr style="border-bottom:1px solid #f0f0f0;">
        <td style="padding:10px 0;color:#888;font-size:13px;width:40%;">${label}</td>
        <td style="padding:10px 0;font-weight:600;color:${color || '#333'};font-size:14px;">${value}</td>
    </tr>`).join('')}
</table>`;

// ============================================
// NEW BOOKING → Provider
// ============================================
const notifyProviderNewBooking = async (booking, service, customer) => {
    const dateStr = formatDate(booking.preferredTime);
    const providerEmail = service.email || (service.contact?.includes('@') ? service.contact : null);
    const bookingLink = `${APP_URL}?tab=provider&section=bookings`;

    const html = baseTemplate(`
        <div style="text-align:center;margin-bottom:16px;">
            <div style="font-size:44px;">📬</div>
            <h2 style="color:#333;margin:8px 0 4px;">New Booking Request!</h2>
            <p style="color:#888;font-size:13px;">Someone wants to book your service</p>
        </div>
        ${bookingTable([
            ['Service', service.serviceType],
            ['Customer', customer.name],
            ['Contact', booking.customerContact],
            ['Date & Time', dateStr],
            ['Price', `$${booking.price}`, '#667eea'],
            ...(booking.notes ? [['Notes', booking.notes]] : [])
        ])}
        ${ctaButton('View & Confirm Booking →', bookingLink)}
    `);

    await sendEmail(providerEmail, `📬 New Booking – ${service.serviceType}`, html);
    if (service.contact?.match(/^\+?[\d\s\-()+]{7,}$/)) {
        const smsDate = new Date(booking.preferredTime).toLocaleDateString('en-US', {month:'short',day:'numeric'});
        await sendSMS(service.contact,
            `📬 SlowDay: New booking! ${customer.name} wants ${service.serviceType} on ${smsDate}. $${booking.price}. ${APP_URL}?tab=provider`);
    }
};

// ============================================
// CONFIRMED → Customer
// ============================================
const notifyCustomerConfirmed = async (booking, service, customerEmail, customerPhone) => {
    const bookingLink = `${APP_URL}?tab=bookings`;
    const html = baseTemplate(`
        <div style="text-align:center;margin-bottom:16px;">
            <div style="font-size:44px;">✅</div>
            <h2 style="color:#333;margin:8px 0 4px;">Booking Confirmed!</h2>
            <p style="color:#888;font-size:13px;">Your provider has confirmed your appointment</p>
        </div>
        ${bookingTable([
            ['Service', service.serviceType],
            ['Provider', service.providerName],
            ['Location', service.location],
            ['Date & Time', formatDate(booking.preferredTime)],
            ['Price', `$${booking.price}`, '#667eea']
        ])}
        ${ctaButton('View My Booking →', bookingLink)}
    `);
    await sendEmail(customerEmail, `✅ Booking Confirmed – ${service.serviceType}`, html);
    if (customerPhone) {
        const confDate = new Date(booking.preferredTime).toLocaleDateString('en-US', {month:'short',day:'numeric'});
        await sendSMS(customerPhone,
            `✅ SlowDay: Confirmed! ${service.serviceType} on ${confDate}. ${APP_URL}?tab=bookings`);
    }
};

// ============================================
// CANCELLED → Customer & Provider
// ============================================
const notifyCustomerRejected = async (booking, service, customerEmail, customerPhone) => {
    const bookingLink = `${APP_URL}?tab=bookings`;
    const html = baseTemplate(`
        <div style="text-align:center;">
            <div style="font-size:44px;">😔</div>
            <h2 style="color:#333;margin:8px 0 4px;">Booking Unavailable</h2>
            <p style="color:#666;">The provider is unable to take your <strong>${service.serviceType}</strong> booking at this time.</p>
            <p style="color:#888;font-size:13px;margin-top:12px;">Please try booking a different time or browse other providers.</p>
        </div>
        ${ctaButton('Browse Other Services →', APP_URL)}
    `);
    await sendEmail(customerEmail, `Booking Update – ${service.serviceType}`, html);
    if (customerPhone) {
        await sendSMS(customerPhone,
            `😔 SlowDay: Your ${service.serviceType} booking was not available. Browse: ${APP_URL}`);
    }
};

// ============================================
// RESCHEDULED → Customer
// ============================================
const notifyCustomerRescheduled = async (booking, service, customerEmail, customerPhone, newTime) => {
    const dateStr = formatDate(newTime);
    const bookingLink = `${APP_URL}?tab=bookings`;
    const html = baseTemplate(`
        <div style="text-align:center;margin-bottom:16px;">
            <div style="font-size:44px;">🔄</div>
            <h2 style="color:#333;margin:8px 0 4px;">Booking Rescheduled</h2>
            <p style="color:#666;">Your <strong>${service.serviceType}</strong> has been moved to:</p>
            <div style="background:#f0f4ff;padding:16px;border-radius:10px;margin:16px 0;font-size:17px;font-weight:700;color:#667eea;">${dateStr}</div>
        </div>
        ${ctaButton('View My Booking →', bookingLink)}
    `);
    await sendEmail(customerEmail, `🔄 Rescheduled – ${service.serviceType}`, html);
    if (customerPhone) {
        await sendSMS(customerPhone,
            `🔄 SlowDay: ${service.serviceType} rescheduled to ${dateStr}. ${APP_URL}?tab=bookings`);
    }
};

// ============================================
// CANCELLED BY CUSTOMER → Provider
// ============================================
const notifyProviderCancelled = async (booking, service, customer) => {
    const providerEmail = service.email || (service.contact?.includes('@') ? service.contact : null);
    const bookingLink = `${APP_URL}?tab=provider&section=bookings`;
    const html = baseTemplate(`
        <div style="text-align:center;margin-bottom:16px;">
            <div style="font-size:44px;">❌</div>
            <h2 style="color:#333;margin:8px 0 4px;">Booking Cancelled</h2>
            <p style="color:#666;"><strong>${customer.name}</strong> has cancelled their ${service.serviceType} booking for ${formatDate(booking.preferredTime)}.</p>
        </div>
        ${ctaButton('View My Bookings →', bookingLink)}
    `);
    await sendEmail(providerEmail, `❌ Booking Cancelled – ${service.serviceType}`, html);
    if (service.contact?.match(/^\+?[\d\s\-()+]{7,}$/)) {
        await sendSMS(service.contact,
            `❌ SlowDay: ${customer.name} cancelled ${service.serviceType} for ${new Date(booking.preferredTime).toLocaleDateString('en-US',{month:'short',day:'numeric'})}. ${APP_URL}?tab=provider`);
    }
};

module.exports = {
    notifyProviderNewBooking,
    notifyCustomerConfirmed,
    notifyCustomerRejected,
    notifyCustomerRescheduled,
    notifyProviderCancelled
};
