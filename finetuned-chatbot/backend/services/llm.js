const { HfInference } = require('@huggingface/inference');
const dotenv = require('dotenv');
dotenv.config();

const hf = new HfInference(process.env.HF_TOKEN, {
  endpointUrl: 'https://router.huggingface.co'
});

// Categories for expense classification
const CATEGORIES = ['Food', 'Transport', 'Entertainment', 'Shopping', 'Bills', 'Utilities', 'Health', 'Education', 'Other'];
const CATEGORY_KEYWORDS = {
  'Food': ['restaurant', 'food', 'cafe', 'pizza', 'burger', 'chicken', 'shop', 'grocery', 'market', 'bakery'],
  'Transport': ['uber', 'taxi', 'fuel', 'gas', 'transit', 'train', 'bus', 'parking', 'mechanic'],
  'Entertainment': ['movie', 'cinema', 'game', 'music', 'concert', 'theatre', 'stream', 'spotify', 'netflix'],
  'Shopping': ['mall', 'store', 'shop', 'amazon', 'retail', 'clothes', 'fashion', 'shoes'],
  'Bills': ['power', 'electricity', 'water', 'internet', 'phone', 'cable', 'rent', 'subscription'],
  'Utilities': ['electric', 'water', 'gas', 'internet', 'phone'],
  'Health': ['pharmacy', 'hospital', 'doctor', 'clinic', 'medical', 'health'],
  'Education': ['school', 'university', 'course', 'tuition', 'book', 'learning']
};

/**
 * Parse receipt image and extract transaction details
 * Uses vision model to identify merchant, amount, and date
 */
