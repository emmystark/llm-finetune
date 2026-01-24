const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

const app = express();
const PORT = process.env.BACKEND_PORT || 3000;

// Initialize Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Middleware
app.use(cors({
  origin: [process.env.FRONTEND_URL || 'http://localhost:3001', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes - pass supabase as middleware
const transactionsRouter = require('./routes/transactions');
const authRouter = require('./routes/auth');
const aiRouter = require('./routes/ai');

app.use((req, res, next) => {
  req.supabase = supabase;
  next();
});

app.use('/api/auth', authRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/ai', aiRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

// Export for testing and use in routes
module.exports = { app, supabase };

// Start server
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log(`CORS enabled for frontend at ${process.env.FRONTEND_URL || 'http://localhost:3001'}`);
});