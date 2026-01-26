const express = require('express');
const router = express.Router();

// Helper to get supabase from request
const getSupabase = (req) => req.supabase;

// Verify Telegram connection
router.get('/verify', async (req, res) => {
  try {
    const supabase = getSupabase(req);
    const userId = req.headers['user-id'];

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!supabase) {
      return res.json({ verified: false, message: 'Database not available' });
    }

    // Check if user has Telegram profile
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('telegram_connected, telegram_username')
      .eq('user_id', userId)
      .single();

    if (error || !profile) {
      return res.json({ verified: false, message: 'User profile not found' });
    }

    return res.json({
      verified: profile.telegram_connected === true,
      username: profile.telegram_username,
      message: profile.telegram_connected ? 'Telegram connected' : 'Telegram not connected'
    });
  } catch (error) {
    console.error('Error verifying Telegram:', error);
    res.status(500).json({ error: error.message });
  }
});

// Connect Telegram account
router.post('/connect', async (req, res) => {
  try {
    const supabase = getSupabase(req);
    const userId = req.headers['user-id'];
    const { telegramUsername, telegramUserId } = req.body;

    if (!userId || !telegramUsername) {
      return res.status(400).json({ error: 'User ID and telegram username required' });
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Database not available' });
    }

    // Update user profile with Telegram info
    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        telegram_connected: true,
        telegram_username: telegramUsername,
        telegram_user_id: telegramUserId || null
      })
      .eq('user_id', userId)
      .select();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Telegram connected successfully',
      profile: data[0]
    });
  } catch (error) {
    console.error('Error connecting Telegram:', error);
    res.status(500).json({ error: error.message });
  }
});

// Disconnect Telegram account
router.post('/disconnect', async (req, res) => {
  try {
    const supabase = getSupabase(req);
    const userId = req.headers['user-id'];

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        telegram_connected: false,
        telegram_username: null,
        telegram_user_id: null
      })
      .eq('user_id', userId)
      .select();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Telegram disconnected successfully'
    });
  } catch (error) {
    console.error('Error disconnecting Telegram:', error);
    res.status(500).json({ error: error.message });
  }
});

// Telegram webhook endpoint (for receiving messages from Telegram bot)
router.post('/webhook', async (req, res) => {
  try {
    const supabase = getSupabase(req);
    const { message, user } = req.body;

    if (!message || !user || !user.id) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    // Parse message for transaction data
    // Format: "amount merchant category" or natural language
    const text = message.text || '';

    // Simple parsing example
    // "5000 Shell Transport" -> amount: 5000, merchant: Shell, category: Transport
    const parts = text.split(' ');
    const amount = parseFloat(parts[0]);
    const merchant = parts[1] || 'Unknown';
    const category = parts[2] || 'Other';

    if (isNaN(amount)) {
      return res.json({
        status: 'error',
        message: 'Please use format: "amount merchant category" e.g., "5000 Shell Transport"'
      });
    }

    // Create transaction
    if (!supabase) {
      return res.json({ status: 'error', message: 'Database not available' });
    }

    const { data: transaction, error } = await supabase
      .from('transactions')
      .insert([{
        user_id: `telegram_${user.id}`,
        merchant,
        amount: Math.abs(amount),
        category,
        description: `Via Telegram: ${text}`,
        date: new Date().toISOString()
      }])
      .select();

    if (error) throw error;

    res.json({
      status: 'success',
      message: `Transaction logged: ₦${amount} at ${merchant} (${category})`,
      transaction: transaction[0]
    });
  } catch (error) {
    console.error('Error processing Telegram webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
