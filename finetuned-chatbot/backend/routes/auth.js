const express = require('express');
const router = express.Router();

// Helper to get supabase from request
const getSupabase = (req) => req.supabase;

// Sign up
router.post('/signup', async (req, res) => {
  try {
    const supabase = getSupabase(req);
    const { email, password, name } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password 
    });
    
    if (error) return res.status(400).json({ error: error.message });
    
    // Create user profile
    if (data.user) {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert([{
          id: data.user.id,
          email,
          name: name || email.split('@')[0],
          monthly_income: 0,
          fixed_bills: 0,
          savings_goal: 0
        }]);
      
      if (profileError) console.error('Profile creation error:', profileError);
    }

    res.json({ 
      success: true, 
      message: 'Signup successful',
      user: data.user 
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const supabase = getSupabase(req);
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ 
      email, 
      password 
    });
    
    if (error) return res.status(401).json({ error: error.message });
    
    res.json({ 
      success: true, 
      message: 'Login successful',
      user: data.user,
      session: data.session
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const supabase = getSupabase(req);
    
    if (!supabase) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const { error } = await supabase.auth.signOut();
    
    if (error) return res.status(400).json({ error: error.message });
    
    res.json({ success: true, message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const supabase = getSupabase(req);
    
    if (!supabase) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    res.json({ user, profile });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;