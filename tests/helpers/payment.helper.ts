import crypto from 'crypto';
import { env } from '../config/env.test';

export class PaymentHelper {
  static generateRazorpaySignature(orderId: string, paymentId: string, secret: string): string {
    const text = `${orderId}|${paymentId}`;
    return crypto.createHmac('sha256', secret).update(text).digest('hex');
  }

  static generateStripeSignature(payload: string, secret: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${payload}`;
    const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
    return `t=${timestamp},v1=${signature}`;
  }

  static async simulateRazorpayWebhook(event: string, payload: any): Promise<Response> {
    const body = JSON.stringify({ event, payload });
    const signature = crypto.createHmac('sha256', env.RAZORPAY_TEST_WEBHOOK_SECRET).update(body).digest('hex');
    
    return await fetch(`${env.API_URL}/webhooks/razorpay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Razorpay-Signature': signature
      },
      body
    });
  }

  static async simulateStripeWebhook(type: string, data: any): Promise<Response> {
    const body = JSON.stringify({ type, data });
    const signature = this.generateStripeSignature(body, env.STRIPE_TEST_WEBHOOK_SECRET);
    
    return await fetch(`${env.API_URL}/webhooks/stripe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signature
      },
      body
    });
  }
}
