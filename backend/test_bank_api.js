const http = require('http');
const app = require('./src/server');

const PORT = 3004;
let server;

function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        ...options,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(body);
          } catch (e) {
            parsed = body;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );

    req.on('error', reject);

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  const results = [];
  function logResult(name, passed, details) {
    results.push({ name, passed, details });
    console.log(`${passed ? '✓ PASS' : '✗ FAIL'}: ${name}`);
    if (!passed) console.log('  Details:', details);
  }

  server = app.listen(PORT, async () => {
    console.log(`Bank API test server running on port ${PORT}\n--- RUNNING BANK API TESTS ---`);

    try {
      // 1. Account summary
      const acc = await request({ path: '/api/bank/account', method: 'GET' });
      logResult('GET /api/bank/account returns 200 and demo details', acc.status === 200 && acc.body.data.bank_name === 'SpendWise Demo Bank' && acc.body.data.balance > 0, acc);

      const initialBalance = acc.body.data.balance;

      // 2. Deposit simulation
      const deposit = await request(
        { path: '/api/bank/transactions', method: 'POST', headers: { 'Content-Type': 'application/json' } },
        { type: 'credit', amount: 5000, category: 'Cash Deposit', description: 'Simulated cash deposit ATM', date: '2026-11-14' }
      );
      logResult('POST /api/bank/transactions processes deposit (201)', deposit.status === 201 && deposit.body.data.amount === 5000 && deposit.body.updatedBalance === initialBalance + 5000, deposit);
      const testDepositId = deposit.body?.data?.id;

      // 3. Withdrawal simulation
      const withdraw = await request(
        { path: '/api/bank/transactions', method: 'POST', headers: { 'Content-Type': 'application/json' } },
        { type: 'debit', amount: 2000, category: 'Shopping', description: 'Weekend electronics purchase', date: '2026-11-14' }
      );
      logResult('POST /api/bank/transactions processes withdrawal (201)', withdraw.status === 201 && withdraw.body.data.amount === 2000 && withdraw.body.updatedBalance === initialBalance + 5000 - 2000, withdraw);
      const testWithdrawId = withdraw.body?.data?.id;

      // 4. Overdraft Prevention Test
      const overdraft = await request(
        { path: '/api/bank/transactions', method: 'POST', headers: { 'Content-Type': 'application/json' } },
        { type: 'debit', amount: 99999999, category: 'Luxury Car', description: 'Overdraft test', date: '2026-11-14' }
      );
      logResult('POST /api/bank/transactions rejects overdraft exceeding balance (400)', overdraft.status === 400 && overdraft.body.success === false && overdraft.body.error.includes('Insufficient account balance'), overdraft);

      // 5. Negative amount validation
      const negAmount = await request(
        { path: '/api/bank/transactions', method: 'POST', headers: { 'Content-Type': 'application/json' } },
        { type: 'credit', amount: -500, category: 'Salary', date: '2026-11-14' }
      );
      logResult('POST /api/bank/transactions rejects negative amount (400)', negAmount.status === 400, negAmount);

      // 6. Search and filter transactions
      const searchRes = await request({ path: '/api/bank/transactions?search=ATM', method: 'GET' });
      logResult('GET /api/bank/transactions?search=ATM filters records (200)', searchRes.status === 200 && Array.isArray(searchRes.body.data) && searchRes.body.data.length >= 1, searchRes);

      const filterDebits = await request({ path: '/api/bank/transactions?type=debit', method: 'GET' });
      logResult('GET /api/bank/transactions?type=debit filters debits (200)', filterDebits.status === 200 && filterDebits.body.data.every((t) => t.type === 'debit'), filterDebits);

      // 7. Settings update
      const updateSettings = await request(
        { path: '/api/bank/settings', method: 'PUT', headers: { 'Content-Type': 'application/json' } },
        { min_savings_balance: 30000, risk_preference: 'growth', emergency_fund_target: 120000 }
      );
      logResult('PUT /api/bank/settings updates settings (200)', updateSettings.status === 200 && updateSettings.body.data.min_savings_balance === 30000 && updateSettings.body.data.risk_preference === 'growth', updateSettings);

      // 8. Financial Goals CRUD
      const createGoal = await request(
        { path: '/api/bank/goals', method: 'POST', headers: { 'Content-Type': 'application/json' } },
        { name: 'Motorcycle Upgrade', target_amount: 150000, current_amount: 20000, target_date: '2027-10-31', category: 'vehicle' }
      );
      logResult('POST /api/bank/goals creates goal (201)', createGoal.status === 201 && createGoal.body.data.name === 'Motorcycle Upgrade', createGoal);
      const goalId = createGoal.body?.data?.id;

      const updateGoal = await request(
        { path: `/api/bank/goals/${goalId}`, method: 'PUT', headers: { 'Content-Type': 'application/json' } },
        { current_amount: 35000 }
      );
      logResult('PUT /api/bank/goals/:id updates progress (200)', updateGoal.status === 200 && updateGoal.body.data.current_amount === 35000, updateGoal);

      const delGoal = await request({ path: `/api/bank/goals/${goalId}`, method: 'DELETE' });
      logResult('DELETE /api/bank/goals/:id deletes goal (200)', delGoal.status === 200, delGoal);

      // 9. Import to SpendWise & Duplicate Prevention
      const importTx = await request(
        { path: '/api/bank/import-to-spendwise', method: 'POST', headers: { 'Content-Type': 'application/json' } },
        { bank_tx_id: testDepositId }
      );
      logResult('POST /api/bank/import-to-spendwise imports to SpendWise ledger (201)', importTx.status === 201 && importTx.body.data.type === 'income', importTx);

      const duplicateImport = await request(
        { path: '/api/bank/import-to-spendwise', method: 'POST', headers: { 'Content-Type': 'application/json' } },
        { bank_tx_id: testDepositId }
      );
      logResult('POST /api/bank/import-to-spendwise prevents duplicate import (409)', duplicateImport.status === 409 && duplicateImport.body.success === false, duplicateImport);

      // Clean up test transactions
      const db = require('./src/config/database');
      if (testDepositId) db.prepare('DELETE FROM bank_transactions WHERE id = ?').run(testDepositId);
      if (testWithdrawId) db.prepare('DELETE FROM bank_transactions WHERE id = ?').run(testWithdrawId);
      if (importTx.body?.data?.id) db.prepare('DELETE FROM transactions WHERE id = ?').run(importTx.body.data.id);

      // 10. Disconnect & Reconnect Demo Account
      const toggle1 = await request({ path: '/api/bank/account/toggle', method: 'POST' });
      logResult('POST /api/bank/account/toggle disconnects demo account (200)', toggle1.status === 200 && toggle1.body.isConnected === false, toggle1);

      const toggle2 = await request({ path: '/api/bank/account/toggle', method: 'POST' });
      logResult('POST /api/bank/account/toggle reconnects demo account (200)', toggle2.status === 200 && toggle2.body.isConnected === true, toggle2);

      console.log('\n--- BANK API TEST SUMMARY ---');
      const passCount = results.filter((r) => r.passed).length;
      console.log(`Passed: ${passCount} / ${results.length}`);

      server.close(() => {
        process.exit(passCount === results.length ? 0 : 1);
      });
    } catch (err) {
      console.error('Test execution error:', err);
      server.close(() => process.exit(1));
    }
  });
}

runTests();
