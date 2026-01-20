import React from 'react';
import styles from './Dashboard.module.css';

export default function Dashboard() {
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
          <div className={styles.userAvatar}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
        </div>
      </header>

      <main className={styles.mainContent}>
        <div className={styles.healthScore}>
          <div className={styles.scoreRing}>
            <svg className={styles.ringSvg} viewBox="0 0 200 200">
              <defs>
                <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#4ade80" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
              <circle
                cx="100"
                cy="100"
                r="85"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="8"
              />
              <circle
                cx="100"
                cy="100"
                r="85"
                fill="none"
                stroke="url(#ringGradient)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray="534"
                strokeDashoffset="80"
                transform="rotate(-90 100 100)"
              />
            </svg>
            <div className={styles.scoreContent}>
              <div className={styles.scoreNumber}>84</div>
              <div className={styles.scoreLabel}>Financial Health:</div>
              <div className={styles.scoreStatus}>Stable</div>
            </div>
          </div>
          <p className={styles.stabilityMessage}>Stable because your pace is within the safe range.</p>
        </div>

        <div className={styles.fuelGauge}>
          <div className={styles.gaugeHeader}>
            <span className={styles.gaugeTitle}>Fuel Gauge</span>
            <span className={styles.gaugeAmount}>₦3,500</span>
          </div>
          <div className={styles.gaugeBar}>
            <div className={styles.gaugeFill} style={{width: '70%'}}></div>
          </div>
          <div className={styles.gaugeLabels}>
            <span className={styles.gaugeLeft}>₦1,500 Left today</span>
            <span className={styles.gaugeCenter}>₦3,500</span>
            <span className={styles.gaugeRight}>₦5,000 (Limit)</span>
          </div>
          <div className={styles.gaugeTime}>
            <span>🕐 3:42 PM | Day 12 of 30</span>
          </div>
        </div>

        <div className={styles.todaysActivity}>
          <h2 className={styles.sectionTitle}>Today&apos;s Activity</h2>
          <div className={styles.activityCards}>
            <div className={styles.activityCard}>
              <div className={styles.activityIcon}>🍔</div>
              <div className={styles.activityDetails}>
                <div className={styles.activityName}>Chicken Republic</div>
                <div className={styles.activityAmount}>-₦4,500</div>
                <div className={styles.activityCategory}>↑ Food ↗ ↗</div>
              </div>
            </div>
            <div className={styles.activityCard}>
              <div className={styles.activityIcon}>🚗</div>
              <div className={styles.activityDetails}>
                <div className={styles.activityName}>Uber</div>
                <div className={styles.activityAmount}>-₦4,000</div>
                <div className={styles.activityCategory}>↑ Transport ↗ ↗</div>
              </div>
            </div>
            <div className={styles.activityCard}>
              <div className={styles.activityIcon}>☕</div>
              <div className={styles.activityDetails}>
                <div className={styles.activityName}>Cafe Neo</div>
                <div className={styles.activityAmount}>-₦1,200</div>
                <div className={styles.activityCategory}>↑ Food ↗</div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.categoryBreakdown}>
          <h2 className={styles.sectionTitle}>Category Breakdown</h2>
          <div className={styles.breakdownCards}>
            <div className={styles.breakdownCard}>
              <div className={styles.breakdownIcon}>🍴</div>
              <div className={styles.breakdownDetails}>
                <div className={styles.breakdownHeader}>
                  <span className={styles.breakdownName}>Food</span>
                  <span className={styles.breakdownAmount}>₦4,500</span>
                </div>
                <div className={styles.breakdownBar}>
                  <div className={styles.breakdownFill} style={{width: '90%'}}></div>
                </div>
              </div>
            </div>
            <div className={styles.breakdownCard}>
              <div className={styles.breakdownIcon}>🚗</div>
              <div className={styles.breakdownDetails}>
                <div className={styles.breakdownHeader}>
                  <span className={styles.breakdownName}>Transport</span>
                  <span className={styles.breakdownAmount}>₦4,000</span>
                </div>
                <div className={styles.breakdownBar}>
                  <div className={styles.breakdownFill} style={{width: '80%'}}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <button className={styles.fab}>
        <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
      </button>

      <div className={styles.bottomNav}>
        <div className={styles.navIcon}>👁️</div>
      </div>
    </div>
  );
}