/**
 * homepage.js
 * SpendWise — Premium 3D Interactive Homepage
 * 
 * Features:
 * - 3D Perspective Hero stage with floating debit card, live balance card & security shield.
 * - Interactive mouse-follow tilt and dynamic specular light sheen.
 * - 8 Complete Homepage Sections:
 *   1. Hero Section ("Your Money. Your Future. Your Control.")
 *   2. Financial Confidence Section ("Know Where Every Rupee Goes.")
 *   3. Feature Showcase (9 Implemented Core Features)
 *   4. Money Guardian Autonomous Control Showcase
 *   5. Financial Growth & Habit Compounding Section
 *   6. How It Works (3 Simple Steps)
 *   7. Final Call to Action ("Your Financial Future Starts Today.")
 *   8. Honest & Clean Footer (No fabricated credentials)
 */

import { formatCurrency, escapeHtml } from './transactions.js';

let heroMouseMoveHandler = null;

export function renderHomepage(container, appState, actions) {
  if (!container) return;

  // Cleanup prior listeners if re-rendering
  if (heroMouseMoveHandler) {
    window.removeEventListener('mousemove', heroMouseMoveHandler);
    heroMouseMoveHandler = null;
  }

  container.innerHTML = `
    <div class="homepage-root">
      <!-- Ambient Floating Gradient Orbs -->
      <div class="home-ambient-orb orb-1" aria-hidden="true"></div>
      <div class="home-ambient-orb orb-2" aria-hidden="true"></div>
      <div class="home-ambient-orb orb-3" aria-hidden="true"></div>

      <!-- Homepage Floating Glass Navigation Bar -->
      <header class="home-navbar" role="banner">
        <div class="home-nav-container">
          <a href="#home" class="home-brand-logo" aria-label="SpendWise Home">
            <span class="home-logo-icon">
              <i data-lucide="sparkles" aria-hidden="true"></i>
            </span>
            <span class="home-brand-text">SPEND <span>WISE</span></span>
          </a>

          <nav class="home-nav-links" aria-label="Homepage Navigation">
            <a href="#hero" class="home-nav-link active">Home</a>
            <a href="#features" class="home-nav-link">Features</a>
            <a href="#guardian-preview" class="home-nav-link">Money Guardian</a>
            <a href="#growth" class="home-nav-link">Growth</a>
            <a href="#how-it-works" class="home-nav-link">How It Works</a>
          </nav>

          <div class="home-nav-actions">
            <button type="button" class="btn btn-secondary btn-sm btn-open-demo-bank" title="Open Simulated Banking">
              <i data-lucide="building-2" class="btn-icon" aria-hidden="true"></i>
              <span>Demo Bank</span>
            </button>
            <button type="button" class="btn btn-primary btn-sm btn-launch-app" title="Launch Financial Dashboard">
              <span>Get Started</span>
              <i data-lucide="arrow-right" class="btn-icon" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </header>

      <!-- =====================================================================
           SECTION 1: HERO SECTION
           ===================================================================== -->
      <section id="hero" class="home-section hero-section" aria-label="Hero Introduction">
        <div class="home-container hero-layout">
          <div class="hero-content">
            <div class="hero-badge animate-fade-in-up">
              <span class="badge-dot"></span>
              <span class="badge-text">Your Money. Your Future. Your Control.</span>
            </div>

            <h1 class="hero-title animate-fade-in-up delay-1">
              Take Control of Your Money.
              <span class="text-gradient">Build the Future You Deserve.</span>
            </h1>

            <p class="hero-description animate-fade-in-up delay-2">
              Track every rupee, protect your savings, manage your spending and make smarter financial decisions with SpendWise — your intelligent personal financial control platform.
            </p>

            <div class="hero-cta-group animate-fade-in-up delay-3">
              <button type="button" class="btn btn-primary btn-hero-cta btn-launch-app" aria-label="Get Started with SpendWise">
                <span>Get Started</span>
                <i data-lucide="arrow-right" class="btn-icon" aria-hidden="true"></i>
              </button>
              <a href="#features" class="btn btn-secondary btn-hero-secondary" aria-label="Explore Platform Features">
                <i data-lucide="compass" class="btn-icon" aria-hidden="true"></i>
                <span>Explore Features</span>
              </a>
            </div>

            <div class="hero-micro-metrics animate-fade-in-up delay-4">
              <div class="micro-metric">
                <i data-lucide="shield-check" class="metric-icon" aria-hidden="true"></i>
                <div>
                  <strong>Strict Spending Guard</strong>
                  <span>Auto-blocks overspending</span>
                </div>
              </div>
              <div class="micro-metric-sep"></div>
              <div class="micro-metric">
                <i data-lucide="cpu" class="metric-icon" aria-hidden="true"></i>
                <div>
                  <strong>Daily Income AI</strong>
                  <span>Dynamic per-day allowance</span>
                </div>
              </div>
              <div class="micro-metric-sep"></div>
              <div class="micro-metric">
                <i data-lucide="lock" class="metric-icon" aria-hidden="true"></i>
                <div>
                  <strong>100% Private Ledger</strong>
                  <span>Local SQLite database</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 3D Layered Interactive Visual Stage -->
          <div class="hero-visual-wrapper" id="hero-3d-stage">
            <div class="hero-3d-scene" id="hero-scene">
              <!-- Background Ambient Glow Disc -->
              <div class="hero-glow-disc" aria-hidden="true"></div>

              <!-- Main Floating Holographic Debit Card -->
              <div class="hero-card-3d hero-bank-card perspective-3d-card" id="hero-bank-card">
                <div class="hero-bank-card-inner">
                  <div class="hero-card-header">
                    <div class="hero-card-chip"></div>
                    <div class="hero-contactless">
                      <i data-lucide="wifi" aria-hidden="true"></i>
                    </div>
                    <span class="hero-card-logo">SPEND WISE</span>
                  </div>

                  <div class="hero-card-middle">
                    <div class="hero-card-label">AVAILABLE BALANCE</div>
                    <div class="hero-card-balance tabular-nums">₹2,47,250.00</div>
                  </div>

                  <div class="hero-card-footer">
                    <div>
                      <span class="hero-card-holder-label">ACCOUNT HOLDER</span>
                      <div class="hero-card-holder">DEMO USER</div>
                    </div>
                    <div class="hero-card-num tabular-nums">•••• 4892</div>
                    <div class="hero-card-tag">PLATINUM</div>
                  </div>
                </div>
              </div>

              <!-- Floating Card 1: Today's Safe Spending Allowance -->
              <div class="hero-floating-badge badge-allowance perspective-3d-card" id="float-badge-1">
                <div class="badge-icon-box bg-purple-tint">
                  <i data-lucide="shield" aria-hidden="true"></i>
                </div>
                <div class="badge-body">
                  <span class="badge-label">Today's Safe Allowance</span>
                  <div class="badge-val text-purple tabular-nums">₹18,776 / day</div>
                  <span class="badge-sub">Protected by Money Guardian</span>
                </div>
              </div>

              <!-- Floating Card 2: Savings Health & Protected Reserves -->
              <div class="hero-floating-badge badge-reserves perspective-3d-card" id="float-badge-2">
                <div class="badge-icon-box bg-pink-tint">
                  <i data-lucide="lock" aria-hidden="true"></i>
                </div>
                <div class="badge-body">
                  <span class="badge-label">Protected Living Reserves</span>
                  <div class="badge-val text-pink tabular-nums">₹1,00,000.00</div>
                  <span class="badge-sub">8 Essential Envelopes Locked</span>
                </div>
              </div>

              <!-- Floating Card 3: Monthly Net Savings Growth -->
              <div class="hero-floating-badge badge-growth perspective-3d-card" id="float-badge-3">
                <div class="badge-icon-box bg-emerald-tint">
                  <i data-lucide="trending-up" aria-hidden="true"></i>
                </div>
                <div class="badge-body">
                  <span class="badge-label">Monthly Retention Pace</span>
                  <div class="badge-val text-emerald tabular-nums">+ ₹55,400.00</div>
                  <span class="badge-sub">Positive Cashflow Trajectory</span>
                </div>
              </div>

              <!-- Floating Currency & Geometry Icons -->
              <div class="floating-geo geo-rupee" aria-hidden="true">₹</div>
              <div class="floating-geo geo-sphere-1" aria-hidden="true"></div>
              <div class="floating-geo geo-sphere-2" aria-hidden="true"></div>
              <div class="floating-geo geo-sparkle" aria-hidden="true">
                <i data-lucide="sparkles"></i>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- =====================================================================
           SECTION 2: FINANCIAL CONFIDENCE SECTION
           ===================================================================== -->
      <section id="confidence" class="home-section confidence-section" aria-label="Financial Confidence">
        <div class="home-container">
          <div class="section-header text-center">
            <span class="section-kicker">Financial Clarity</span>
            <h2 class="section-title">Know Where Every Rupee Goes.</h2>
            <p class="section-subtitle">
              Financial stress isn’t caused by a lack of money — it’s caused by uncertainty. SpendWise gives you total transparency, tracking every inflow and expense with absolute discipline.
            </p>
          </div>

          <div class="confidence-grid">
            <div class="confidence-card perspective-3d-card">
              <div class="card-icon-box icon-purple">
                <i data-lucide="eye" aria-hidden="true"></i>
              </div>
              <h3 class="card-heading">Zero Blind Spots</h3>
              <p class="card-text">
                Every simulated swipe, bill payment, and discretionary spend is recorded in real time. Know your exact net position across all 9 financial views.
              </p>
              <div class="card-footer-pill">
                <i data-lucide="check" aria-hidden="true"></i>
                <span>Complete ledger visibility</span>
              </div>
            </div>

            <div class="confidence-card perspective-3d-card">
              <div class="card-icon-box icon-pink">
                <i data-lucide="shield-alert" aria-hidden="true"></i>
              </div>
              <h3 class="card-heading">Proactive Protection</h3>
              <p class="card-text">
                Unlike passive trackers that only complain after you overspend, Money Guardian alerts you before a purchase happens and can block overspending in Strict Mode.
              </p>
              <div class="card-footer-pill">
                <i data-lucide="check" aria-hidden="true"></i>
                <span>Pre-transaction evaluation</span>
              </div>
            </div>

            <div class="confidence-card perspective-3d-card">
              <div class="card-icon-box icon-lavender">
                <i data-lucide="lock" aria-hidden="true"></i>
              </div>
              <h3 class="card-heading">Total Privacy & Control</h3>
              <p class="card-text">
                All records live inside a high-speed local SQLite database on your machine. No cloud tracking, no third-party ads, and no selling of your sensitive financial habits.
              </p>
              <div class="card-footer-pill">
                <i data-lucide="check" aria-hidden="true"></i>
                <span>100% On-device data security</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- =====================================================================
           SECTION 3: COMPLETE FEATURE SHOWCASE
           ===================================================================== -->
      <section id="features" class="home-section features-section" aria-label="Feature Showcase">
        <div class="home-container">
          <div class="section-header text-center">
            <span class="section-kicker">Integrated Architecture</span>
            <h2 class="section-title">Nine Tools. One Unified Financial Engine.</h2>
            <p class="section-subtitle">
              Every feature in SpendWise is fully built, integrated, and ready to use. Explore how each module collaborates to build your financial future.
            </p>
          </div>

          <div class="features-grid">
            <!-- Feature 1: Smart Expense Tracking -->
            <div class="feature-card perspective-3d-card" data-feature-target="transactions">
              <div class="feature-icon-header">
                <div class="feature-icon icon-purple">
                  <i data-lucide="arrow-left-right" aria-hidden="true"></i>
                </div>
                <span class="feature-status-tag tag-ready">Ready to use</span>
              </div>
              <h3 class="feature-title">Smart Expense Tracking</h3>
              <p class="feature-desc">
                Log income and expenses with categorical granularity, instant multi-filter search, date ranges, and one-click CSV export.
              </p>
              <button type="button" class="feature-action-btn" data-nav="transactions">
                <span>View Transactions</span>
                <i data-lucide="chevron-right" aria-hidden="true"></i>
              </button>
            </div>

            <!-- Feature 2: Financial Analytics -->
            <div class="feature-card perspective-3d-card" data-feature-target="analytics">
              <div class="feature-icon-header">
                <div class="feature-icon icon-pink">
                  <i data-lucide="bar-chart-3" aria-hidden="true"></i>
                </div>
                <span class="feature-status-tag tag-ready">Ready to use</span>
              </div>
              <h3 class="feature-title">Financial Analytics</h3>
              <p class="feature-desc">
                High-definition Chart.js data visualizations revealing income vs. expense ratios, net savings trends, and exact spending distribution.
              </p>
              <button type="button" class="feature-action-btn" data-nav="analytics">
                <span>View Analytics</span>
                <i data-lucide="chevron-right" aria-hidden="true"></i>
              </button>
            </div>

            <!-- Feature 3: Budget Management -->
            <div class="feature-card perspective-3d-card" data-feature-target="budget">
              <div class="feature-icon-header">
                <div class="feature-icon icon-lavender">
                  <i data-lucide="wallet" aria-hidden="true"></i>
                </div>
                <span class="feature-status-tag tag-ready">Ready to use</span>
              </div>
              <h3 class="feature-title">Budget Management</h3>
              <p class="feature-desc">
                Set monthly spending limits with color-coded gauge meters. Receive warning alerts at 80% consumption and critical alerts at 100%.
              </p>
              <button type="button" class="feature-action-btn" data-nav="budget">
                <span>Configure Budget</span>
                <i data-lucide="chevron-right" aria-hidden="true"></i>
              </button>
            </div>

            <!-- Feature 4: Smart Bank Connect -->
            <div class="feature-card perspective-3d-card" data-feature-target="bank">
              <div class="feature-icon-header">
                <div class="feature-icon icon-purple">
                  <i data-lucide="building-2" aria-hidden="true"></i>
                </div>
                <span class="feature-status-tag tag-ready">Ready to use</span>
              </div>
              <h3 class="feature-title">Smart Bank Connect</h3>
              <p class="feature-desc">
                Realistic mock demo banking system with a 3D platinum card, transaction ledger, instant deposits, safe withdrawals, and automated SpendWise sync.
              </p>
              <button type="button" class="feature-action-btn" data-nav="bank">
                <span>Open Demo Bank</span>
                <i data-lucide="chevron-right" aria-hidden="true"></i>
              </button>
            </div>

            <!-- Feature 5: Money Guardian -->
            <div class="feature-card perspective-3d-card" data-feature-target="guardian">
              <div class="feature-icon-header">
                <div class="feature-icon icon-pink">
                  <i data-lucide="shield" aria-hidden="true"></i>
                </div>
                <span class="feature-status-tag tag-highlight">Core Guardian AI</span>
              </div>
              <h3 class="feature-title">Money Guardian</h3>
              <p class="feature-desc">
                The central control system that monitors simulated banking transactions, locks essential reserves, and enforces financial peace of mind.
              </p>
              <button type="button" class="feature-action-btn" data-nav="guardian">
                <span>Open Guardian</span>
                <i data-lucide="chevron-right" aria-hidden="true"></i>
              </button>
            </div>

            <!-- Feature 6: Daily Income Monitoring -->
            <div class="feature-card perspective-3d-card" data-feature-target="guardian">
              <div class="feature-icon-header">
                <div class="feature-icon icon-lavender">
                  <i data-lucide="calendar" aria-hidden="true"></i>
                </div>
                <span class="feature-status-tag tag-ready">Ready to use</span>
              </div>
              <h3 class="feature-title">Daily Income Monitoring</h3>
              <p class="feature-desc">
                Translates your monthly salary into a clear daily benchmark (Monthly Income / Calendar Days), giving you an intuitive daily baseline.
              </p>
              <button type="button" class="feature-action-btn" data-nav="guardian">
                <span>View Daily Benchmark</span>
                <i data-lucide="chevron-right" aria-hidden="true"></i>
              </button>
            </div>

            <!-- Feature 7: Spending Protection -->
            <div class="feature-card perspective-3d-card" data-feature-target="settings">
              <div class="feature-icon-header">
                <div class="feature-icon icon-purple">
                  <i data-lucide="alert-octagon" aria-hidden="true"></i>
                </div>
                <span class="feature-status-tag tag-ready">Ready to use</span>
              </div>
              <h3 class="feature-title">Spending Protection</h3>
              <p class="feature-desc">
                Switch between Strict Mode (blocks discretionary spending when daily allowance is exhausted) and Warning-Only Mode. Protects essential living reserves.
              </p>
              <button type="button" class="feature-action-btn" data-nav="settings">
                <span>Manage Protection Mode</span>
                <i data-lucide="chevron-right" aria-hidden="true"></i>
              </button>
            </div>

            <!-- Feature 8: Bills & Subscriptions -->
            <div class="feature-card perspective-3d-card" data-feature-target="bills">
              <div class="feature-icon-header">
                <div class="feature-icon icon-pink">
                  <i data-lucide="receipt" aria-hidden="true"></i>
                </div>
                <span class="feature-status-tag tag-ready">Ready to use</span>
              </div>
              <h3 class="feature-title">Bills & Subscriptions</h3>
              <p class="feature-desc">
                Tracks recurring utilities, rent, broadband, and subscriptions with smart due-date alerts (7-day, 3-day, 1-day, today, and overdue) and 1-click payment deduction.
              </p>
              <button type="button" class="feature-action-btn" data-nav="bills">
                <span>Manage Scheduled Bills</span>
                <i data-lucide="chevron-right" aria-hidden="true"></i>
              </button>
            </div>

            <!-- Feature 9: Intelligent Savings Recommendations -->
            <div class="feature-card perspective-3d-card" data-feature-target="goals">
              <div class="feature-icon-header">
                <div class="feature-icon icon-lavender">
                  <i data-lucide="target" aria-hidden="true"></i>
                </div>
                <span class="feature-status-tag tag-ready">Ready to use</span>
              </div>
              <h3 class="feature-title">Savings Goals & Allocations</h3>
              <p class="feature-desc">
                Five-tier financial hierarchy that evaluates your liquidity, protects emergency reserves, and recommends how to allocate surplus rupees.
              </p>
              <button type="button" class="feature-action-btn" data-nav="goals">
                <span>Explore Goals</span>
                <i data-lucide="chevron-right" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- =====================================================================
           SECTION 4: MONEY GUARDIAN DEDICATED SHOWCASE
           ===================================================================== -->
      <section id="guardian-preview" class="home-section guardian-preview-section" aria-label="Money Guardian Showcase">
        <div class="home-container">
          <div class="guardian-preview-box perspective-3d-card">
            <div class="guardian-preview-left">
              <span class="section-kicker kicker-pink">Active Financial Watchdog</span>
              <h2 class="section-title">Money Guardian: Your Personal Financial Control System</h2>
              <p class="section-desc">
                Money Guardian evaluates every transaction against your real-time financial reality. It computes your daily safe allowance, protects essential living reserves, and prevents accidental overspending.
              </p>

              <div class="guardian-checklist">
                <div class="check-item">
                  <div class="check-icon">
                    <i data-lucide="check" aria-hidden="true"></i>
                  </div>
                  <div>
                    <strong>Daily Safe Allowance Engine:</strong>
                    <span>Automatically recalculates daily discretionary budget based on remaining calendar days and unspent surplus.</span>
                  </div>
                </div>

                <div class="check-item">
                  <div class="check-icon">
                    <i data-lucide="check" aria-hidden="true"></i>
                  </div>
                  <div>
                    <strong>8 Protected Essential Reserves:</strong>
                    <span>Housing, Utilities, Groceries, Healthcare, Debt, and Emergency funds are ring-fenced so shopping cannot touch them.</span>
                  </div>
                </div>

                <div class="check-item">
                  <div class="check-icon">
                    <i data-lucide="check" aria-hidden="true"></i>
                  </div>
                  <div>
                    <strong>Multi-Tier Bill Reminders:</strong>
                    <span>Autonomous notifications at 7 days, 3 days, 1 day, and on due date keep you ahead of recurring obligations.</span>
                  </div>
                </div>
              </div>

              <div class="guardian-action-row">
                <button type="button" class="btn btn-primary btn-launch-guardian">
                  <i data-lucide="shield" class="btn-icon" aria-hidden="true"></i>
                  <span>Launch Money Guardian</span>
                </button>
                <button type="button" class="btn btn-secondary btn-simulate-spend">
                  <i data-lucide="play" class="btn-icon" aria-hidden="true"></i>
                  <span>Simulate a Guarded Transaction</span>
                </button>
              </div>
            </div>

            <!-- Interactive Visual Preview Card -->
            <div class="guardian-preview-right">
              <div class="live-guardian-widget perspective-3d-card">
                <div class="widget-header">
                  <div class="widget-title-row">
                    <span class="widget-pulse"></span>
                    <span class="widget-title">Live Guardian Telemetry</span>
                  </div>
                  <span class="status-pill badge-success">Strict Mode Active</span>
                </div>

                <div class="widget-metrics-row">
                  <div class="widget-stat">
                    <span class="stat-lbl">Bank Balance</span>
                    <div class="stat-val text-primary tabular-nums">₹2,47,250</div>
                  </div>
                  <div class="widget-stat">
                    <span class="stat-lbl">Daily Safe Allowance</span>
                    <div class="stat-val text-purple tabular-nums">₹18,776</div>
                  </div>
                </div>

                <!-- Allowance Consumption Progress Bar -->
                <div class="widget-meter-box">
                  <div class="widget-meter-labels">
                    <span>Today's Discretionary Spending</span>
                    <span class="tabular-nums">₹2,700 / ₹21,476 (13%)</span>
                  </div>
                  <div class="progress-track">
                    <div class="progress-bar is-healthy" style="width: 13%;"></div>
                  </div>
                  <div class="widget-meter-footer">
                    <span class="text-success">✓ ₹18,776 remaining today</span>
                    <span>Status: Healthy</span>
                  </div>
                </div>

                <!-- Simulation Result Notice -->
                <div class="widget-notice-box">
                  <div class="notice-icon-box">
                    <i data-lucide="info" aria-hidden="true"></i>
                  </div>
                  <div class="notice-text">
                    <strong>Autonomous Protection in Effect:</strong>
                    <span>Discretionary transactions exceeding ₹18,776 today will be safely blocked, preserving your living reserves.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- =====================================================================
           SECTION 5: FINANCIAL GROWTH SECTION
           ===================================================================== -->
      <section id="growth" class="home-section growth-section" aria-label="Financial Growth">
        <div class="home-container">
          <div class="section-header text-center">
            <span class="section-kicker">Sustainable Financial Health</span>
            <h2 class="section-title">Small Financial Decisions. A Stronger Future.</h2>
            <p class="section-subtitle">
              Financial independence is built through consistent, disciplined habits. SpendWise helps you cultivate confidence without false promises or unrealistic claims.
            </p>
          </div>

          <div class="growth-cards-grid">
            <div class="growth-card perspective-3d-card">
              <div class="growth-step-num">01</div>
              <h3 class="growth-title">Ring-Fence Emergency Cash</h3>
              <p class="growth-desc">
                Establish an emergency cushion covering 3 to 6 months of non-negotiable living expenses. SpendWise keeps this amount protected from daily impulses.
              </p>
              <div class="growth-metric-box">
                <span class="growth-metric-label">Target Cushion:</span>
                <span class="growth-metric-val tabular-nums">₹1,50,000.00</span>
              </div>
            </div>

            <div class="growth-card perspective-3d-card">
              <div class="growth-step-num">02</div>
              <h3 class="growth-title">Conquer Recurring Obligations</h3>
              <p class="growth-desc">
                Never pay a late fee or experience service suspension. Scheduled bills are categorized as essential and deducted cleanly from your cashflow.
              </p>
              <div class="growth-metric-box">
                <span class="growth-metric-label">Upcoming Bills:</span>
                <span class="growth-metric-val tabular-nums">100% Scheduled</span>
              </div>
            </div>

            <div class="growth-card perspective-3d-card">
              <div class="growth-step-num">03</div>
              <h3 class="growth-title">Live Inside Daily Allowance</h3>
              <p class="growth-desc">
                Instead of restrictive deprivation diets, spend freely within your daily safe allowance knowing your future bills and savings are already locked.
              </p>
              <div class="growth-metric-box">
                <span class="growth-metric-label">Daily Peace of Mind:</span>
                <span class="growth-metric-val text-success">Guaranteed</span>
              </div>
            </div>

            <div class="growth-card perspective-3d-card">
              <div class="growth-step-num">04</div>
              <h3 class="growth-title">Channel Surplus into Milestones</h3>
              <p class="growth-desc">
                Surplus funds are automatically recommended for milestone goals: higher education, home deposits, career transitions, and personal projects.
              </p>
              <div class="growth-metric-box">
                <span class="growth-metric-label">Savings Target:</span>
                <span class="growth-metric-val text-purple tabular-nums">Compound Growth</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- =====================================================================
           SECTION 6: HOW IT WORKS
           ===================================================================== -->
      <section id="how-it-works" class="home-section how-it-works-section" aria-label="How It Works">
        <div class="home-container">
          <div class="section-header text-center">
            <span class="section-kicker">Simple 3-Step Flow</span>
            <h2 class="section-title">How SpendWise Powers Your Financial Life</h2>
            <p class="section-subtitle">
              Get up and running in minutes with no complex setup, no bank credentials needed, and immediate clarity.
            </p>
          </div>

          <div class="steps-flow-grid">
            <div class="step-card perspective-3d-card">
              <div class="step-number-circle">1</div>
              <div class="step-icon-wrap icon-purple">
                <i data-lucide="plug-zap" aria-hidden="true"></i>
              </div>
              <h3 class="step-heading">Connect or Log</h3>
              <p class="step-text">
                Connect your SpendWise Demo Bank or log income and expenses manually. All records are stored securely in your local database.
              </p>
            </div>

            <div class="step-connector" aria-hidden="true">
              <i data-lucide="arrow-right"></i>
            </div>

            <div class="step-card perspective-3d-card">
              <div class="step-number-circle">2</div>
              <div class="step-icon-wrap icon-pink">
                <i data-lucide="shield-check" aria-hidden="true"></i>
              </div>
              <h3 class="step-heading">Monitor & Protect</h3>
              <p class="step-text">
                Money Guardian tracks your daily income benchmark, checks spending limits, and ring-fences funds for upcoming bills and reserves.
              </p>
            </div>

            <div class="step-connector" aria-hidden="true">
              <i data-lucide="arrow-right"></i>
            </div>

            <div class="step-card perspective-3d-card">
              <div class="step-number-circle">3</div>
              <div class="step-icon-wrap icon-lavender">
                <i data-lucide="trending-up" aria-hidden="true"></i>
              </div>
              <h3 class="step-heading">Make Smarter Decisions</h3>
              <p class="step-text">
                Review high-definition analytics, follow intelligent savings recommendations, and watch your financial confidence grow every single day.
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- =====================================================================
           SECTION 7: FINAL CALL TO ACTION
           ===================================================================== -->
      <section class="home-section cta-section" aria-label="Final Call to Action">
        <div class="home-container">
          <div class="final-cta-card perspective-3d-card">
            <div class="final-cta-glow" aria-hidden="true"></div>
            <div class="final-cta-content">
              <span class="cta-kicker">Immediate Financial Clarity</span>
              <h2 class="cta-heading">Your Financial Future Starts Today.</h2>
              <p class="cta-subtext">
                Join users who have eliminated money anxiety, protected their savings, and built lasting discipline with SpendWise.
              </p>
              <div class="cta-btn-wrap">
                <button type="button" class="btn btn-primary btn-cta-main btn-launch-app">
                  <span>Start Using SpendWise</span>
                  <i data-lucide="arrow-right" class="btn-icon" aria-hidden="true"></i>
                </button>
                <button type="button" class="btn btn-secondary btn-cta-sub btn-open-demo-bank">
                  <i data-lucide="building-2" class="btn-icon" aria-hidden="true"></i>
                  <span>Launch Demo Bank</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- =====================================================================
           SECTION 8: FOOTER
           ===================================================================== -->
      <footer class="home-footer" role="contentinfo">
        <div class="home-container footer-layout">
          <div class="footer-brand-col">
            <div class="footer-brand">
              <span class="footer-logo-icon">
                <i data-lucide="sparkles" aria-hidden="true"></i>
              </span>
              <span class="footer-brand-title">SPEND <span>WISE</span></span>
            </div>
            <p class="footer-tagline">
              Intelligent Personal Financial Control Platform. Track every rupee, protect essential living reserves, and cultivate positive money habits.
            </p>
            <div class="footer-tech-stack">
              <span>Stack: Node.js · Express · SQLite · Vanilla JS</span>
            </div>
          </div>

          <div class="footer-links-col">
            <h4 class="footer-col-title">Navigation</h4>
            <ul class="footer-links">
              <li><a href="#hero">Home</a></li>
              <li><button type="button" class="footer-btn-link" data-nav="dashboard">Dashboard</button></li>
              <li><button type="button" class="footer-btn-link" data-nav="transactions">Transactions</button></li>
              <li><button type="button" class="footer-btn-link" data-nav="analytics">Analytics</button></li>
              <li><button type="button" class="footer-btn-link" data-nav="budget">Budget Envelopes</button></li>
            </ul>
          </div>

          <div class="footer-links-col">
            <h4 class="footer-col-title">Intelligent Systems</h4>
            <ul class="footer-links">
              <li><button type="button" class="footer-btn-link" data-nav="bank">Smart Bank Connect</button></li>
              <li><button type="button" class="footer-btn-link" data-nav="guardian">Money Guardian</button></li>
              <li><button type="button" class="footer-btn-link" data-nav="bills">Bills & Subscriptions</button></li>
              <li><button type="button" class="footer-btn-link" data-nav="goals">Savings Goals</button></li>
              <li><button type="button" class="footer-btn-link" data-nav="settings">Protection Settings</button></li>
            </ul>
          </div>

          <div class="footer-links-col">
            <h4 class="footer-col-title">Platform Integrity</h4>
            <ul class="footer-links">
              <li><span class="footer-text-muted">Single-User Local Environment</span></li>
              <li><span class="footer-text-muted">Simulated Demo Banking Only</span></li>
              <li><span class="footer-text-muted">No Real Financial Credentials</span></li>
              <li><span class="footer-text-muted">Zero Cloud Data Tracking</span></li>
            </ul>
          </div>
        </div>

        <div class="footer-bottom-bar">
          <div class="home-container footer-bottom-inner">
            <p>© 2026 SpendWise. All rights reserved. Built for positive financial habits.</p>
            <div class="footer-bottom-badges">
              <span class="status-pill badge-neutral">v2.0 Premium 3D</span>
              <span class="status-pill badge-success">Local SQLite Verified</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  `;

  // Hydrate Lucide Icons
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }

  // Bind CTA and Navigation Buttons
  bindHomepageEvents(container, actions);

  // Initialize Hero 3D Parallax Tilt
  initHero3DParallax();
}

