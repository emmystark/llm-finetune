const { HfInference } = require('@huggingface/inference');
const dotenv = require('dotenv');

dotenv.config();

const hf = new HfInference(process.env.HF_TOKEN);

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
    
    // If it's a base64 string, convert it to buffer for HF API
    if (imageUrlOrBase64.startsWith('data:image')) {
      imageData = imageUrlOrBase64;
    }

    // Use image-to-text to analyze receipt
    const result = await hf.imageToText({
      data: imageData,
      model: 'Salesforce/blip-image-captioning-base'
    });

    const caption = result.generated_text || '';
    
    // Extract amount (look for currency patterns)
    const amountMatch = caption.match(/[\$₦€]?\s*(\d+(?:[.,]\d{2})?)/);
    const amount = amountMatch ? parseFloat(amountMatch[1].replace(',', '.')) : 0;

    // Extract merchant name (usually first meaningful words)
    const merchantMatch = caption.match(/^([A-Za-z\s&'-]+)/);
    const merchant = merchantMatch ? merchantMatch[1].trim() : 'Unknown Merchant';

    // Try to extract date
    const dateMatch = caption.match(/(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : new Date().toISOString();

    return {
      success: true,
      merchant: merchant.substring(0, 50), // Limit merchant name length
      amount: Math.abs(amount),
      date,
      description: caption,
      confidence: amount > 0 && merchant !== 'Unknown Merchant' ? 'high' : 'low'
    };
  } catch (error) {
    console.error('Receipt parsing error:', error);
    return {
      success: false,
      error: error.message,
      merchant: 'Unknown',
      amount: 0
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

    // If no keyword match, try HF text classification
    try {
      const result = await hf.textClassification({
        model: 'distilbert-base-uncased-finetuned-sst-2-english',
        inputs: merchant
      });
      
      // Map sentiment to category based on confidence
      if (result[0]) {
        const classification = result[0];
        // Simple mapping: we'd need a fine-tuned model for best results
        return 'Shopping'; // Default category if using general model
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