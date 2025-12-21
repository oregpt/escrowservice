import { pool, withTransaction } from './connection.js';

async function migrateUsersToOrgs() {
  return withTransaction(async (client) => {
    // Get users without primary_org_id
    const users = await client.query('SELECT id, username, email, display_name FROM users WHERE primary_org_id IS NULL');
    console.log('Users without org:', users.rows.length);

    for (const user of users.rows) {
      // Create org for user
      const orgName = user.display_name || user.username || `User ${user.id.slice(0,8)}`;
      const orgSlug = (user.username || user.id.slice(0,8)).toLowerCase().replace(/[^a-z0-9]/g, '-');

      const orgResult = await client.query(
        `INSERT INTO organizations (name, slug, billing_email) VALUES ($1, $2, $3) RETURNING id`,
        [orgName, orgSlug, user.email]
      );
      const orgId = orgResult.rows[0].id;
      console.log('Created org', orgName, 'for user', user.id);

      // Add user as admin of org
      await client.query(
        `INSERT INTO org_members (organization_id, user_id, role, can_use_org_account, can_create_escrows, can_manage_members)
         VALUES ($1, $2, 'admin', true, true, true)`,
        [orgId, user.id]
      );

      // Set primary_org_id
      await client.query('UPDATE users SET primary_org_id = $1 WHERE id = $2', [orgId, user.id]);

      // Create org account if not exists
      const accCheck = await client.query('SELECT id FROM accounts WHERE organization_id = $1', [orgId]);
      if (accCheck.rows.length === 0) {
        await client.query('INSERT INTO accounts (organization_id, currency) VALUES ($1, $2)', [orgId, 'USD']);
        console.log('Created account for org', orgId);
      }
    }

    // Update escrows with party_a_org_id from creator
    const escrows = await client.query('SELECT id, party_a_user_id, created_by_user_id FROM escrows WHERE party_a_org_id IS NULL');
    console.log('Escrows without org:', escrows.rows.length);

    for (const escrow of escrows.rows) {
      const userId = escrow.created_by_user_id || escrow.party_a_user_id;
      if (userId) {
        const userOrg = await client.query('SELECT primary_org_id FROM users WHERE id = $1', [userId]);
        if (userOrg.rows[0]?.primary_org_id) {
          await client.query(
            `UPDATE escrows SET party_a_org_id = $1, created_by_user_id = COALESCE(created_by_user_id, $2) WHERE id = $3`,
            [userOrg.rows[0].primary_org_id, userId, escrow.id]
          );
          console.log('Updated escrow', escrow.id, 'with org', userOrg.rows[0].primary_org_id);
        }
      }
    }

    console.log('Migration complete!');
  });
}

migrateUsersToOrgs()
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
