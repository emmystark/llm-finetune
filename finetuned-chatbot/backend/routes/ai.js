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
      merchant: extractedData.merchant,
      amount: extractedData.amount,
      date: extractedData.date,
      description: extractedData.description,
      category: extractedData.category
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

// Get AI financial tips based on expenses
router.post('/get-tips', async (req, res) => {
  try {
    const userId = req.headers['user-id'];
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }
    const { transactions, categoryTotals, totalSpent, monthlyIncome } = req.body;
    if (!transactions || !categoryTotals) {
      return res.status(400).json({ error: 'Transactions and categoryTotals required' });
    }
    const tips = [];
    // Calculate metrics
    const spendingRatio = monthlyIncome > 0 ? (totalSpent / monthlyIncome) * 100 : 0;
    const numTransactions = transactions.length;
    // Generate contextual tips
    if (spendingRatio > 100) {
      tips.push('You\'ve exceeded your monthly budget! Consider reducing discretionary spending immediately.');
      tips.push('Try the 50/30/20 rule: 50% needs, 30% wants, 20% savings.');
    } else if (spendingRatio > 80) {
      tips.push('You\'re approaching your budget limit. Start being more selective with purchases.');
      tips.push('Consider using the envelope method for categories you overspend in.');
    } else if (spendingRatio < 40) {
      tips.push('Great job! You\'re saving over 60% of your income. Keep this momentum!');
      tips.push('Consider increasing your savings goal or investing the extra funds.');
    }
    // Category-specific tips
    if (categoryTotals['Food'] && categoryTotals['Food'] > monthlyIncome * 0.2) {
      tips.push('Food expenses are high. Try meal planning and cooking at home more often.');
    }
    if (categoryTotals['Entertainment'] && categoryTotals['Entertainment'] > monthlyIncome * 0.15) {
      tips.push('Entertainment costs are climbing. Set a monthly entertainment budget and stick to it.');
    }
    if (categoryTotals['Transport'] && categoryTotals['Transport'] > monthlyIncome * 0.15) {
      tips.push('Transport costs are significant. Consider carpooling or public transportation alternatives.');
    }
    if (categoryTotals['Shopping'] && categoryTotals['Shopping'] > monthlyIncome * 0.1) {
      tips.push('Shopping expenses detected. Implement a "wait 24 hours" rule before non-essential purchases.');
    }
    // General tips
    if (numTransactions < 5) {
      tips.push('Log more transactions to get better personalized insights.');
    }
    if (numTransactions > 20) {
      tips.push('Excellent tracking! You\'re building great financial awareness habits.');
    }
    // Default tips if none generated
    if (tips.length === 0) {
      tips.push('Your spending looks balanced. Keep monitoring and stay consistent!');
      tips.push('Review your expenses weekly to maintain financial discipline.');
      tips.push('Track your progress monthly and celebrate reaching savings goals.');
    }
    res.json({ tips });
  } catch (error) {
    console.error('Error generating tips:', error);
    res.status(500).json({ error: error.message });
  }
});

