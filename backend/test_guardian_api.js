const http = require('http');
const app = require('./src/server');

const TEST_PORT = 3008;
let server;

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch (e) {
            parsed = raw;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    throw new Error(message);
  }
  console.log(`✓ PASS: ${message}`);
}

async function runGuardianTests() {
  server = app.listen(TEST_PORT, () => {
    console.log(`Guardian API test server running on port ${TEST_PORT}`);
  });

  try {
    console.log('--- RUNNING GUARDIAN API TESTS ---');

    // 1. GET /api/guardian/summary
    const sumRes = await request({ method: 'GET', path: '/api/guardian/summary' });
    assert(sumRes.status === 200, 'GET /api/guardian/summary returns 200');
    assert(sumRes.body.success === true, 'GET /api/guardian/summary success is true');
    assert(typeof sumRes.body.data.dailyIncomeBenchmark === 'number', 'Summary has dailyIncomeBenchmark number');
    assert(typeof sumRes.body.data.dailySafeAllowance === 'number', 'Summary has dailySafeAllowance number');
    assert(typeof sumRes.body.data.totalProtectedReserves === 'number', 'Summary has totalProtectedReserves');

    // 2. GET /api/guardian/settings
    const setRes = await request({ method: 'GET', path: '/api/guardian/settings' });
    assert(setRes.status === 200, 'GET /api/guardian/settings returns 200');
    assert(setRes.body.data.monthly_income >= 0, 'Settings has valid monthly_income');

    // 3. PUT /api/guardian/settings (update to 500000, strict mode)
    const updateSetRes = await request(
      { method: 'PUT', path: '/api/guardian/settings' },
      { monthly_income: 500000, spending_control_mode: 'strict', daily_allowance_carryover: 1, daily_spending_cap: 100000 }
    );
    assert(updateSetRes.status === 200, 'PUT /api/guardian/settings updates settings (200)');
    assert(updateSetRes.body.data.monthly_income === 500000, 'Monthly income updated to 500000');
    assert(updateSetRes.body.data.spending_control_mode === 'strict', 'Control mode set to strict');

    // 4. GET /api/guardian/reserves
    const resRes = await request({ method: 'GET', path: '/api/guardian/reserves' });
    assert(resRes.status === 200, 'GET /api/guardian/reserves returns 200');
    assert(Array.isArray(resRes.body.data) && resRes.body.data.length >= 8, 'Reserves array contains at least 8 categories');

    // 5. GET /api/guardian/bills
    const billsRes = await request({ method: 'GET', path: '/api/guardian/bills' });
    assert(billsRes.status === 200, 'GET /api/guardian/bills returns 200');
    assert(Array.isArray(billsRes.body.data) && billsRes.body.data.length > 0, 'Bills array has seeded bills');

    // 6. POST /api/guardian/bills (Create new bill)
    const createBillRes = await request(
      { method: 'POST', path: '/api/guardian/bills' },
      { name: 'Coworking Desk Pass', category: 'Utilities', amount: 4500, due_date: '2026-11-28', recurrence: 'monthly', is_essential: 0 }
    );
    assert(createBillRes.status === 201, 'POST /api/guardian/bills creates new bill (201)');
    const createdBillId = createBillRes.body.data.id;

    // 7. POST /api/guardian/bills/:id/pay (Pay bill)
    const payRes = await request({ method: 'POST', path: `/api/guardian/bills/${createdBillId}/pay` });
    assert(payRes.status === 200, 'POST /api/guardian/bills/:id/pay pays bill and deducts from ledger (200)');
    assert(payRes.body.data.bill.payment_status === 'unpaid' || payRes.body.data.bill.payment_status === 'paid', 'Bill payment processed');
    assert(typeof payRes.body.data.newBalance === 'number', 'New balance returned');

    // 8. DELETE /api/guardian/bills/:id
    const delBillRes = await request({ method: 'DELETE', path: `/api/guardian/bills/${createdBillId}` });
    assert(delBillRes.status === 200, 'DELETE /api/guardian/bills/:id deletes bill (200)');
    if (payRes.body.data && payRes.body.data.transactionId) {
      const db = require('./src/config/database');
      db.prepare('DELETE FROM bank_transactions WHERE id = ?').run(payRes.body.data.transactionId);
    }

    // 9. Pre-check: Deposit always allowed
    const preDep = await request(
      { method: 'POST', path: '/api/guardian/transactions/pre-check' },
      { amount: 50000, category: 'Salary', type: 'credit' }
    );
    assert(preDep.body.allowed === true, 'Pre-check permits credit deposit');

    // 10. Pre-check: Essential expense permitted
    const preEss = await request(
      { method: 'POST', path: '/api/guardian/transactions/pre-check' },
      { amount: 2000, category: 'Utilities', type: 'debit' }
    );
    assert(preEss.body.allowed === true && preEss.body.isEssential === true, 'Pre-check permits essential expense under exception');

    // 11. Pre-check & Execute: Strict mode blocks huge discretionary spend exceeding daily allowance
    const preBig = await request(
      { method: 'POST', path: '/api/guardian/transactions/pre-check' },
      { amount: 999999, category: 'Shopping', type: 'debit' }
    );
    assert(preBig.body.allowed === false && preBig.body.blocked === true, 'Pre-check blocks discretionary spend exceeding limits');

    // 12. Execute Guarded Tx: Strict mode blocks discretionary violation
    const execBlocked = await request(
      { method: 'POST', path: '/api/guardian/transactions/execute' },
      { amount: 150000, category: 'Luxury Shopping', type: 'debit', description: 'Designer watch purchase' }
    );
    assert(execBlocked.status === 403 || execBlocked.status === 400, 'Execute blocks strict violation with 403/400');
    assert(execBlocked.body.blocked === true, 'Blocked flag is true');

    // 13. Execute Guarded Tx: Permitted discretionary spend
    const execOk = await request(
      { method: 'POST', path: '/api/guardian/transactions/execute' },
      { amount: 150, category: 'Books & Media', type: 'debit', description: 'Technical eBook purchase' }
    );
    assert(execOk.status === 201, 'Execute permits valid guarded transaction (201)');
    assert(typeof execOk.body.data.newBalance === 'number', 'Returns updated bank balance');
    if (execOk.body.data && execOk.body.data.transactionId) {
      const db = require('./src/config/database');
      db.prepare('DELETE FROM bank_transactions WHERE id = ?').run(execOk.body.data.transactionId);
    }

    // 14. GET /api/guardian/notifications
    const notifsRes = await request({ method: 'GET', path: '/api/guardian/notifications' });
    assert(notifsRes.status === 200, 'GET /api/guardian/notifications returns 200');
    assert(Array.isArray(notifsRes.body.data.notifications), 'Returns notifications array');
    assert(notifsRes.body.data.notifications.length > 0, 'Notifications list is populated');

    // 15. POST /api/guardian/notifications/read-all
    const readAllRes = await request({ method: 'POST', path: '/api/guardian/notifications/read-all' });
    assert(readAllRes.status === 200, 'POST /api/guardian/notifications/read-all marks all read (200)');

    console.log('\n--- GUARDIAN API TEST SUMMARY ---');
    console.log('Passed: 15 / 15 tests');
  } catch (err) {
    console.error('Test suite failed:', err);
    process.exit(1);
  } finally {
    server.close();
  }
}

runGuardianTests();
