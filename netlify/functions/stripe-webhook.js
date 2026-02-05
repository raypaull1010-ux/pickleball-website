// Stripe Webhook Handler
// POST /stripe-webhook
//
// Handles Stripe events:
// - checkout.session.completed - Payment successful
// - customer.subscription.created - New subscription
// - customer.subscription.deleted - Subscription cancelled
// - invoice.payment_failed - Payment failed

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getServiceClient } = require('./lib/supabase');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  // Verify webhook signature
  const sig = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent;

  // SECURITY: Always require webhook signature verification
  // Never accept unsigned webhook events - this prevents attackers from
  // sending fake payment confirmations
  if (!webhookSecret) {
    console.error('CRITICAL: STRIPE_WEBHOOK_SECRET not configured');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Webhook not configured. Set STRIPE_WEBHOOK_SECRET environment variable.' })
    };
  }

  if (!sig) {
    console.error('Missing stripe-signature header');
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing stripe-signature header' })
    };
  }

  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: `Webhook signature verification failed: ${err.message}` })
    };
  }

  const supabase = getServiceClient();

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
        const { product_type, item_id, customer_name } = session.metadata;

        console.log(`Checkout completed: ${product_type} - ${item_id}`);

        // Update the appropriate table based on product type
        if (product_type?.startsWith('video_')) {
          await supabase
            .from('video_submissions')
            .update({
              status: 'payment_received',
              paid_at: new Date().toISOString(),
              payment_id: session.payment_intent || session.id
            })
            .eq('id', item_id);

          // Confirm related referral
          await confirmReferral(supabase, item_id, 'video_analysis');

        } else if (product_type?.startsWith('membership_')) {
          const isMonthly = product_type === 'membership_monthly';
          const expiresAt = new Date();

          if (isMonthly) {
            expiresAt.setMonth(expiresAt.getMonth() + 1);
          } else {
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);
          }

          await supabase
            .from('memberships')
            .update({
              status: 'active',
              started_at: new Date().toISOString(),
              expires_at: expiresAt.toISOString(),
              stripe_subscription_id: session.subscription || null,
              payment_id: session.payment_intent || session.id
            })
            .eq('id', item_id);

          // Confirm related referral
          await confirmReferral(supabase, item_id, 'membership');

        } else if (product_type === 'evaluation') {
          await supabase
            .from('skill_evaluations')
            .update({
              status: 'payment_received',
              paid_at: new Date().toISOString(),
              payment_id: session.payment_intent || session.id
            })
            .eq('id', item_id);

          // Confirm related referral
          await confirmReferral(supabase, item_id, 'evaluation');

        } else if (product_type === 'instructor_fee') {
          await supabase
            .from('instructors')
            .update({
              has_paid_fee: true,
              fee_paid_at: new Date().toISOString(),
              is_visible: true,
              status: 'active',
              payment_id: session.payment_intent || session.id
            })
            .eq('id', item_id);
        }

        break;
      }

      case 'customer.subscription.created': {
        const subscription = stripeEvent.data.object;
        console.log('Subscription created:', subscription.id);

        // Find membership by Stripe subscription ID and update
        await supabase
          .from('memberships')
          .update({
            status: 'active',
            stripe_subscription_id: subscription.id
          })
          .eq('stripe_subscription_id', subscription.id);

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = stripeEvent.data.object;
        console.log('Subscription cancelled:', subscription.id);

        await supabase
          .from('memberships')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString()
          })
          .eq('stripe_subscription_id', subscription.id);

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = stripeEvent.data.object;
        console.log('Payment failed:', invoice.id);

        if (invoice.subscription) {
          await supabase
            .from('memberships')
            .update({
              status: 'paused'
            })
            .eq('stripe_subscription_id', invoice.subscription);
        }

        break;
      }

      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true })
    };

  } catch (error) {
    console.error('Webhook processing error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Webhook processing failed' })
    };
  }
};

// Helper to confirm referrals when payment is received
async function confirmReferral(supabase, purchaseId, purchaseType) {
  try {
    // Find pending referral for this purchase
    const { data: referral } = await supabase
      .from('referrals')
      .select('*')
      .eq('purchase_id', purchaseId)
      .eq('purchase_type', purchaseType)
      .eq('status', 'pending')
      .single();

    if (referral) {
      // Update referral status to confirmed
      await supabase
        .from('referrals')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString()
        })
        .eq('id', referral.id);

      // If it's an instructor referral and it's a membership, increment their count
      if (purchaseType === 'membership') {
        const { data: instructor } = await supabase
          .from('instructors')
          .select('id, membership_referrals, total_referrals')
          .eq('referral_code', referral.referrer_code)
          .single();

        if (instructor) {
          // This was already incremented on submission, but we confirm it here
          console.log(`Confirmed membership referral for instructor ${instructor.id}`);

          // Check if instructor now qualifies for permanent visibility
          if (instructor.membership_referrals >= 2) {
            await supabase
              .from('instructors')
              .update({
                is_visible: true,
                status: 'active'
              })
              .eq('id', instructor.id);
          }
        }
      }

      // Calculate referrer's reward tier
      await updateReferrerRewardTier(supabase, referral.referrer_code);
    }
  } catch (error) {
    console.error('Error confirming referral:', error);
  }
}

// Calculate and update referrer's reward tier
async function updateReferrerRewardTier(supabase, referrerCode) {
  try {
    // Count confirmed referrals
    const { count } = await supabase
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_code', referrerCode)
      .eq('status', 'confirmed');

    // Determine tier
    let tier = null;
    if (count >= 15) tier = 'legendary';
    else if (count >= 10) tier = 'platinum';
    else if (count >= 5) tier = 'gold';
    else if (count >= 3) tier = 'silver';
    else if (count >= 1) tier = 'bronze';

    // Update the most recent confirmed referral with the tier
    if (tier) {
      await supabase
        .from('referrals')
        .update({ reward_tier: tier })
        .eq('referrer_code', referrerCode)
        .eq('status', 'confirmed')
        .order('confirmed_at', { ascending: false })
        .limit(1);
    }
  } catch (error) {
    console.error('Error updating reward tier:', error);
  }
}