// Financial advisor chatbot - provides advice based on spending - WITH STREAMING
router.post('/chat', async (req, res) => {
  const startTime = Date.now();
  const supabase = req.supabase;
  
  try {
    const userId = req.headers['user-id'] || 'anonymous';
    const { message, transactions = [], monthlyIncome = 300000 } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Fetch all user transactions from database if not provided
    let userTransactions = transactions;
    if (!userTransactions || userTransactions.length === 0) {
      try {
        const { data: dbTransactions, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(100);
        
        if (!error && dbTransactions) {
          userTransactions = dbTransactions;
        }
      } catch (dbErr) {
        console.warn('Failed to fetch transactions from DB:', dbErr);
      }
    }

    // Calculate comprehensive spending analysis
    const totalSpent = userTransactions?.reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;
    const spendingRatio = monthlyIncome > 0 ? (totalSpent / monthlyIncome) * 100 : 0;
    const categoryTotals = {};
    const categoryPercentages = {};
    
    if (userTransactions && userTransactions.length > 0) {
      userTransactions.forEach(t => {
        const category = t.category || 'Other';
        categoryTotals[category] = (categoryTotals[category] || 0) + Math.abs(t.amount);
      });

      Object.entries(categoryTotals).forEach(([cat, amt]) => {
        categoryPercentages[cat] = ((amt / totalSpent) * 100).toFixed(1);
      });
    }

    // Identify spending patterns
    const patterns = [];
    const highestCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
    
    if (categoryTotals['Food'] && categoryTotals['Food'] > monthlyIncome * 0.2) {
      patterns.push(`Food spending is ₦${categoryTotals['Food'].toLocaleString()} (${categoryPercentages['Food']}%)`);
    }
    if (categoryTotals['Transport'] && categoryTotals['Transport'] > monthlyIncome * 0.15) {
      patterns.push(`Transport costs ₦${categoryTotals['Transport'].toLocaleString()} (${categoryPercentages['Transport']}%)`);
    }
    if (categoryTotals['Entertainment'] && categoryTotals['Entertainment'] > monthlyIncome * 0.1) {
      patterns.push(`Entertainment expenses ₦${categoryTotals['Entertainment'].toLocaleString()} (${categoryPercentages['Entertainment']}%)`);
    }
    if (spendingRatio > 80) {
      patterns.push(`Overspending by ${(spendingRatio - 80).toFixed(1)}% relative to income`);
    } else if (spendingRatio < 30) {
      patterns.push(`Excellent savings rate of ${(100 - spendingRatio).toFixed(1)}%`);
    }

    // Build comprehensive context with better prompt engineering
    const categoryBreakdown = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => `- ${cat}: ₦${amt.toLocaleString()} (${categoryPercentages[cat]}%)`)
      .join('\n');

    const healthStatus = spendingRatio > 100 ? 'CRITICAL OVERSPEND' : 
                        spendingRatio > 80 ? 'WARNING: HIGH SPENDING' :
                        spendingRatio > 60 ? 'CAUTION: MODERATE-HIGH' :
                        spendingRatio > 40 ? 'GOOD: HEALTHY' :
                        'EXCELLENT: CONSERVATIVE';

    const spendingContext = `You are Sentinel, a professional financial advisor AI. Respond directly to the user's question with specific, actionable advice based on their real spending data.

=== USER FINANCIAL PROFILE ===
Monthly Income: ₦${monthlyIncome?.toLocaleString()}
Total Spent: ₦${totalSpent.toLocaleString()}
Spending Ratio: ${spendingRatio.toFixed(1)}% of income
Transactions Logged: ${userTransactions?.length || 0}
Health Status: ${healthStatus}

=== SPENDING BREAKDOWN ===
${categoryBreakdown || 'No spending data yet'}

=== KEY PATTERNS ===
${patterns.length > 0 ? patterns.join('\n') : 'No concerning patterns detected - spending is balanced'}

=== USER QUESTION ===
"${message}"

=== INSTRUCTIONS ===
1. Answer directly and concisely (2-4 sentences max)
2. Reference specific amounts from their data
3. Give actionable steps they can take TODAY
4. If spending is high, suggest the top 2 categories to cut
5. Be encouraging if they're doing well
6. Use naira (₦) currency symbol

Provide your financial advice now:`;

    const { HfInference } = require('@huggingface/inference');
    const hf = new HfInference(process.env.HF_TOKEN);

    // Set response headers for streaming
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');

    let advice = '';
    let isStreaming = false;

    try {
      // Use textGenerationStream for real-time responses
      const stream = await hf.textGenerationStream({
        model: 'mistralai/Mistral-7B-Instruct-v0.2',
        inputs: spendingContext,
        parameters: {
          max_new_tokens: 300,
          temperature: 0.7,
          top_p: 0.95,
          do_sample: true,
          repetition_penalty: 1.2,
          return_full_text: false
        }
      });

      isStreaming = true;
      
      // Collect streamed response
      for await (const chunk of stream) {
        if (chunk.token.text) {
          advice += chunk.token.text;
        }
      }

      advice = advice.trim();
      
    } catch (streamErr) {
      console.warn('Streaming failed, using standard generation:', streamErr.message);
      
      try {
        const response = await hf.textGeneration({
          model: 'mistralai/Mistral-7B-Instruct-v0.2',
          inputs: spendingContext,
          parameters: {
            max_new_tokens: 300,
            temperature: 0.7,
            top_p: 0.95,
            do_sample: true,
            repetition_penalty: 1.2
          }
        });
        
        advice = response.generated_text?.trim() || 'Unable to generate advice. Please try again.';
      } catch (fallbackErr) {
        console.error('Model generation failed:', fallbackErr);
        // Smart fallback based on actual spending data
        const topCategory = highestCategory ? highestCategory[0] : 'expenses';
        const topAmount = highestCategory ? highestCategory[1] : 0;
        
        advice = `Based on your data: You're spending ₦${totalSpent.toLocaleString()} (${spendingRatio.toFixed(1)}% of income). ${
          spendingRatio > 100 ? `Your largest expense is ${topCategory} at ₦${topAmount.toLocaleString()}. Cut back here immediately to get below 100%.` :
          spendingRatio > 80 ? `To reach healthy levels, reduce ${topCategory} spending by ₦${Math.round((spendingRatio - 80) * monthlyIncome / 100)}.` :
          `Your spending is healthy. Keep monitoring ${topCategory} to maintain this balance.`
        }`;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Opik Trace] User: ${userId}, Query: "${message.substring(0, 40)}...", Txns: ${userTransactions?.length}, Ratio: ${spendingRatio.toFixed(1)}%, Duration: ${duration}ms, Streaming: ${isStreaming}`);

    res.json({
      success: true,
      message: message,
      advice: advice,
      analysis: {
        totalSpent,
        spendingRatio: parseFloat(spendingRatio.toFixed(1)),
        monthlyIncome,
        transactionCount: userTransactions?.length || 0,
        categoryBreakdown: categoryTotals,
        patterns: patterns,
        healthStatus: healthStatus
      },
      duration
    });

  } catch (error) {
    console.error('Error in financial advisor:', error);
    const duration = Date.now() - startTime;
    console.log(`[Opik Trace ERROR] User: ${req.headers['user-id'] || 'unknown'}, Error: ${error.message}, Duration: ${duration}ms`);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to generate financial advice',
      duration 
    });
  }
});

module.exports = router;