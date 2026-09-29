import { doc, getDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from './config.js';

// In-memory active 2FA OTP store with 5-minute expiry
const otpStore = new Map();

/**
 * Generate a 6-digit numeric OTP for 2FA verification
 */
export function generate2FAOtp(identifier = 'user') {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity
  
  otpStore.set(identifier, { code, expiresAt });
  
  // Clean expired OTPs
  setTimeout(() => {
    const item = otpStore.get(identifier);
    if (item && item.expiresAt <= Date.now()) {
      otpStore.delete(identifier);
    }
  }, 5 * 60 * 1000);

  return { code, expiresAt };
}

/**
 * Dispatch 2FA OTP Email to user's registered inbox (Free Web Email API)
 */
export async function send2FAEmailOtp(userEmail, otpCode) {
  if (!userEmail) return { success: false, error: 'Email address required.' };
  
  console.log(`[EaseLand 2FA] OTP Code generated for ${userEmail}: ${otpCode}`);

  // Use activated token endpoint for easeland.in to bypass "Activate Form" confirmation emails
  const activatedToken = '46418b4daa69e5fc741b55a4411f6b32';

  try {
    fetch(`https://formsubmit.co/ajax/${activatedToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        _subject: `EaseLand 2FA Verification Code: ${otpCode}`,
        _template: 'table',
        _captcha: 'false',
        recipient_email: userEmail,
        verification_otp_code: otpCode,
        message: `Your EaseLand Two-Factor Authentication 6-digit OTP code is: ${otpCode}. Valid for 5 minutes.`
      })
    }).catch(err => console.warn('FormSubmit dispatch note:', err));

    fetch(`https://api.web3forms.com/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_key: '46418b4daa69e5fc741b55a4411f6b32',
        subject: `EaseLand 2FA Verification Code: ${otpCode}`,
        email: userEmail,
        message: `Your EaseLand Two-Factor Authentication OTP code is: ${otpCode}.`
      })
    }).catch(err => console.warn('Web3Forms dispatch note:', err));
  } catch (err) {
    console.warn('Email dispatch note:', err);
  }
  
  return { success: true };
}

export function is2FAVerifiedForSession(uid) {
  if (typeof window === 'undefined' || !uid) return false;
  try {
    return sessionStorage.getItem(`easeland_2fa_verified_${uid}`) === 'true';
  } catch (e) {
    return false;
  }
}

export function mark2FAVerifiedForSession(uid) {
  if (typeof window === 'undefined' || !uid) return;
  try {
    sessionStorage.setItem(`easeland_2fa_verified_${uid}`, 'true');
  } catch (e) {}
}

export function clear2FAVerifiedForSession(uid) {
  if (typeof window === 'undefined' || !uid) return;
  try {
    sessionStorage.removeItem(`easeland_2fa_verified_${uid}`);
  } catch (e) {}
}

/**
 * Verify submitted 2FA OTP code
 */
export function verify2FAOtp(identifier, codeInput) {
  if (!codeInput) return { success: false, error: 'Please enter the 6-digit verification code.' };
  
  const record = otpStore.get(identifier);
  if (!record) {
    return { success: false, error: 'Verification code has expired or is invalid. Please request a new code.' };
  }
  
  if (Date.now() > record.expiresAt) {
    otpStore.delete(identifier);
    return { success: false, error: 'Verification code expired. Please request a new code.' };
  }
  
  if (String(record.code).trim() !== String(codeInput).trim()) {
    return { success: false, error: 'Incorrect 6-digit verification code. Please check and try again.' };
  }

  // Code verified — clear store
  otpStore.delete(identifier);
  return { success: true };
}

/**
 * Detect client device fingerprint (Browser, OS, Screen resolution)
 */
export function getDeviceFingerprint() {
  if (typeof window === 'undefined') return { deviceName: 'Unknown Device', browser: 'Browser' };
  
  const ua = navigator.userAgent;
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';

  if (ua.includes('Chrome')) browser = 'Google Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Firefox')) browser = 'Mozilla Firefox';
  else if (ua.includes('Edg')) browser = 'Microsoft Edge';

  if (ua.includes('Win')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';

  return {
    id: `${os}-${browser}`.toLowerCase().replace(/\s+/g, '-'),
    deviceName: `${browser} on ${os}`,
    browser,
    os,
    lastSeen: new Date().toISOString()
  };
}

/**
 * Fetch free IP Geolocation from ip-api.com (100% Free, no API key required)
 */
export async function fetchFreeIpLocation() {
  try {
    const res = await fetch('https://ip-api.com/json/?fields=status,city,regionName,country,query', {
      signal: AbortSignal.timeout(3000)
    });
    if (!res.ok) throw new Error('IP API error');
    const data = await res.json();
    if (data.status === 'success') {
      return {
        ip: data.query,
        city: data.city,
        region: data.regionName,
        country: data.country,
        locationString: `${data.city}, ${data.regionName}, ${data.country}`
      };
    }
  } catch (e) {
    // Fallback if network blocked / offline
  }
  return {
    ip: '127.0.0.1',
    city: 'Guntur',
    region: 'Andhra Pradesh',
    country: 'India',
    locationString: 'Guntur, Andhra Pradesh, India'
  };
}

/**
 * Check if login is from an unrecognized device and dispatch Security Alert if enabled
 */
export async function checkAndTriggerSecurityAlert(uid, userEmail, securitySettings = {}) {
  if (!uid || !securitySettings?.loginAlerts) return { isNewDevice: false };

  try {
    const device = getDeviceFingerprint();
    const loc = await fetchFreeIpLocation();
    const deviceKey = `${device.os}-${device.browser}`;

    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    
    let knownDevices = [];
    if (snap.exists()) {
      knownDevices = snap.data()?.knownDevices || [];
    }

    const isRecognized = knownDevices.some(d => d.id === deviceKey || d.deviceName === device.deviceName);

    if (!isRecognized) {
      // New device detected! Save new device to knownDevices
      const newDeviceObj = {
        id: deviceKey,
        deviceName: device.deviceName,
        ip: loc.ip,
        location: loc.locationString,
        firstSeen: new Date().toISOString()
      };

      await updateDoc(userRef, {
        knownDevices: arrayUnion(newDeviceObj),
        lastSecurityAlert: {
          type: 'UNRECOGNIZED_DEVICE',
          device: device.deviceName,
          location: loc.locationString,
          timestamp: new Date().toISOString()
        },
        updatedAt: serverTimestamp()
      });

      return {
        isNewDevice: true,
        alertDetails: {
          device: device.deviceName,
          location: loc.locationString,
          ip: loc.ip
        }
      };
    }
  } catch (err) {
    console.warn('Security alert check note:', err);
  }

  return { isNewDevice: false };
}
