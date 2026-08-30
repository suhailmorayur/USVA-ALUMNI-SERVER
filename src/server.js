const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config({ override: true });

const app = express();

// Connect to Database
connectDB().then(async () => {
  try {
    const Settings = require('./models/Settings');
    const Admin = require('./models/Admin');
    const bcrypt = require('bcryptjs');

    // 1. Ensure Default Admin exists
    const hasAdmin = await Admin.findOne({ email: 'admin@usva.org' });
    if (!hasAdmin) {
      const passwordHash = await bcrypt.hash('adminpassword123', 10);
      await Admin.create({
        name: 'USVA Super Admin',
        email: 'admin@usva.org',
        passwordHash,
        role: 'superadmin'
      });
      console.log('Default Admin seeded successfully on server startup.');
    }

    // 2. Ensure Default Settings exist and use target UPI details
    const existingSettings = await Settings.findOne();
    if (!existingSettings) {
      await Settings.create({
        collegeName: 'Umarali Shihab Thangal Islamic Academy, Arimbra',
        alumniName: 'Umariyya Students Venerable Association (USVA)',
        membershipFee: 500,
        currency: 'INR',
        membershipValidity: 'Mar 2028',
        contactEmail: 'contact@usva.org',
        contactPhone: '+91 73562 26704',
        address: 'USVA Office, Academy Campus, Arimbra, Malappuram, Kerala - 673638',
        logoUrl: '',
        emailSenderName: 'USVA Secretary',
        upiId: 'bdllubaid@okhdfcbank',
        payeeName: 'Ubaidulla A'
      });
      console.log('Default Settings seeded successfully on server startup.');
    } else {
      existingSettings.upiId = 'bdllubaid@okhdfcbank';
      existingSettings.payeeName = 'Ubaidulla A';
      existingSettings.contactPhone = '+91 73562 26704';
      await existingSettings.save();
      console.log('UPI payee details auto-aligned on server startup.');
    }
  } catch (err) {
    console.error('Initialization on server boot failed:', err.message);
  }
});

// Security Middlewares
app.use(helmet({
  crossOriginResourcePolicy: false // Allows loading local image assets from server to client if needed
}));

// CORS Configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// JSON Parser
app.use(express.json({ limit: '15mb' })); // Higher limit for base64 photo uploads

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', apiLimiter);

// Import Route Handlers
const memberRoutes = require('./routes/memberRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const verifyRoutes = require('./routes/verifyRoutes');
const { getSettings } = require('./controllers/adminController');

// Mount Routes
app.use('/api/members', memberRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/verify', verifyRoutes);

// Public settings retrieval endpoint
app.get('/api/settings', getSettings);

// Serve static assets if in production and client folder is built locally
const distPath = path.resolve(__dirname, '../../client/dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('USVA Alumni Membership System API is running...');
  });
}

// Global Error Handler (Hides server stack traces from public view)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong on the server!'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
