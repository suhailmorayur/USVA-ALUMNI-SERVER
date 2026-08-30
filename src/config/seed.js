const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const Admin = require('../models/Admin');
const Settings = require('../models/Settings');
const Member = require('../models/Member');

const seedDatabase = async () => {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    // 1. Clear existing data
    console.log('Clearing existing collections...');
    await Admin.deleteMany({});
    await Settings.deleteMany({});
    await Member.deleteMany({});
    console.log('Collections cleared.');

    // 2. Create Default Admin
    console.log('Seeding default Admin...');
    const adminPassword = 'adminpassword123';
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const defaultAdmin = await Admin.create({
      name: 'USVA Super Admin',
      email: 'admin@usva.org',
      passwordHash: passwordHash,
      role: 'superadmin'
    });
    console.log(`Admin seeded. Email: admin@usva.org, Password: ${adminPassword}`);

    // 3. Create Default Settings
    console.log('Seeding default Settings...');
    const defaultSettings = await Settings.create({
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
    console.log('Settings seeded.');

    // 4. Create Sample Members (Dummy data, not copy of reference card)
    console.log('Seeding sample members...');

    const member1 = await Member.create({
      fullName: 'Ahmad Shihab',
      sand: ['umari'],
      place: 'Kondotty',
      admissionNumber: '1024',
      phone: '9876543210',
      email: 'ahmad@example.com',
      photoUrl: 'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg',
      photoPublicId: 'sample',
      applicationStatus: 'under_review',
      paymentStatus: 'paid'
    });

    const member2 = await Member.create({
      fullName: 'Muhammad Faizy K',
      sand: ['faizy'],
      place: 'Arimbra',
      admissionNumber: '1098',
      phone: '9876543211',
      email: 'muhammad@example.com',
      photoUrl: 'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg',
      photoPublicId: 'sample',
      applicationStatus: 'approved',
      paymentStatus: 'paid',
      membershipId: 'ALUMNI-2026-00001'
    });

    const member3 = await Member.create({
      fullName: 'Suhail Ahmed',
      sand: ['umari', 'faizy'],
      place: 'Morayur',
      admissionNumber: '1102',
      phone: '9876543212',
      email: 'suhail@example.com',
      photoUrl: 'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg',
      photoPublicId: 'sample',
      applicationStatus: 'payment_pending',
      paymentStatus: 'pending'
    });

    const member4 = await Member.create({
      fullName: 'Zainuddin Ahmed',
      sand: [],
      place: 'Malappuram',
      admissionNumber: '1150',
      phone: '9876543213',
      email: 'zain@example.com',
      photoUrl: 'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg',
      photoPublicId: 'sample',
      applicationStatus: 'draft',
      paymentStatus: 'pending'
    });

    // Seed student user accounts for approved members (No longer required - authentication removed)
    console.log('Skipping student account seeding (authentication removed).');

    console.log('Database seeded successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
