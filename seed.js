require('dotenv').config();
const bcrypt = require('bcryptjs');
const sequelize = require('./config/database');
const { User } = require('./models');

async function seed() {
  try {
    await sequelize.authenticate();
    await sequelize.sync();

    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@futurestack.com';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';

    const existingAdmin = await User.findOne({ where: { email: adminEmail } });
    if (!existingAdmin) {
      await User.create({
        name: 'System Admin',
        email: adminEmail,
        password: await bcrypt.hash(adminPassword, 10),
        role: 'admin',
        is_active: true
      });
      console.log(`✅ Admin created: ${adminEmail} / ${adminPassword}`);
    } else {
      console.log('ℹ️  Admin already exists, skipping');
    }

    const sampleUsers = [
      { name: 'Traffic Manager', email: 'traffic@futurestack.com', password: 'Traffic123!', role: 'traffic_manager' },
      { name: 'Salesman One', email: 'sales1@futurestack.com', password: 'Sales123!', role: 'salesman' },
      { name: 'Salesman Two', email: 'sales2@futurestack.com', password: 'Sales123!', role: 'salesman' }
    ];

    for (const u of sampleUsers) {
      const existing = await User.findOne({ where: { email: u.email } });
      if (!existing) {
        await User.create({
          name: u.name,
          email: u.email,
          password: await bcrypt.hash(u.password, 10),
          role: u.role,
          is_active: true
        });
        console.log(`✅ Created ${u.role}: ${u.email} / ${u.password}`);
      } else {
        console.log(`ℹ️  ${u.email} already exists, skipping`);
      }
    }

    console.log('\nSeeding complete.');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

seed();
