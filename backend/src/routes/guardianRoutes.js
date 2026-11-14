const express = require('express');
const router = express.Router();
const guardianController = require('../controllers/guardianController');

// Summary & Intelligence
router.get('/summary', guardianController.getGuardianSummary);

// Settings
router.get('/settings', guardianController.getGuardianSettings);
router.put('/settings', guardianController.updateGuardianSettings);

// Protected Reserves
router.get('/reserves', guardianController.getProtectedReserves);
router.put('/reserves/:id', guardianController.updateProtectedReserve);

// Bills & Subscriptions
router.get('/bills', guardianController.getBills);
router.post('/bills', guardianController.createBill);
router.put('/bills/:id', guardianController.updateBill);
router.delete('/bills/:id', guardianController.deleteBill);
router.post('/bills/:id/pay', guardianController.payBill);

// Spending Blocker & Guarded Transactions
router.post('/transactions/pre-check', guardianController.preCheckTransaction);
router.post('/transactions/execute', guardianController.executeGuardedTransaction);

// Centralized Notifications
router.get('/notifications', guardianController.getNotifications);
router.post('/notifications/:id/read', guardianController.markNotificationAsRead);
router.post('/notifications/read-all', guardianController.markAllNotificationsAsRead);

module.exports = router;
