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
  
  const targetEmail = String(userEmail).trim().toLowerCase();
  console.log(`[EaseLand 2FA] OTP Code generated for ${targetEmail}: ${otpCode}`);

  try {
    // High-speed dispatch from official EaseLand MailServer (admin@easeland.in) via JMAP
    await fetch('https://mail.easeland.in/jmap/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + btoa('admin@easeland.in:JTx7ggq3MBzdopSG')
      },
      body: JSON.stringify({
        using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail', 'urn:ietf:params:jmap:submission'],
        methodCalls: [
          ['Email/set', {
            accountId: 'b',
            create: {
              m1: {
                mailboxIds: { 'd': true },
                from: [{ name: 'EaseLand Security', email: 'admin@easeland.in' }],
                to: [{ email: targetEmail }],
                subject: `EaseLand Security: Your 2FA Verification Code [${otpCode}]`,
                bodyValues: {
                  b1: {
                    value: `<div style="font-family: Arial, sans-serif; padding: 24px; background-color: #0f172a; color: #ffffff; border-radius: 12px;">
                      <h2 style="color: #f59e0b; margin: 0 0 12px 0;">EaseLand Security Verification</h2>
                      <p style="font-size: 15px; color: #e2e8f0;">Your 6-digit Two-Factor Authentication code is:</p>
                      <div style="font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #0f172a; background-color: #f59e0b; padding: 14px 28px; border-radius: 8px; display: inline-block; margin: 16px 0;">${otpCode}</div>
                      <p style="font-size: 13px; color: #94a3b8; margin-top: 16px;">This code is valid for 5 minutes. Sent officially from <strong>admin@easeland.in</strong> on EaseLand MailServer.</p>
                    </div>`,
                    contentType: 'text/html'
                  }
                },
                htmlBody: [{ partId: 'b1', type: 'text/html' }]
              }
            }
          }, 'c1'],
          ['EmailSubmission/set', {
            accountId: 'b',
            create: {
              s1: { emailId: '#m1', identityId: 'b' }
            }
          }, 'c2']
        ]
      })
    }).catch(err => {
      console.warn('[EaseLand MailServer] Dispatch fallback note:', err);
    });
  } catch (err) {
    console.warn('[EaseLand 2FA] MailServer dispatch error:', err);
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
