const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { generateDescription } = require('../controllers/worqhatapiController');

router.post('/generate-description', generateDescription);

module.exports = router; 