import crypto from 'node:crypto';

export interface RTCIceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export function getIceServers(): RTCIceServerConfig[] {
  const servers: RTCIceServerConfig[] = [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302',
        'stun:global.stun.twilio.com:3478',
      ],
    },
  ];

  // 1. Check for custom configured TURN Server
  const turnUrl = process.env.TURN_URL;
  const turnUsername = process.env.TURN_USERNAME;
  const turnCredential = process.env.TURN_CREDENTIAL;
  const turnSecret = process.env.TURN_SECRET;

  if (turnUrl) {
    if (turnSecret) {
      // Dynamic HMAC token generation (standard ephemeral TURN authentication)
      const expiry = Math.floor(Date.now() / 1000) + 24 * 3600; // 24 hours
      const username = `${expiry}:${turnUsername || 'nexus_user'}`;
      const hmac = crypto.createHmac('sha1', turnSecret);
      hmac.update(username);
      const credential = hmac.digest('base64');

      servers.push({
        urls: [turnUrl, turnUrl.replace('turn:', 'turns:')],
        username,
        credential,
      });
    } else if (turnUsername && turnCredential) {
      // Static TURN credentials
      servers.push({
        urls: [turnUrl, turnUrl.replace('turn:', 'turns:')],
        username: turnUsername,
        credential: turnCredential,
      });
    }
  }

  return servers;
}
