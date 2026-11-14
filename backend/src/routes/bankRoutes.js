const express = require('express');
const router = express.Router();
const bankController = require('../controllers/bankController');

router.get('/account', bankController.getAccountSummary);
router.post('/account/toggle', bankController.toggleConnection);
router.post('/account/refresh', bankController.refreshAccount);

router.get('/transactions', bankController.getBankTransactions);
router.post('/transactions', bankController.createBankTransaction);

router.get('/settings', bankController.getSettings);
router.put('/settings', bankController.updateSettings);

router.get('/goals', bankController.getGoals);
router.post('/goals', bankController.createGoal);
router.put('/goals/:id', bankController.updateGoal);
router.delete('/goals/:id', bankController.deleteGoal);

router.post('/import-to-spendwise', bankController.importToSpendWise);

router.get('/dismissed-alerts', bankController.getDismissedAlerts);
router.post('/dismiss-alert', bankController.dismissAlert);

module.exports = router;
