import { db } from '../lib/db';
import { users, userRoles, roles } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

async function seedAdmin() {
  console.log("🌱 Seeding Admin User...");

  // Pull credentials securely from the environment variables
  const email = process.env.INITIAL_ADMIN_EMAIL;
  const plainPassword = process.env.INITIAL_ADMIN_PASSWORD;

  if (!email || !plainPassword) {
    throw new Error("❌ Missing INITIAL_ADMIN_EMAIL or INITIAL_ADMIN_PASSWORD in .env file!");
  }

  // 1. Find the "System Administrator" role
  const adminRoles = await db.select().from(roles).where(eq(roles.slug, 'system_admin'));
  if (adminRoles.length === 0) {
    console.error("❌ System Administrator role not found. Did you run 'npm run db:seed'?");
    process.exit(1);
  }

  // 2. Check if admin already exists
  const existingUsers = await db.select().from(users).where(eq(users.email, email));
  let adminUserId = "";

  if (existingUsers.length > 0) {
    console.log(`⚠️ Admin user (${email}) already exists in the database! Skipping user creation.`);
    adminUserId = existingUsers[0].id;
  } else {
    // 3. Hash the password
    const passwordHash = await bcrypt.hash(plainPassword, 12);

    // 4. Create the user
    const newUsers = await db.insert(users).values({
      email,
      passwordHash,
      isActive: true,
    }).returning();
    adminUserId = newUsers[0].id;
  }

  // 5. Link the user to the role if not already linked
  const isLinked = await db.select().from(userRoles).where(
    eq(userRoles.userId, adminUserId)
  );

  if (isLinked.length === 0) {
    await db.insert(userRoles).values({
      userId: adminUserId,
      roleId: adminRoles[0].id,
    });
    console.log(`✅ Admin user linked to System Administrator role successfully.`);
  } else {
    console.log(`ℹ️ Admin user already linked to System Administrator role.`);
  }

  console.log(`✅ Admin user created successfully!`);
  console.log(`📧 Email: ${email}`);
  // We intentionally do NOT log the password to the console in production!
  console.log(`🔑 Password securely hashed and stored.`);
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error("❌ Failed to seed admin:", err);
  process.exit(1);
});