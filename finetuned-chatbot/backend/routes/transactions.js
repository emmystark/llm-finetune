const express = require('express');
const router = express.Router();

// Helper to get supabase from request
const getSupabase = (req) => req.supabase;

// Get all transactions for a user
router.get('/', async (req, res) => {
  try {
    const supabase = getSupabase(req);
    const userId = req.headers['user-id'];
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!supabase) {
      return res.json([]);
    }

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      // Return empty array if table doesn't exist yet
      if (error.message && error.message.includes('does not exist')) {
        return res.json([]);
      }
      throw error;
    }
    res.json(data || []);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    // Return empty array on error for demo purposes
    res.json([]);
  }
});

// Get single transaction
router.get('/:id', async (req, res) => {
  try {
    const supabase = getSupabase(req);
    const { id } = req.params;
    const userId = req.headers['user-id'];

    if (!supabase) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create transaction
router.post('/', async (req, res) => {
  try {
    const supabase = getSupabase(req);
    const userId = req.headers['user-id'];
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { merchant, amount, category, description, date } = req.body;

    if (!merchant || amount === undefined || !category) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // If supabase not available, return mock response for testing
    if (!supabase) {
      const mockData = {
        id: `tx-${Date.now()}`,
        user_id: userId,
        merchant,
        amount: parseFloat(amount),
        category,
        description: description || '',
        date: date || new Date().toISOString(),
        ai_categorized: false,
        created_at: new Date().toISOString()
      };
      return res.status(201).json(mockData);
    }

    const { data, error } = await supabase
      .from('transactions')
      .insert([
        {
          user_id: userId,
          merchant,
          amount: parseFloat(amount),
          category,
          description: description || '',
          date: date || new Date().toISOString(),
          ai_categorized: false
        }
      ])
      .select();

    if (error) {
      console.error('Supabase insert error:', error);
      // If table doesn't exist, return mock response for testing
      if (error.message && (error.message.includes('does not exist') || error.message.includes('undefined'))) {
        const mockData = {
          id: `tx-${Date.now()}`,
          user_id: userId,
          merchant,
          amount: parseFloat(amount),
          category,
          description: description || '',
          date: date || new Date().toISOString(),
          ai_categorized: false,
          created_at: new Date().toISOString()
        };
        return res.status(201).json(mockData);
      }
      throw error;
    }
    res.json(data[0]);
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update transaction
router.put('/:id', async (req, res) => {
  try {
    const supabase = getSupabase(req);
    const { id } = req.params;
    const userId = req.headers['user-id'];
    const { merchant, amount, category, description, date } = req.body;

    if (!supabase) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const { data, error } = await supabase
      .from('transactions')
      .update({
        merchant,
        amount: amount ? parseFloat(amount) : undefined,
        category,
        description,
        date,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json(data[0]);
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete transaction
router.delete('/:id', async (req, res) => {
  try {
    const supabase = getSupabase(req);
    const { id } = req.params;
    const userId = req.headers['user-id'];

    if (!supabase) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    res.json({ success: true, message: 'Transaction deleted' });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