/**
 * Attaches event listeners for CTAs, feature clicks, and smooth scrolling.
 */
function bindHomepageEvents(container, actions) {
  // Launch App / Dashboard buttons
  container.querySelectorAll('.btn-launch-app').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      actions.navigate('dashboard');
    });
  });

  // Launch Demo Bank
  container.querySelectorAll('.btn-open-demo-bank').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      actions.navigate('bank');
    });
  });

  // Launch Money Guardian
  container.querySelectorAll('.btn-launch-guardian').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      actions.navigate('guardian');
    });
  });

  // Simulate a guarded transaction
  container.querySelectorAll('.btn-simulate-spend').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      actions.navigate('guardian');
      // Import modal dynamically
      try {
        const { openGuardedSimulationModal } = await import('./money-guardian.js');
        openGuardedSimulationModal(actions, () => {
          actions.refreshAll();
        });
      } catch (err) {
        console.warn('Could not launch guarded modal directly:', err);
      }
    });
  });

  // Feature cards direct view jump
  container.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = btn.dataset.nav;
      if (targetView) actions.navigate(targetView);
    });
  });

  // Smooth in-page scrolling for anchor tags
  container.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const href = anchor.getAttribute('href');
      if (href === '#home' || href === '#hero') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const targetEl = container.querySelector(href);
      if (targetEl) {
        e.preventDefault();
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

/**
 * Lightweight 3D mouse parallax tracking for the Hero 3D Scene.
 */
function initHero3DParallax() {
  const stage = document.getElementById('hero-3d-stage');
  const bankCard = document.getElementById('hero-bank-card');
  const badge1 = document.getElementById('float-badge-1');
  const badge2 = document.getElementById('float-badge-2');
  const badge3 = document.getElementById('float-badge-3');

  if (!stage || !bankCard) return;

  // Respect user preference for reduced motion
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  heroMouseMoveHandler = (e) => {
    const rect = stage.getBoundingClientRect();
    // Only calculate when visible in viewport
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;

    const mouseX = e.clientX - (rect.left + rect.width / 2);
    const mouseY = e.clientY - (rect.top + rect.height / 2);

    const rotX = -(mouseY / (rect.height / 2)) * 12;
    const rotY = (mouseX / (rect.width / 2)) * 14;

    // Apply 3D perspective to main bank card
    bankCard.style.transform = `perspective(1000px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) translateZ(16px)`;

    // Apply tiered parallax depth to floating badges
    if (badge1) {
      badge1.style.transform = `translate3d(${(mouseX * 0.04).toFixed(1)}px, ${(mouseY * 0.04).toFixed(1)}px, 30px)`;
    }
    if (badge2) {
      badge2.style.transform = `translate3d(${(-mouseX * 0.05).toFixed(1)}px, ${(-mouseY * 0.05).toFixed(1)}px, 45px)`;
    }
    if (badge3) {
      badge3.style.transform = `translate3d(${(mouseX * 0.03).toFixed(1)}px, ${(-mouseY * 0.03).toFixed(1)}px, 20px)`;
    }
  };

  window.addEventListener('mousemove', heroMouseMoveHandler, { passive: true });
}
