// src/seeder/seed.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Table = require('../models/Table');
const MenuItem = require('../models/Menu');
require('dotenv').config();

const users = [
  {
    username: 'admin',
    password: '123456', // Will be hashed before saving
    name: 'Admin User',
    role: 'admin'
  },
  {
    username: 'staff1',
    password: '123456',
    name: 'Nguyễn Văn A',
    role: 'staff'
  },
  {
    username: 'barista1',
    password: '123456',
    name: 'Trần Thị B',
    role: 'barista'
  }
];

// ... other seed data ...

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB...');

    // Clear existing data
    await User.deleteMany();
    await Table.deleteMany();
    await MenuItem.deleteMany();
    console.log('Data cleared...');

    // Hash passwords before seeding users
    const hashedUsers = await Promise.all(
      users.map(async (user) => {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(user.password, salt);
        return {
          ...user,
          password: hashedPassword
        };
      })
    );

    // Seed users with hashed passwords
    await User.insertMany(hashedUsers);
    console.log('Users seeded...');

    // Seed other data...
    await Table.insertMany(tables);
    await MenuItem.insertMany(menuItems);

    console.log('All data seeded successfully!');
    process.exit();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

seedData();