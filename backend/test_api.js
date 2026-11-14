const http = require('http');
const app = require('./src/server');

const PORT = 3001; // test port
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
    console.log(`Test server running on port ${PORT}\n--- RUNNING API TESTS ---`);

    try {
      // 1. Health Check
      const health = await request({ path: '/api/health', method: 'GET' });
      logResult('GET /api/health returns 200 and status ok', health.status === 200 && health.body.status === 'ok', health);

      // 2. Static file serving (GET /)
      const rootHtml = await request({ path: '/', method: 'GET' });
      logResult('GET / serves frontend index.html', rootHtml.status === 200 && typeof rootHtml.body === 'string' && (rootHtml.body.includes('SpendWise') || rootHtml.body.includes('ClearLedger')), rootHtml);

      // 3. Transactions - Initial list
      const txList = await request({ path: '/api/transactions', method: 'GET' });
      logResult('GET /api/transactions returns 200', txList.status === 200 && Array.isArray(txList.body.data), txList);

      // 4. POST /api/transactions - Validation errors
      const noTitle = await request(
        { path: '/api/transactions', method: 'POST', headers: { 'Content-Type': 'application/json' } },
        { amount: 100, category: 'Food', type: 'expense', date: '2026-11-14' }
      );
      logResult('POST /api/transactions rejects missing title (400)', noTitle.status === 400 && noTitle.body.success === false, noTitle);

      const negAmount = await request(
        { path: '/api/transactions', method: 'POST', headers: { 'Content-Type': 'application/json' } },
        { title: 'Dinner', amount: -50, category: 'Food', type: 'expense', date: '2026-11-14' }
      );
      logResult('POST /api/transactions rejects negative amount (400)', negAmount.status === 400 && negAmount.body.success === false, negAmount);

      const zeroAmount = await request(
        { path: '/api/transactions', method: 'POST', headers: { 'Content-Type': 'application/json' } },
        { title: 'Dinner', amount: 0, category: 'Food', type: 'expense', date: '2026-11-14' }
      );
      logResult('POST /api/transactions rejects zero amount (400)', zeroAmount.status === 400 && zeroAmount.body.success === false, zeroAmount);

      const badType = await request(
        { path: '/api/transactions', method: 'POST', headers: { 'Content-Type': 'application/json' } },
        { title: 'Refund', amount: 50, category: 'Food', type: 'other', date: '2026-11-14' }
      );
      logResult('POST /api/transactions rejects invalid type (400)', badType.status === 400 && badType.body.success === false, badType);

      const badDate = await request(
        { path: '/api/transactions', method: 'POST', headers: { 'Content-Type': 'application/json' } },
        { title: 'Dinner', amount: 50, category: 'Food', type: 'expense', date: 'not-a-date' }
      );
      logResult('POST /api/transactions rejects invalid date (400)', badDate.status === 400 && badDate.body.success === false, badDate);

      // 5. POST /api/transactions - Create valid transactions
      const createIncome = await request(
        { path: '/api/transactions', method: 'POST', headers: { 'Content-Type': 'application/json' } },
        { title: 'Consulting Fee', amount: 1200.5, category: 'Freelance', type: 'income', date: '2026-11-10', description: 'Web audit' }
      );
      logResult('POST /api/transactions creates income (201)', createIncome.status === 201 && createIncome.body.data.amount === 1200.5 && createIncome.body.data.type === 'income', createIncome);
      const incomeId = createIncome.body?.data?.id;

      const createExpense = await request(
        { path: '/api/transactions', method: 'POST', headers: { 'Content-Type': 'application/json' } },
        { title: 'Organic Groceries', amount: 85.25, category: 'Food', type: 'expense', date: '2026-11-12', description: 'Weekly vegetables' }
      );
      logResult('POST /api/transactions creates expense (201)', createExpense.status === 201 && createExpense.body.data.amount === 85.25 && createExpense.body.data.type === 'expense', createExpense);
      const expenseId = createExpense.body?.data?.id;

      // 6. GET /api/transactions/:id
      const getSingle = await request({ path: `/api/transactions/${incomeId}`, method: 'GET' });
      logResult('GET /api/transactions/:id returns single record (200)', getSingle.status === 200 && getSingle.body.data.id === incomeId, getSingle);

      const getInvalidId = await request({ path: '/api/transactions/abc', method: 'GET' });
      logResult('GET /api/transactions/:id rejects non-integer id (400)', getInvalidId.status === 400 && getInvalidId.body.success === false, getInvalidId);

      const getUnknownId = await request({ path: '/api/transactions/999999', method: 'GET' });
      logResult('GET /api/transactions/:id returns 404 for nonexistent id', getUnknownId.status === 404 && getUnknownId.body.success === false, getUnknownId);

      // 7. PUT /api/transactions/:id
      const updateTx = await request(
        { path: `/api/transactions/${expenseId}`, method: 'PUT', headers: { 'Content-Type': 'application/json' } },
        { title: 'Supermarket Groceries', amount: 95.0, category: 'Food', type: 'expense', date: '2026-11-12', description: 'Updated pantry items' }
      );
      logResult('PUT /api/transactions/:id updates record (200)', updateTx.status === 200 && updateTx.body.data.title === 'Supermarket Groceries' && updateTx.body.data.amount === 95, updateTx);

      const updateUnknown = await request(
        { path: '/api/transactions/999999', method: 'PUT', headers: { 'Content-Type': 'application/json' } },
        { title: 'None', amount: 10, category: 'Food', type: 'expense', date: '2026-11-12' }
      );
      logResult('PUT /api/transactions/:id returns 404 for nonexistent id', updateUnknown.status === 404 && updateUnknown.body.success === false, updateUnknown);

      // 8. DELETE /api/transactions/:id
      const delUnknown = await request({ path: '/api/transactions/999999', method: 'DELETE' });
      logResult('DELETE /api/transactions/:id returns 404 for nonexistent id', delUnknown.status === 404 && delUnknown.body.success === false, delUnknown);

      const delTx = await request({ path: `/api/transactions/${expenseId}`, method: 'DELETE' });
      logResult('DELETE /api/transactions/:id deletes record (200)', delTx.status === 200 && delTx.body.success === true, delTx);

      const getDeleted = await request({ path: `/api/transactions/${expenseId}`, method: 'GET' });
      logResult('Deleted transaction is no longer accessible (404)', getDeleted.status === 404, getDeleted);

      // 9. Budgets - GET /api/budgets/:year/:month
      const db = require('./src/config/database');
      db.prepare('DELETE FROM monthly_budgets WHERE year = 2099 AND month = 12').run();

      const budgetNotFound = await request({ path: '/api/budgets/2099/12', method: 'GET' });
      logResult('GET /api/budgets/:year/:month returns 404 when unset', budgetNotFound.status === 404 && budgetNotFound.body.success === false, budgetNotFound);

      const budgetBadMonth = await request({ path: '/api/budgets/2099/13', method: 'GET' });
      logResult('GET /api/budgets/:year/:month rejects invalid month (400)', budgetBadMonth.status === 400 && budgetBadMonth.body.success === false, budgetBadMonth);

      // 10. POST /api/budgets
      const budgetBadAmount = await request(
        { path: '/api/budgets', method: 'POST', headers: { 'Content-Type': 'application/json' } },
        { year: 2099, month: 12, amount: -100 }
      );
      logResult('POST /api/budgets rejects negative amount (400)', budgetBadAmount.status === 400 && budgetBadAmount.body.success === false, budgetBadAmount);

      const createBudget = await request(
        { path: '/api/budgets', method: 'POST', headers: { 'Content-Type': 'application/json' } },
        { year: 2099, month: 12, amount: 2800 }
      );
      logResult('POST /api/budgets creates budget (201)', createBudget.status === 201 && createBudget.body.data.amount === 2800, createBudget);
      const budgetId = createBudget.body?.data?.id;

      // Duplicate budget -> 409
      const dupBudget = await request(
        { path: '/api/budgets', method: 'POST', headers: { 'Content-Type': 'application/json' } },
        { year: 2099, month: 12, amount: 3000 }
      );
      logResult('POST /api/budgets returns 409 Conflict for duplicate month', dupBudget.status === 409 && dupBudget.body.success === false, dupBudget);

      // GET created budget
      const getBudgetOk = await request({ path: '/api/budgets/2099/12', method: 'GET' });
      logResult('GET /api/budgets/:year/:month returns created budget (200)', getBudgetOk.status === 200 && getBudgetOk.body.data.amount === 2800, getBudgetOk);

      // 11. PUT /api/budgets/:id
      const updateBudgetOk = await request(
        { path: `/api/budgets/${budgetId}`, method: 'PUT', headers: { 'Content-Type': 'application/json' } },
        { amount: 3200 }
      );
      logResult('PUT /api/budgets/:id updates amount (200)', updateBudgetOk.status === 200 && updateBudgetOk.body.data.amount === 3200, updateBudgetOk);

      const updateBudgetUnknown = await request(
        { path: '/api/budgets/999999', method: 'PUT', headers: { 'Content-Type': 'application/json' } },
        { amount: 3200 }
      );
      logResult('PUT /api/budgets/:id returns 404 for unknown id', updateBudgetUnknown.status === 404, updateBudgetUnknown);

      // Clean up test budget
      if (budgetId) {
        db.prepare('DELETE FROM monthly_budgets WHERE id = ?').run(budgetId);
      }

      // 12. Unknown API route -> JSON 404
      const unknownApi = await request({ path: '/api/random-endpoint', method: 'GET' });
      logResult('Unknown /api route returns JSON 404', unknownApi.status === 404 && unknownApi.body.success === false, unknownApi);

      // Clean up test transaction
      if (incomeId) {
        await request({ path: `/api/transactions/${incomeId}`, method: 'DELETE' });
      }

      console.log('\n--- TEST SUMMARY ---');
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
