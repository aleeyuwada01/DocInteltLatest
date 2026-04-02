import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../src/lib/supabaseAdmin.js';
import Stripe from 'stripe';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

  const { plan } = req.body;
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_mock';
  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' as any });

  // Mock success for AI Studio environment
  if (!process.env.STRIPE_SECRET_KEY) {
    if (plan === 'pro') await supabaseAdmin.from('profiles').update({ storage_limit: 50 * 1024 * 1024 * 1024 }).eq('id', user.id);
    if (plan === 'enterprise') await supabaseAdmin.from('profiles').update({ storage_limit: 1024 * 1024 * 1024 * 1024 }).eq('id', user.id);
    return res.json({ url: '/?payment=success' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: plan === 'pro' ? 'Pro Plan (50GB)' : 'Enterprise Plan (1TB)',
            },
            unit_amount: plan === 'pro' ? 999 : 4999,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.origin}/?payment=success&plan=${plan}`,
      cancel_url: `${req.headers.origin}/?payment=cancelled`,
      client_reference_id: user.id,
    });
    res.json({ url: session.url });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
