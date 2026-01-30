import { db } from '../db';
import { users } from '../../shared/schema';
import { authService } from 'server/auth';

async function seedTestUsers() {
  console.log('🚀 Creating test users for permission testing...\n');

  try {
    // Hash password for all test users
    const testPassword = 'Test1234!';
    const hashedPassword = await authService.hashPassword(testPassword);

    // Define test users for each role (2 per role)
    const testUsers = [
      // Superadmin (2 users)
      { 
        username: 'superadmin1', 
        email: 'superadmin1@ecssr.ae', 
        password: hashedPassword,
        role: 'superadmin' as const
      },
      { 
        username: 'superadmin2', 
        email: 'superadmin2@ecssr.ae', 
        password: hashedPassword,
        role: 'superadmin' as const
      },
      
      // Division Head (2 users)
      { 
        username: 'divisionhead1', 
        email: 'divisionhead1@ecssr.ae', 
        password: hashedPassword,
        role: 'division_head' as const
      },
      { 
        username: 'divisionhead2', 
        email: 'divisionhead2@ecssr.ae', 
        password: hashedPassword,
        role: 'division_head' as const
      },
      
      // Events Lead (2 users)
      { 
        username: 'eventslead1', 
        email: 'eventslead1@ecssr.ae', 
        password: hashedPassword,
        role: 'events_lead' as const
      },
      { 
        username: 'eventslead2', 
        email: 'eventslead2@ecssr.ae', 
        password: hashedPassword,
        role: 'events_lead' as const
      },
      
      // Department Admin (2 users)
      { 
        username: 'deptadmin1', 
        email: 'deptadmin1@ecssr.ae', 
        password: hashedPassword,
        role: 'department_admin' as const
      },
      { 
        username: 'deptadmin2', 
        email: 'deptadmin2@ecssr.ae', 
        password: hashedPassword,
        role: 'department_admin' as const
      },
      
      // Department (2 users)
      { 
        username: 'department1', 
        email: 'department1@ecssr.ae', 
        password: hashedPassword,
        role: 'department' as const
      },
      { 
        username: 'department2', 
        email: 'department2@ecssr.ae', 
        password: hashedPassword,
        role: 'department' as const
      },
      
      // Employee (2 users)
      { 
        username: 'employee1', 
        email: 'employee1@ecssr.ae', 
        password: hashedPassword,
        role: 'employee' as const
      },
      { 
        username: 'employee2', 
        email: 'employee2@ecssr.ae', 
        password: hashedPassword,
        role: 'employee' as const
      },
      
      // Viewer (2 users)
      { 
        username: 'viewer1', 
        email: 'viewer1@ecssr.ae', 
        password: hashedPassword,
        role: 'viewer' as const
      },
      { 
        username: 'viewer2', 
        email: 'viewer2@ecssr.ae', 
        password: hashedPassword,
        role: 'viewer' as const
      },
    ];

    let created = 0;
    let skipped = 0;

    console.log('Creating users...\n');

    for (const user of testUsers) {
      try {
        await db.insert(users).values(user);
        console.log(`✅ Created: ${user.username.padEnd(15)} (${user.role})`);
        created++;
      } catch (error: any) {
        if (error.message?.includes('unique') || error.message?.includes('duplicate')) {
          console.log(`⏭️  Skipped: ${user.username.padEnd(15)} (already exists)`);
          skipped++;
        } else {
          console.error(`❌ Error creating ${user.username}:`, error.message);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Created: ${created} users`);
    console.log(`⏭️  Skipped: ${skipped} users (already existed)`);
    console.log(`📝 Total test users: ${testUsers.length}`);
    console.log('='.repeat(60));

    // Show all users grouped by role
    console.log('\n📋 ALL USERS BY ROLE:\n');

    const roleOrder = {
      'superadmin': 1,
      'admin': 2,
      'division_head': 3,
      'events_lead': 4,
      'department_admin': 5,
      'department': 6,
      'employee': 7,
      'viewer': 8
    };

    const allUsers = await db.select({
      username: users.username,
      email: users.email,
      role: users.role
    }).from(users);

    const groupedUsers = allUsers.reduce((acc, user) => {
      if (!acc[user.role]) acc[user.role] = [];
      acc[user.role].push(user);
      return acc;
    }, {} as Record<string, typeof allUsers>);

    Object.keys(groupedUsers)
      .sort((a, b) => (roleOrder[a as keyof typeof roleOrder] || 99) - (roleOrder[b as keyof typeof roleOrder] || 99))
      .forEach(role => {
        console.log(`\n${role.toUpperCase().replace('_', ' ')}:`);
        groupedUsers[role].forEach(user => {
          console.log(`  • ${user.username.padEnd(15)} ${user.email}`);
        });
      });

    console.log('\n' + '='.repeat(60));
    console.log('🔑 LOGIN CREDENTIALS');
    console.log('='.repeat(60));
    console.log(`Username: [any username above]`);
    console.log(`Password: ${testPassword}`);
    console.log('='.repeat(60));

    console.log('\n✅ Test users created successfully!\n');
    
    console.log('🎯 NEXT STEPS:');
    console.log('  1. Login as admin (or superadmin1)');
    console.log('  2. Navigate to: http://localhost:5000/admin/permissions');
    console.log('  3. Test granting/revoking permissions');
    console.log('  4. Check audit logs');
    console.log('  5. Login as different roles to verify permissions\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding test users:', error);
    process.exit(1);
  }
}

export default seedTestUsers;