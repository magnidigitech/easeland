import React, { useEffect } from 'react';
import { ShieldCheck, Lock, Eye, Server, UserCheck, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function PrivacyPolicyPage({ onBackToHome }) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-brand-offwhite pb-20">
      {/* HEADER BAR */}
      <div className="bg-brand-charcoal text-white py-14 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="max-w-4xl mx-auto relative z-10">
          <button
            onClick={() => onBackToHome ? onBackToHome() : (window.location.href = '/')}
            className="inline-flex items-center gap-2 text-xs font-bold text-brand-yellow hover:text-white bg-white/10 px-3.5 py-1.5 rounded-full border border-white/15 transition-all mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to EaseLand Homepage
          </button>

          <div className="flex items-center gap-2 text-brand-yellow font-extrabold text-xs uppercase tracking-widest mb-2">
            <ShieldCheck className="w-5 h-5 text-brand-yellow" />
            <span>Official Legal & Privacy Documentation</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
            Privacy Policy & Data Security
          </h1>

          <p className="text-sm text-gray-300 max-w-2xl font-medium">
            At EaseLand (https://easeland.in), we prioritize transparency, data privacy, and secure account management for all property owners, buyers, and tenants.
          </p>

          <div className="mt-4 text-[11px] text-gray-400 font-mono">
            Last Updated & Effective Date: September 17, 2026 | Official URL: https://easeland.in/privacy-policy
          </div>
        </div>
      </div>

      {/* POLICY CONTENT MAIN BODY */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
        <div className="bg-white rounded-2xl border border-brand-bordergray shadow-lg p-6 sm:p-10 space-y-10 text-brand-charcoal">

          {/* HIGHLIGHT BOX */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-start gap-4">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-emerald-900">Zero Brokerage & Zero Data Monitization Policy</h3>
              <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                EaseLand is built as a direct owner-to-customer property discovery platform. We NEVER sell, rent, trade, or share your personal profile data, email address, or contact numbers with real estate agencies, brokers, telemarketers, or third-party lead aggregators.
              </p>
            </div>
          </div>

          {/* SECTION 1 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-brand-charcoal font-black text-lg">
              <Eye className="w-5 h-5 text-brand-yellow stroke-[2.5]" />
              <h2>1. Information We Collect</h2>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed font-medium">
              To operate a secure real-estate marketplace and enable authentic buyer-owner interactions, EaseLand collects specific personal and property details:
            </p>
            <ul className="list-disc list-inside space-y-2 text-xs text-gray-600 font-medium pl-2">
              <li>
                <strong className="text-brand-charcoal">Google Account Profile Data (OAuth):</strong> When you sign up or sign in using Google Single Sign-On, we collect your full name, primary email address, unique Google User ID (UID), and profile picture URL.
              </li>
              <li>
                <strong className="text-brand-charcoal">Property Listing Information:</strong> If you post a property listing as an owner or admin, we collect property titles, spatial coordinates (latitude & longitude), boundary geometries, location addresses, photos, property descriptions, and title ownership proof documents uploaded for platform verification.
              </li>
              <li>
                <strong className="text-brand-charcoal">Communication & Inquiry Details:</strong> Messages, site visit requests, and contact inquiries submitted by prospective buyers or tenants to property owners.
              </li>
              <li>
                <strong className="text-brand-charcoal">Technical & Usage Logs:</strong> IP address, device type, browser specifications, and cookie data to prevent session hijacking and bot attacks.
              </li>
            </ul>
          </section>

          {/* SECTION 2 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-brand-charcoal font-black text-lg">
              <Server className="w-5 h-5 text-brand-yellow stroke-[2.5]" />
              <h2>2. How We Use Your Information</h2>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed font-medium">
              We process your data strictly to fulfill platform operations and deliver direct real-estate services:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-1">
                <span className="text-xs font-bold text-brand-charcoal block">Authentication & Security</span>
                <p className="text-[11px] text-gray-500">To authenticate your identity, prevent fraudulent duplicate registrations, and manage secure session tokens.</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-1">
                <span className="text-xs font-bold text-brand-charcoal block">Direct Connection</span>
                <p className="text-[11px] text-gray-500">To connect verified buyers directly with property owners without intermediary brokerage intervention.</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-1">
                <span className="text-xs font-bold text-brand-charcoal block">Property Verification</span>
                <p className="text-[11px] text-gray-500">To conduct title checks, verify property plot boundaries on Google Maps Platform, and audit listings.</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-1">
                <span className="text-xs font-bold text-brand-charcoal block">Platform Improvement</span>
                <p className="text-[11px] text-gray-500">To optimize map rendering, search filters, and property recommendation algorithms across Pan-India localities.</p>
              </div>
            </div>
          </section>

          {/* SECTION 3 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-brand-charcoal font-black text-lg">
              <Lock className="w-5 h-5 text-brand-yellow stroke-[2.5]" />
              <h2>3. Data Protection, Storage & Encryption</h2>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed font-medium">
              All user account information and property documents are stored in industry-standard Google Cloud Infrastructure (Firebase Firestore and Storage) protected by multi-tenant isolation rules, SSL/TLS encryption in transit, and AES-256 encryption at rest. Confidential property documents uploaded during the verification process are restricted exclusively to authorized EaseLand audit personnel.
            </p>
          </section>

          {/* SECTION 4 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-brand-charcoal font-black text-lg">
              <UserCheck className="w-5 h-5 text-brand-yellow stroke-[2.5]" />
              <h2>4. User Rights, Account Control & Data Deletion</h2>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed font-medium">
              You maintain complete control over your personal information on EaseLand:
            </p>
            <ul className="list-disc list-inside space-y-2 text-xs text-gray-600 font-medium pl-2">
              <li>
                <strong className="text-brand-charcoal">Profile Modification:</strong> You can edit your display name, phone number, and city preferences at any time via the User Dashboard Account Settings.
              </li>
              <li>
                <strong className="text-brand-charcoal">Property Unlisting & Removal:</strong> You can delete or archive your posted property listings instantly from your dashboard.
              </li>
              <li>
                <strong className="text-brand-charcoal">Complete Account & Data Erasure:</strong> To request permanent deletion of your account, Google profile records, and all linked property data, email our Data Protection Officer at <a href="mailto:admin@easeland.in" className="text-blue-600 font-bold underline">admin@easeland.in</a>. All associated records will be permanently expunged within 48 hours.
              </li>
            </ul>
          </section>

          {/* SECTION 5 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-brand-charcoal font-black text-lg">
              <Mail className="w-5 h-5 text-brand-yellow stroke-[2.5]" />
              <h2>5. Contact Us & Privacy Inquiries</h2>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed font-medium">
              If you have any questions, concerns, or privacy requests regarding this Privacy Policy or how your data is handled on EaseLand, please reach out to us:
            </p>
            <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 text-xs space-y-1.5 font-medium">
              <div className="font-bold text-brand-charcoal text-sm">EaseLand Platform Support & Data Governance</div>
              <div>Official Website: <a href="https://easeland.in" className="text-blue-600 font-bold underline">https://easeland.in</a></div>
              <div>Privacy Policy Page: <a href="https://easeland.in/privacy-policy" className="text-blue-600 font-bold underline">https://easeland.in/privacy-policy</a></div>
              <div>Official Support Email: <a href="mailto:admin@easeland.in" className="text-blue-600 font-bold underline">admin@easeland.in</a></div>
              <div>Location: Guntur, Andhra Pradesh, India</div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
