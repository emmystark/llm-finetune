"use client";
import React, { useState, useEffect } from 'react';
import styles from './components/styles/Dashboard.module.css';

interface Transaction {
  id: string;
  merchant: string;
  amount: number;
  category: string;
  icon: string;
  date: string;
  description?: string;
  ai_categorized?: boolean;
}

interface UserProfile {
  name: string;
  email: string;
  monthlyIncome: number;
  fixedBills: number;
  savingsGoal: number;
  telegramConnected: boolean;
  telegramUsername: string;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

export default function Dashboard() {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: 'John Doe',
    email: 'john.doe@example.com',
    monthlyIncome: 300000,
    fixedBills: 100000,
    savingsGoal: 50000,
    telegramConnected: true,
    telegramUsername: '@User123'
  });
  const [newTransaction, setNewTransaction] = useState({
    description: '',
    merchant: '',
    amount: '',
    category: 'Food',
    date: 'Today'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId] = useState('default-user');
  const [healthScore, setHealthScore] = useState(0);
  const [healthStatus, setHealthStatus] = useState('Building Profile');

  // Fetch transactions on mount
  useEffect(() => {
    fetchTransactions();
  }, []);

  // Calculate health score based on spending data
  const calculateHealthScore = (transactionList: Transaction[], income: number) => {
    if (!transactionList || transactionList.length === 0) {
      setHealthScore(0);
      setHealthStatus('Building Profile');
      return;
    }

    const totalSpent = transactionList.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const spendingRatio = income > 0 ? (totalSpent / income) * 100 : 0;

    let score = 100;
    let status = 'Excellent';

    if (spendingRatio > 100) {
      score = 20;
      status = 'Critical';
    } else if (spendingRatio > 80) {
      score = 35;
      status = 'Poor';
    } else if (spendingRatio > 60) {
      score = 55;
      status = 'Fair';
    } else if (spendingRatio > 40) {
      score = 75;
      status = 'Good';
    } else {
      score = 90;
      status = 'Excellent';
    }

    setHealthScore(score);
    setHealthStatus(status);
  };

  // API helper function
  const apiCall = async (endpoint: string, method: string = 'GET', body?: object) => {
    try {
      setError(null);
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'user-id': userId
        }
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${BACKEND_URL}${endpoint}`, options);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'API request failed');
      }

      return await response.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('API Error:', message);
      throw err;
    }
  };

  // Fetch all transactions
  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const data = await apiCall('/api/transactions');
      // Convert to display format with icons
      const formattedData = data.map((t: any) => ({
        ...t,
        icon: getCategoryIcon(t.category),
        // Ensure amount is negative for display
        amount: t.amount > 0 ? -t.amount : t.amount
      }));
      setTransactions(formattedData);
      // Calculate health score based on spending
      calculateHealthScore(formattedData, userProfile.monthlyIncome);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (category: string): string => {
    const icons: Record<string, string> = {
      'Food': '🍔',
      'Transport': '🚗',
      'Entertainment': '🎬',
      'Shopping': '🛍️',
      'Bills': '📄',
      'Utilities': '⚡',
      'Health': '🏥',
      'Education': '📚',
      'Other': '💰'
    };
    return icons[category] || '💰';
  };

  const openModal = (modalName: string | null) => {
    setActiveModal(modalName);
  };

  const closeModal = () => {
    setActiveModal(null);
    setSelectedTransaction(null);
    setNewTransaction({
      description: '',
      merchant: '',
      amount: '',
      category: 'Food',
      date: 'Today'
    });
  };

  const handleTransactionClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    openModal('transaction');
  };

  const handleEditProfile = (field: string, newValue: number) => {
    setUserProfile({ ...userProfile, [field]: newValue });
    // Recalculate health score with new profile data
    calculateHealthScore(transactions, newValue === userProfile.monthlyIncome ? userProfile.monthlyIncome : newValue);
  };

  const handleUpdateTransaction = async () => {
    if (selectedTransaction && selectedTransaction.id) {
      setLoading(true);
      try {
        const updatedTx = await apiCall(`/api/transactions/${selectedTransaction.id}`, 'PUT', {
          merchant: selectedTransaction.merchant,
          amount: Math.abs(selectedTransaction.amount),
          category: selectedTransaction.category,
          date: selectedTransaction.date,
          description: selectedTransaction.description
        });
        
        // Update local state
        const updatedTransactions = transactions.map(t => 
          t.id === selectedTransaction.id ? { ...updatedTx, icon: getCategoryIcon(updatedTx.category), amount: -Math.abs(updatedTx.amount) } : t
        );
        setTransactions(updatedTransactions);
        
        // Recalculate health score
        calculateHealthScore(updatedTransactions, userProfile.monthlyIncome);
        closeModal();
      } catch (err) {
        console.error('Failed to update transaction:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDeleteTransaction = async () => {
    if (selectedTransaction && selectedTransaction.id) {
      if (confirm('Are you sure you want to delete this transaction?')) {
        setLoading(true);
        try {
          await apiCall(`/api/transactions/${selectedTransaction.id}`, 'DELETE');
          const updatedTransactions = transactions.filter(t => t.id !== selectedTransaction.id);
          setTransactions(updatedTransactions);
          
          // Recalculate health score
          calculateHealthScore(updatedTransactions, userProfile.monthlyIncome);
          closeModal();
        } catch (err) {
          console.error('Failed to delete transaction:', err);
        } finally {
          setLoading(false);
        }
      }
    }
  };

  const handleAddTransaction = async () => {
    setLoading(true);
    try {
      const amount = parseFloat(newTransaction.amount) || 0;
      
      if (!newTransaction.merchant || !newTransaction.amount) {
        setError('Please fill in merchant and amount');
        setLoading(false);
        return;
      }

      // Call AI endpoint to categorize if needed
      let category = newTransaction.category;
      try {
        const categoryResult = await apiCall('/api/ai/categorize', 'POST', {
          merchant: newTransaction.merchant,
          description: newTransaction.description
        });
        category = categoryResult.category;
      } catch (err) {
        console.warn('Could not categorize, using selected category:', err);
      }

      // Create transaction
      const transaction = await apiCall('/api/transactions', 'POST', {
        merchant: newTransaction.merchant,
        amount: Math.abs(amount),
        category,
        description: newTransaction.description,
        date: new Date().toISOString()
      });

      // Add to local state
      const newTx = { 
        ...transaction, 
        icon: getCategoryIcon(transaction.category), 
        amount: -Math.abs(amount) 
      };
      const updatedTransactions = [newTx, ...transactions];
      setTransactions(updatedTransactions);
      
      // Recalculate health score
      calculateHealthScore(updatedTransactions, userProfile.monthlyIncome);

      closeModal();
    } catch (err) {
      console.error('Failed to add transaction:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateCategoryTotals = () => {
    const totals: Record<string, number> = {};
    transactions.forEach(t => {
      if (!totals[t.category]) {
        totals[t.category] = 0;
      }
      totals[t.category] += Math.abs(t.amount);
    });
    return totals;
  };

  const categoryTotals = calculateCategoryTotals();
  const totalSpent = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const dailyLimit = 5000;
  const remaining = dailyLimit - totalSpent;

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>S</div>
          <span className={styles.logoText}>sentinel</span>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.telegramStatus}>
            Telegram: Connected ✓
          </div>
          <div className={styles.userAvatar} onClick={() => openModal('profile')}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
        </div>
      </header>

      {error && (
        <div style={{ 
          backgroundColor: '#fee', 
          color: '#c00', 
          padding: '12px 16px', 
          margin: '10px 20px',
          borderRadius: '8px',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      <main className={styles.mainContent}>
        <div className={styles.healthScore}>
          <div className={styles.scoreRing}>
            <svg className={styles.ringSvg} viewBox="0 0 200 200">
              <defs>
                <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={healthScore > 70 ? '#4ade80' : healthScore > 50 ? '#eab308' : '#ef4444'} />
                  <stop offset="100%" stopColor={healthScore > 70 ? '#3b82f6' : healthScore > 50 ? '#f97316' : '#dc2626'} />
                </linearGradient>
              </defs>
              <circle cx="100" cy="100" r="85" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
              <circle 
                cx="100" 
                cy="100" 
                r="85" 
                fill="none" 
                stroke="url(#ringGradient)" 
                strokeWidth="8" 
                strokeLinecap="round" 
                strokeDasharray={`${(healthScore / 100) * 534} 534`}
                strokeDashoffset="0"
                transform="rotate(-90 100 100)"
                style={{ transition: 'stroke-dasharray 0.5s ease' }}
              />
            </svg>
            <div className={styles.scoreContent}>
              <div className={styles.scoreNumber}>{healthScore}</div>
              <div className={styles.scoreLabel}>Financial Health:</div>
              <div className={styles.scoreStatus}>{healthStatus}</div>
            </div>
          </div>
          <p className={styles.stabilityMessage}>
            {healthScore === 0 ? 'Start adding transactions to build your profile.' :
             healthScore > 70 ? 'Excellent! Your spending is well-controlled.' : 
             healthScore > 50 ? 'Stable. Your pace is within a reasonable range.' :
             'Fair. Consider reducing discretionary spending.'}
          </p>
        </div>

        <div className={styles.fuelGauge}>
          <div className={styles.gaugeHeader}>
            <span className={styles.gaugeTitle}>Spending Overview</span>
            <span className={styles.gaugeAmount}>₦{totalSpent.toLocaleString()}</span>
          </div>
          <div className={styles.gaugeBar}>
            <div className={styles.gaugeFill} style={{width: `${Math.min((totalSpent / dailyLimit) * 100, 100)}%`}}></div>
          </div>
          <div className={styles.gaugeLabels}>
            <span className={styles.gaugeLeft}>₦{Math.max(0, remaining).toLocaleString()} Left</span>
            <span className={styles.gaugeCenter}>₦{totalSpent.toLocaleString()}</span>
            <span className={styles.gaugeRight}>₦{dailyLimit.toLocaleString()} Goal</span>
          </div>
          <div className={styles.gaugeTime}>
            <span>🕐 {new Date().toLocaleTimeString()} | {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
            Loading...
          </div>
        )}

        {!loading && transactions.length > 0 && (
          <>
            <div className={styles.todaysActivity}>
              <h2 className={styles.sectionTitle}>Today&apos;s Activity</h2>
              <div className={styles.activityCards}>
                {transactions.slice(0, 5).map(transaction => (
                  <div 
                    key={transaction.id} 
                    className={styles.activityCard}
                    onClick={() => handleTransactionClick(transaction)}
                  >
                    <div className={styles.activityIcon}>{transaction.icon}</div>
                    <div className={styles.activityDetails}>
                      <div className={styles.activityName}>{transaction.merchant}</div>
                      <div className={styles.activityAmount}>₦{Math.abs(transaction.amount).toLocaleString()}</div>
                      <div className={styles.activityCategory}>↑ {transaction.category} ↗</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.categoryBreakdown}>
              <h2 className={styles.sectionTitle}>Category Breakdown</h2>
              <div className={styles.breakdownCards}>
                {Object.entries(categoryTotals).map(([category, amount]) => {
                  const icons: Record<string, string> = { 
                    Food: '🍴', 
                    Transport: '🚗', 
                    Entertainment: '🎬', 
                    Shopping: '🛍️', 
                    Bills: '📄',
                    Utilities: '⚡',
                    Health: '🏥',
                    Education: '📚'
                  };
                  return (
                    <div key={category} className={styles.breakdownCard}>
                      <div className={styles.breakdownIcon}>{icons[category] || '💰'}</div>
                      <div className={styles.breakdownDetails}>
                        <div className={styles.breakdownHeader}>
                          <span className={styles.breakdownName}>{category}</span>
                          <span className={styles.breakdownAmount}>₦{amount.toLocaleString()}</span>
                        </div>
                        <div className={styles.breakdownBar}>
                          <div className={styles.breakdownFill} style={{width: `${(amount / dailyLimit) * 100}%`}}></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {!loading && transactions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#888' }}>
            <p>No transactions yet. Click the + button to add one!</p>
          </div>
        )}
      </main>

      <button className={styles.fab} onClick={() => openModal('add')}>
        <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
      </button>

      <div className={styles.bottomNav}>
        {/* <div className={styles.navIcon} onClick={() => openModal('developer')}>👁️</div> */}
      </div>

      {/* Profile & Settings Modal */}
      {activeModal === 'profile' && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Profile & Settings</h2>
              <button className={styles.closeButton} onClick={closeModal}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.profileSection}>
                <div className={styles.profileAvatar}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </div>
                <h3 className={styles.profileName}>{userProfile.name}</h3>
                <p className={styles.profileEmail}>{userProfile.email}</p>
              </div>

              <div className={styles.settingField}>
                <label>
                  <span className={styles.fieldIcon}>💰</span>
                  <span>Monthly Income: ₦{userProfile.monthlyIncome.toLocaleString()}</span>
                </label>
                <input 
                  type="number" 
                  className={styles.editButton}
                  style={{ width: '120px', padding: '4px 8px' }}
                  placeholder="Income"
                  onChange={(e) => handleEditProfile('monthlyIncome', parseFloat(e.target.value) || 0)}
                  defaultValue={userProfile.monthlyIncome}
                />
              </div>

              <div className={styles.settingField}>
                <label>
                  <span className={styles.fieldIcon}>📄</span>
                  <span>Fixed Bills: ₦{userProfile.fixedBills.toLocaleString()}</span>
                </label>
                <input 
                  type="number" 
                  className={styles.editButton}
                  style={{ width: '120px', padding: '4px 8px' }}
                  placeholder="Bills"
                  onChange={(e) => handleEditProfile('fixedBills', parseFloat(e.target.value) || 0)}
                  defaultValue={userProfile.fixedBills}
                />
              </div>

              <div className={styles.settingField}>
                <label>
                  <span className={styles.fieldIcon}>🎯</span>
                  <span>Savings Goal: ₦{userProfile.savingsGoal.toLocaleString()}</span>
                </label>
                <input 
                  type="number" 
                  className={styles.editButton}
                  style={{ width: '120px', padding: '4px 8px' }}
                  placeholder="Goal"
                  onChange={(e) => handleEditProfile('savingsGoal', parseFloat(e.target.value) || 0)}
                  defaultValue={userProfile.savingsGoal}
                />
              </div>

              <div className={styles.telegramSection}>
                <h4>Telegram Connection</h4>
                <p className={styles.telegramConnectedText}>
                  Connected as {userProfile.telegramUsername} ✅
                </p>
                <button className={styles.disconnectButton}>Disconnect</button>
              </div>

              <button className={styles.saveButton} onClick={closeModal}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Developer Console Modal */}
      {activeModal === 'developer' && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={`${styles.modal} ${styles.wideModal}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Developer Console / Opik Trace Log</h2>
              <button className={styles.closeButton} onClick={closeModal}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.consoleOutput}>
                <div className={styles.consoleLine}>
                  <span className={styles.timestamp}>[21:35:01]</span>
                  <span className={styles.infoTag}>INFO:</span>
                  <span>Webhook received from Telegram user @User123.</span>
                </div>
                <div className={styles.consoleLine}>
                  <span className={styles.timestamp}>[21:35:02]</span>
                  <span className={styles.traceTag}>TRACE:</span>
                  <span>Agent receiving image payload for analysis.</span>
                </div>
                <div className={styles.consoleLine}>
                  <span className={styles.timestamp}>[21:35:04]</span>
                  <span className={styles.traceTag}>TRACE:</span>
                  <span>Vision API parsing receipt successful. Extracted: Merchant=&apos;Chicken Republic&apos;, Amount=4500.</span>
                </div>
                <div className={styles.consoleLine}>
                  <span className={styles.timestamp}>[21:35:05]</span>
                  <span className={styles.infoTag}>INFO:</span>
                  <span>Risk Analysis Engine triggered. Current Daily Utilization: 85%.</span>
                </div>
                <div className={styles.consoleLine}>
                  <span className={styles.timestamp}>[21:35:05]</span>
                  <span className={styles.traceTag}>TRACE:</span>
                  <span>Opik Trace ID: #99282 logged for AI reasoning chain.</span>
                </div>
                <div className={styles.consoleLine}>
                  <span className={styles.timestamp}>[21:35:06]</span>
                  <span className={styles.infoTag}>INFO:</span>
                  <span>Transaction saved to Supabase. Dashboard updated.</span>
                </div>
                <div className={styles.consoleLine}>
                  <span className={styles.timestamp}>[21:35:07]</span>
                  <span className={styles.debugTag}>DEBUG:</span>
                  <span>Cron job for Daily Vibe Check scheduled for 22:00.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Detail Modal */}
      {activeModal === 'transaction' && selectedTransaction && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Transaction Detail</h2>
              <button className={styles.closeButton} onClick={closeModal}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>Merchant</label>
                <input 
                  type="text" 
                  className={styles.input} 
                  value={selectedTransaction.merchant}
                  onChange={(e) => setSelectedTransaction({...selectedTransaction, merchant: e.target.value})}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Amount</label>
                <input 
                  type="text" 
                  className={styles.input} 
                  value={`₦${Math.abs(selectedTransaction.amount).toLocaleString()}`}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[₦,]/g, '');
                    setSelectedTransaction({...selectedTransaction, amount: -Math.abs(parseFloat(value) || 0)});
                  }}
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Date</label>
                  <input 
                    type="text" 
                    className={styles.input} 
                    value={selectedTransaction.date}
                    onChange={(e) => setSelectedTransaction({...selectedTransaction, date: e.target.value})}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Category</label>
                  <select 
                    className={styles.select}
                    value={selectedTransaction.category}
                    onChange={(e) => setSelectedTransaction({...selectedTransaction, category: e.target.value})}
                  >
                    <option>Transport</option>
                    <option>Food</option>
                    <option>Entertainment</option>
                    <option>Shopping</option>
                    <option>Bills</option>
                    <option>Utilities</option>
                    <option>Health</option>
                    <option>Education</option>
                  </select>
                </div>
              </div>

              <div className={styles.insightBox}>
                <h4>AI Insight (Opik Trace)</h4>
                <p>Categorized as &apos;{selectedTransaction.category}&apos; because &apos;{selectedTransaction.merchant}&apos; matches known {selectedTransaction.category.toLowerCase()} services. Risk analysis is neutral.</p>
                <p className={styles.traceId}>AI Categorized: {selectedTransaction.ai_categorized ? 'Yes ✓' : 'Manual'}</p>
              </div>

              <div className={styles.buttonRow}>
                <button className={styles.updateButton} onClick={handleUpdateTransaction} disabled={loading}>
                  {loading ? 'Updating...' : 'Update Transaction'}
                </button>
                <button className={styles.deleteButton} onClick={handleDeleteTransaction} disabled={loading}>
                  {loading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {activeModal === 'add' && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Add Transaction</h2>
              <button className={styles.closeButton} onClick={closeModal}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.textareaGroup}>
                <textarea 
                  className={styles.textarea} 
                  placeholder="e.g., 'Spent 5k on fuel'"
                  rows={4}
                  value={newTransaction.description}
                  onChange={(e) => setNewTransaction({...newTransaction, description: e.target.value})}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Merchant</label>
                <input 
                  type="text" 
                  className={styles.input} 
                  placeholder="e.g., Shell Gas Station"
                  value={newTransaction.merchant}
                  onChange={(e) => setNewTransaction({...newTransaction, merchant: e.target.value})}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Amount (₦)</label>
                <input 
                  type="number" 
                  className={styles.input} 
                  placeholder="5000"
                  value={newTransaction.amount}
                  onChange={(e) => setNewTransaction({...newTransaction, amount: e.target.value})}
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Category</label>
                  <select 
                    className={styles.select}
                    value={newTransaction.category}
                    onChange={(e) => setNewTransaction({...newTransaction, category: e.target.value})}
                  >
                    <option>Food</option>
                    <option>Transport</option>
                    <option>Entertainment</option>
                    <option>Shopping</option>
                    <option>Bills</option>
                    <option>Utilities</option>
                    <option>Health</option>
                    <option>Education</option>
                  </select>
                </div>
              </div>

              <button className={styles.analyzeButton} onClick={handleAddTransaction} disabled={loading}>
                {loading ? 'Adding...' : 'Analyze & Log'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}