# Nexus — Official Privacy Policy

**Effective Date:** September 2026  
**Application Name:** Nexus (Nexus Royal)  
**Developer / Data Controller:** Karthiswaran k 
**Contact Email:** karthikarthiswaran50@gmail.com  
**Website / Web App:** https://nexusroyal.online  
**Privacy URL:** https://nexusroyal.online/privacy  

---

## 1. Overview & Commitment to User Privacy

Nexus is an ultra-secure, private real-time communication platform offering Ultra-HD peer-to-peer audio/video calling, private messaging, file sharing, and community networking. 

Nexus is **100% Free Forever ♾️** with **NO advertisements, NO subscriptions, NO paywalls, and NO sale or rental of user data to third parties or data brokers**.

We designed Nexus under the **"Privacy Shield"** philosophy:
- **Hidden Community Directory:** User directories are strictly protected. User profiles and contact details are NEVER publicly discoverable or browseable by default; they appear ONLY after an explicit search query.
- **Peer-to-Peer Calling:** Voice and video calls are negotiated peer-to-peer via WebRTC and are **never recorded, monitored, or stored** on our servers.
- **User Granular Controls:** Users have full control over who sees their Last Seen status, Online Presence, and Profile Picture.

---

## 2. Information We Collect

We collect only the minimal data required to provide seamless real-time messaging and calling:

### A. Account Credentials & Profile
- When you register or sign in via Google Authentication, we collect your verified email address, display name, chosen `@username`, and profile picture avatar.
- Passwords (if manually registered) are cryptographically salted and hashed using `bcrypt` (12 rounds) prior to database insertion. We never store or have access to plain-text passwords.

### B. Messages & Content
- Chat messages, media attachments (images, voice notes, files), emoji reactions, and timestamps are transmitted via encrypted WebSocket connections and stored in our database so you can access your conversation history across your devices.

### C. Audio and Video Calls (WebRTC)
- When placing or receiving an audio or video call, signaling data (SDP offers/answers and ICE candidates) is exchanged transiently to establish a direct peer-to-peer connection between call participants.
- Once connected, media streams flow directly between devices using DTLS-SRTP encryption. **Nexus servers never record, intercept, tap, or store audio or video streams.**

### D. Device and Notification Tokens
- When notification permissions are granted, we store a secure Firebase Cloud Messaging (FCM) or Web Push token associated with your account to deliver background incoming call rings and message notifications when your app is minimized or device is locked.

---

## 3. Device Permissions & Android Justification

Nexus requests Android permissions strictly on-demand when user actions require them:

| Android Permission | Justification & Usage |
|---|---|
| `android.permission.CAMERA` | Used exclusively to stream your video during active peer-to-peer video calls, record 24-hour stories, or take a profile photo. |
| `android.permission.RECORD_AUDIO` | Used exclusively to capture your microphone audio during voice/video calls and when recording voice messages. |
| `android.permission.POST_NOTIFICATIONS` | Used to trigger high-priority incoming call alerts, vibration, and new message preview notifications. |
| `android.permission.READ_MEDIA_IMAGES` / File Access | Used strictly when you explicitly select photos, videos, or documents to share in a conversation. |

You can review or revoke these permissions at any time through Android System Settings → Apps → Nexus → Permissions.

---

## 4. Third-Party Service Providers

To guarantee global reliability and low-latency delivery, Nexus utilizes trusted, enterprise-grade cloud partners:

- **Google Firebase:** Used for Google OAuth login and Firebase Cloud Messaging (FCM) background push notifications. ([Google Privacy Policy](https://policies.google.com/privacy))
- **Render.com & Supabase PostgreSQL:** Hosted in secure, ISO-27001 certified data centers with SSL/TLS encryption for database persistence.
- **WebRTC STUN/TURN Relays (OpenRelay / Metered):** Facilitates NAT/firewall traversal for peer-to-peer media connections without retaining packet payloads.

We do NOT integrate third-party ad networks, tracking SDKs, or analytics aggregators.

---

## 5. User Data Deletion & Account Erasure Policy

In strict adherence to Google Play Store requirements:

### How to Delete Your Account In-App:
1. Open the Nexus application.
2. Tap **Settings** in the bottom navigation.
3. Scroll to **Account & Sessions (Danger Zone)**.
4. Tap **Delete Account Permanently**, type `DELETE` to confirm.
5. All your user profile data, credentials, conversations, messages, media files, call logs, and push tokens are instantly and permanently erased from all production databases and caches.

### How to Request Account Deletion Externally (Web Portal):
- **Online Deletion Form:** You can submit an immediate account and data deletion request at any time without installing or logging into the app at our public portal: **https://nexusroyal.online/delete-account**.
- **Direct Email:** You may also email our Data Controller at **karthikarthiswaran50@gmail.com** with the subject *"Nexus Data Deletion Request"*, specifying your registered email address or `@username`. Manual requests are verified and fulfilled within 48 hours.

---

## 6. Children's Privacy (COPPA)

Nexus is not designed for or targeted at children under 13 years of age (or under 16 in the EEA). We do not knowingly collect personal information from children. If we become aware that a child has created an account without parental consent, we take immediate action to terminate the account and purge their data.

---

## 7. Security Standards

We enforce modern security best practices:
- Full HTTPS / TLS 1.3 encryption across all REST and WebSocket connections.
- Helmet security headers and strict Content Security Policy.
- Rate limiting to defend against brute-force attacks and DDoS.
- Secure, salted `bcrypt` password hashing.
- Sandboxed file storage for user attachments.

---

## 8. Updates to this Policy

We may periodically update this Privacy Policy to reflect service enhancements or regulatory updates. Any changes will be published directly at https://nexusroyal.online/privacy.

---

## 9. Contact Us

If you have any questions, feedback, or data privacy requests, contact:
- **Developer:** Karthiswaran k
- **Email:** karthikarthiswaran50@gmail.com
- **Repository:** https://github.com/karthikarthiswaran50-cmyk/nexus-app