async function parseReceipt(imageUrlOrBase64) {
  try {
    // Handle both URL and base64
    let imageData = imageUrlOrBase64;
    // If it's a base64 string, use it directly
    if (imageUrlOrBase64.startsWith('data:image')) {
      imageData = imageUrlOrBase64;
    }
    // Use document QA for specific extractions
    const questions = {
      merchant: 'What is the merchant name?',
      amount: 'What is the total amount?',
      date: 'What is the date?'
    };
    let merchant = '';
    let amount = 0;
    let date = new Date().toISOString();
    for (const [key, question] of Object.entries(questions)) {
      const qaResult = await hf.documentQuestionAnswering({
        image: imageData,
        question,
        model: 'impira/layoutlm-document-qa'
      });
      if (qaResult.answer) {
        if (key === 'merchant') merchant = qaResult.answer.trim();
        if (key === 'amount') amount = parseFloat(qaResult.answer.replace(/[^0-9.]/g, '')) || 0;
        if (key === 'date') date = qaResult.answer;
      }
    }
    // Fallback to image-to-text for full description and refinements
    const captionResult = await hf.imageToText({
      data: imageData,
      model: 'Salesforce/blip2-opt-2.7b'
    });
    const caption = captionResult.generated_text || '';
    console.log('Receipt extraction caption:', caption);
    // Refine amount if not found
    if (amount === 0) {
      const amountPatterns = [
        /[₦N]\s*([0-9]{1,10}(?:[.,][0-9]{1,2})?)/i,
        /\$\s*([0-9]{1,10}(?:[.,][0-9]{1,2})?)/,
        /€\s*([0-9]{1,10}(?:[.,][0-9]{1,2})?)/,
        /total[:\s]+[₦N$€]?\s*([0-9]{1,10}(?:[.,][0-9]{1,2})?)/i,
        /amount[:\s]+[₦N$€]?\s*([0-9]{1,10}(?:[.,][0-9]{1,2})?)/i,
        /price[:\s]+[₦N$€]?\s*([0-9]{1,10}(?:[.,][0-9]{1,2})?)/i,
        /-\s*[₦N]\s*([0-9]{1,10}(?:[.,][0-9]{1,2})?)/i,
        /([0-9]{1,10}(?:[.,][0-9]{1,2})?)(?:\s*[₦N]|$)/
      ];
      for (const pattern of amountPatterns) {
        const match = caption.match(pattern);
        if (match && match[1]) {
          amount = parseFloat(match[1].replace(/,/g, ''));
          if (amount > 0) break;
        }
      }
    }
    // Refine merchant if not found
    if (!merchant) {
      const merchantPatterns = [
        /^(OPay|PayStack|Flutterwave|Opay|Remita|Kuda|Interswitch|Paypal|Google|Apple|Amazon|Meta)/i,
        /(?:merchant|establishment|store|shop|vendor|from):\s*([A-Za-z0-9\s&'.-]{2,60})/i,
        /^([A-Za-z0-9\s&'.-]{3,60})(?:\s+(?:limited|ltd|inc|corporation|co|store|shop|market|station))?/i,
        /([A-Za-z0-9\s&'.-]{3,60})\s*(?:receipt|invoice|bill|statement|transaction)/i,
        /([A-Za-z0-9\s&'.-]{3,60})\s+(?:₦|N|\$|€|amount|total)/i,
        /transaction\s+receipt.*?([A-Za-z0-9\s&'.-]{2,60})/i
      ];
      for (const pattern of merchantPatterns) {
        const match = caption.match(pattern);
        if (match && match[1]) {
          merchant = match[1].trim().replace(/(?:receipt|invoice|bill|statement|limited|ltd|inc|transaction)/gi, '').trim();
          if (merchant.length >= 2 && merchant.length <= 60) break;
        }
      }
      if (!merchant && caption) {
        const words = caption.split(/\s+/).filter(w => /^[A-Za-z]{2,}/.test(w));
        if (words.length > 0) {
          merchant = words[0];
          if (words.length > 1 && ['data', 'bundle', 'plan', 'transfer', 'payment'].includes(words[0].toLowerCase())) {
            merchant = words[1] || words[0];
          }
        }
      }
      merchant = merchant || 'Transaction';
    }
    // Refine date if not found
    if (date === new Date().toISOString()) {
      const datePatterns = [
        /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*,?\s+\d{4})/i,
        /(?:date|time):\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
        /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
        /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/
      ];
      for (const pattern of datePatterns) {
        const match = caption.match(pattern);
        if (match && match[1]) {
          date = match[1];
          break;
        }
      }
    }
    // Determine extraction confidence
    const hasAmount = amount > 0;
    const hasMerchant = merchant.length >= 2;
    const confidence = (hasAmount && hasMerchant) ? 'high' : 'medium';
    return {
      success: true,
      merchant,
      amount: Math.abs(amount),
      date,
      description: caption,
      confidence,
      extracted_text: caption
    };
  } catch (error) {
    console.error('Receipt parsing error:', error);
    return {
      success: false,
      error: error.message,
      merchant: '',
      amount: 0,
      description: 'Failed to parse receipt - model error'
    };
  }
}

/**
 * Categorize transaction based on merchant name and description
 * Uses keyword matching and optionally HF text classification
 */
async function categorizeTransaction(merchant, description = '') {
  try {
    const text = `${merchant} ${description}`.toLowerCase();
    // Keyword-based categorization (faster, more reliable)
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return category;
      }
    }
    // If no keyword match, try HF zero-shot classification
    try {
      const result = await hf.zeroShotClassification({
        model: 'facebook/bart-large-mnli',
        inputs: text,
        parameters: {
          candidate_labels: CATEGORIES
        }
      });
      if (result.labels && result.scores) {
        const topIndex = result.scores.indexOf(Math.max(...result.scores));
        return result.labels[topIndex];
      }
    } catch (classifyError) {
      console.warn('Classification fallback to keyword matching:', classifyError.message);
    }
    // Default category
    return 'Other';
  } catch (error) {
    console.error('Categorization error:', error);
    return 'Other';
  }
}

/**
 * Analyze spending patterns and generate insights
 */
async function analyzeSpending(transactions) {
  try {
    if (!transactions || transactions.length === 0) {
      return {
        totalSpent: 0,
        averageTransaction: 0,
        topCategory: 'None',
        insight: 'No transactions to analyze',
        riskLevel: 'low',
        recommendation: 'Start tracking your expenses to get personalized insights'
      };
    }
    // Calculate metrics
    const totalSpent = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const averageTransaction = totalSpent / transactions.length;
    // Category breakdown
    const categoryBreakdown = {};
    transactions.forEach(t => {
      if (!categoryBreakdown[t.category]) {
        categoryBreakdown[t.category] = 0;
      }
      categoryBreakdown[t.category] += Math.abs(t.amount);
    });
    const topCategory = Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Other';
    const topCategoryAmount = categoryBreakdown[topCategory] || 0;
    // Generate insight
    let insight = '';
    let riskLevel = 'low';
    let recommendation = '';
    if (topCategoryAmount > totalSpent * 0.5) {
      insight = `${topCategory} represents over 50% of your spending. Consider budgeting this category.`;
      riskLevel = 'medium';
      recommendation = 'Try to reduce spending on the top category';
    } else if (averageTransaction > 10000) {
      insight = 'Your average transaction is quite high. Consider budgeting more carefully.';
      riskLevel = 'medium';
      recommendation = 'Set daily spending limits';
    } else {
      insight = 'Your spending pattern looks healthy and balanced.';
      riskLevel = 'low';
      recommendation = 'Keep up with your current spending habits';
    }
    return {
      totalSpent: Math.round(totalSpent),
      averageTransaction: Math.round(averageTransaction),
      transactionCount: transactions.length,
      topCategory,
      categoryBreakdown,
      insight,
      riskLevel,
      recommendation
    };
  } catch (error) {
    console.error('Spending analysis error:', error);
    return {
      error: error.message,
      insight: 'Unable to analyze spending at this time',
      riskLevel: 'unknown'
    };
  }
}

/**
 * Generate daily financial health report
 */
async function generateHealthReport(userProfile, transactions) {
  try {
    const monthlyIncome = userProfile.monthly_income || 0;
    const fixedBills = userProfile.fixed_bills || 0;
    const savingsGoal = userProfile.savings_goal || 0;
    const totalSpent = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const remaining = monthlyIncome - totalSpent - fixedBills;
    const savingsPercentage = (remaining / monthlyIncome) * 100;
    let healthScore = 50; // Base score
    let status = 'Fair';
    if (savingsPercentage >= 20) {
      healthScore = 85;
      status = 'Excellent';
    } else if (savingsPercentage >= 10) {
      healthScore = 70;
      status = 'Good';
    } else if (savingsPercentage >= 0) {
      healthScore = 55;
      status = 'Fair';
    } else {
      healthScore = 30;
      status = 'Poor';
    }
    return {
      healthScore,
      status,
      monthlyIncome,
      fixedBills,
      discretionarySpent: totalSpent,
      remaining,
      savingsPercentage: Math.round(savingsPercentage),
      onTrackForGoal: remaining >= savingsGoal,
      message: `Your financial health is ${status}. ${savingsPercentage >= 20 ? 'Great job maintaining a healthy balance!' : 'Consider adjusting your spending.'}`
    };
  } catch (error) {
    console.error('Health report error:', error);
    return { error: error.message };
  }
}

module.exports = {
  parseReceipt,
  categorizeTransaction,
  analyzeSpending,
  generateHealthReport
};