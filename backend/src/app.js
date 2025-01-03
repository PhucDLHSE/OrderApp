const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const staffRoutes = require('./routes/staff');
const baristaRoutes = require('./routes/barista');
const adminRoutes = require('./routes/admin');

const app = express();

connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/barista', baristaRoutes);
app.use('/api/admin', adminRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});