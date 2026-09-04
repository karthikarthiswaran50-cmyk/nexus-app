declare module 'web-push' {
  export interface PushSubscription {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  }

  export interface RequestOptions {
    headers?: Record<string, string>;
    gcmAPIKey?: string;
    VAPIDDetails?: {
      subject: string;
      publicKey: string;
      privateKey: string;
    };
    TTL?: number;
    contentEncoding?: string;
    proxy?: string;
    agent?: any;
    urgency?: 'very-low' | 'low' | 'normal' | 'high';
    topic?: string;
  }

  export interface SendResult {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  }

  export function generateVAPIDKeys(): {
    publicKey: string;
    privateKey: string;
  };

  export function setVapidDetails(
    subject: string,
    publicKey: string,
    privateKey: string
  ): void;

  export function sendNotification(
    subscription: PushSubscription,
    payload?: string | Buffer,
    options?: RequestOptions
  ): Promise<SendResult>;

  const webpush: {
    generateVAPIDKeys(): { publicKey: string; privateKey: string };
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
    sendNotification(
      subscription: PushSubscription,
      payload?: string | Buffer,
      options?: RequestOptions
    ): Promise<SendResult>;
  };

  export default webpush;
}
