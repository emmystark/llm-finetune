const express = require('express');
const router = express.Router();
const { parseReceipt, categorizeTransaction, analyzeSpending } = require('../services/llm');

// Helper to get supabase from request
const getSupabase = (req) => req.supabase;

// Analyze receipt image and extract transaction data
router.post('/analyze-receipt', async (req, res) => {
  try {
    const supabase = getSupabase(req);
    const userId = req.headers['user-id'];
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { imageUrl, imageBase64 } = req.body;
    if (!imageUrl && !imageBase64) {
      return res.status(400).json({ error: 'Image URL or base64 required' });
    }

    const image = imageBase64 || imageUrl;
    const extractedData = await parseReceipt(image);

    res.json({
      success: true,
      data: extractedData,
      message: 'Receipt analyzed successfully'
    });
  } catch (error) {
    console.error('Error analyzing receipt:', error);
    res.status(500).json({ error: error.message });
  }
});

// Categorize a transaction using AI
router.post('/categorize', async (req, res) => {
  try {
    const userId = req.headers['user-id'];
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { merchant, amount, description } = req.body;
    if (!merchant || amount === undefined) {
      return res.status(400).json({ error: 'Merchant and amount required' });
    }

    const category = await categorizeTransaction(merchant, description);

    res.json({
      success: true,
      category,
      merchant,
      amount,
      message: 'Transaction categorized successfully'
    });
  } catch (error) {
    console.error('Error categorizing transaction:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get spending analysis and insights
router.get('/spending-analysis', async (req, res) => {
  try {
    const userId = req.headers['user-id'];
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    // Get user's transactions for this month
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .gte('date', new Date(new Date().setDate(1)).toISOString());

    if (error) throw error;

    const analysis = await analyzeSpending(transactions);

    res.json({
      success: true,
      analysis,
      transactionCount: transactions.length
    });
  } catch (error) {
    console.error('Error analyzing spending:', error);
    res.status(500).json({ error: error.message });
  }
});

// Process image and create transaction in one request
router.post('/process-receipt', async (req, res) => {
  try {
    const userId = req.headers['user-id'];
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { imageBase64, imageUrl } = req.body;
    if (!imageBase64 && !imageUrl) {
      return res.status(400).json({ error: 'Image URL or base64 required' });
    }

    // Step 1: Parse receipt
    const image = imageBase64 || imageUrl;
    const extractedData = await parseReceipt(image);

    // Step 2: Categorize
    const category = await categorizeTransaction(extractedData.merchant, '');

    // Step 3: Save to database
    const { data: transaction, error } = await supabase
      .from('transactions')
      .insert([
        {
          user_id: userId,
          merchant: extractedData.merchant,
          amount: parseFloat(extractedData.amount),
          category,
          description: extractedData.description || '',
          date: new Date().toISOString(),
          ai_categorized: true,
          receipt_image_url: imageUrl || null
        }
      ])
      .select();

    if (error) throw error;

    res.json({
      success: true,
      transaction: transaction[0],
      message: 'Receipt processed and transaction created'
    });
  } catch (error) {
    console.error('Error processing receipt:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
