import { pool, withTransaction } from '../db/connection.js';
import { v4 as uuidv4 } from 'uuid';
import type {
  Account,
  AccountWithTotals,
  LedgerEntry,
  LedgerEntryType,
  LedgerBucket,
} from '../types/index.js';

export class AccountService {
  // Get account by user ID
  async getAccountByUserId(userId: string): Promise<AccountWithTotals | null> {
    const result = await pool.query(
      `SELECT * FROM accounts WHERE user_id = $1 AND currency = 'USD'`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const account = this.mapRowToAccount(result.rows[0]);
    return {
      ...account,
      totalBalance: account.availableBalance + account.inContractBalance,
      ownerType: 'user',
    };
  }

  // Get account by organization ID
  async getAccountByOrgId(orgId: string): Promise<AccountWithTotals | null> {
    const result = await pool.query(
      `SELECT * FROM accounts WHERE organization_id = $1 AND currency = 'USD'`,
      [orgId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const account = this.mapRowToAccount(result.rows[0]);
    return {
      ...account,
      totalBalance: account.availableBalance + account.inContractBalance,
      ownerType: 'organization',
    };
  }

  // Create account for user
  async createUserAccount(userId: string, currency: string = 'USD'): Promise<Account> {
    const result = await pool.query(
      `INSERT INTO accounts (user_id, currency)
       VALUES ($1, $2)
       RETURNING *`,
      [userId, currency]
    );

    return this.mapRowToAccount(result.rows[0]);
  }

  // Create account for organization
  // Accepts optional transaction client for use within transactions
  async createOrgAccount(orgId: string, currency: string = 'USD', client?: any): Promise<Account> {
    const queryRunner = client || pool;
    const result = await queryRunner.query(
      `INSERT INTO accounts (organization_id, currency)
       VALUES ($1, $2)
       RETURNING *`,
      [orgId, currency]
    );

    return this.mapRowToAccount(result.rows[0]);
  }

  // Get or create user account (DEPRECATED - use getAccountForUser instead)
  async getOrCreateUserAccount(userId: string): Promise<AccountWithTotals> {
    let account = await this.getAccountByUserId(userId);
    if (!account) {
      const created = await this.createUserAccount(userId);
      account = {
        ...created,
        totalBalance: 0,
        ownerType: 'user',
      };
    }
    return account;
  }

  // Get account for user via their organization (new org-based model)
  // Users don't have personal accounts - they use their org's account
  async getAccountForUser(userId: string): Promise<AccountWithTotals | null> {
    // Get user's primary org
    const userResult = await pool.query(
      `SELECT primary_org_id FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return null;
    }

    const primaryOrgId = userResult.rows[0].primary_org_id;
    if (!primaryOrgId) {
      // Fallback to legacy user account if no org
      return this.getAccountByUserId(userId);
    }

    // Get org account
    return this.getAccountByOrgId(primaryOrgId);
  }

  // Get or create account for user's org
  async getOrCreateAccountForUser(userId: string): Promise<AccountWithTotals> {
    // Get user's primary org
    const userResult = await pool.query(
      `SELECT primary_org_id FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const primaryOrgId = userResult.rows[0].primary_org_id;

    if (!primaryOrgId) {
      // Fallback to legacy user account if no org
      return this.getOrCreateUserAccount(userId);
    }

    // Get or create org account
    let account = await this.getAccountByOrgId(primaryOrgId);
    if (!account) {
      const created = await this.createOrgAccount(primaryOrgId);
      account = {
        ...created,
        totalBalance: 0,
        ownerType: 'organization',
      };
    }
    return account;
  }

  // Deposit to account (adds to available balance)
  async deposit(
    accountId: string,
    amount: number,
    referenceType: string,
    referenceId: string,
    description?: string
  ): Promise<LedgerEntry> {
    return withTransaction(async (client) => {
      // Create ledger entry
      const entryResult = await client.query(
        `INSERT INTO ledger_entries (account_id, amount, bucket, entry_type, reference_type, reference_id, description)
         VALUES ($1, $2, 'available', 'DEPOSIT', $3, $4, $5)
         RETURNING *`,
        [accountId, amount, referenceType, referenceId, description]
      );

      // Update account balance
      await client.query(
        `UPDATE accounts SET available_balance = available_balance + $1, updated_at = NOW()
         WHERE id = $2`,
        [amount, accountId]
      );

      return this.mapRowToLedgerEntry(entryResult.rows[0]);
    });
  }

  // Lock funds for escrow (move from available to in_contract)
  async lockForEscrow(
    accountId: string,
    amount: number,
    escrowId: string,
    description?: string
  ): Promise<void> {
    return withTransaction(async (client) => {
      // Check available balance
      const accountResult = await client.query(
        `SELECT available_balance FROM accounts WHERE id = $1 FOR UPDATE`,
        [accountId]
      );

      if (accountResult.rows.length === 0) {
        throw new Error('Account not found');
      }

      const availableBalance = parseFloat(accountResult.rows[0].available_balance);
      if (availableBalance < amount) {
        throw new Error('Insufficient available balance');
      }

      // Create ledger entry for deducting from available
      await client.query(
        `INSERT INTO ledger_entries (account_id, amount, bucket, entry_type, reference_type, reference_id, description)
         VALUES ($1, $2, 'available', 'ESCROW_LOCK', 'escrow', $3, $4)`,
        [accountId, -amount, escrowId, description || 'Locked for escrow']
      );

      // Create ledger entry for adding to in_contract
      await client.query(
        `INSERT INTO ledger_entries (account_id, amount, bucket, entry_type, reference_type, reference_id, description)
         VALUES ($1, $2, 'in_contract', 'ESCROW_LOCK', 'escrow', $3, $4)`,
        [accountId, amount, escrowId, description || 'Locked for escrow']
      );

      // Update account balances
      await client.query(
        `UPDATE accounts
         SET available_balance = available_balance - $1,
             in_contract_balance = in_contract_balance + $1,
             updated_at = NOW()
         WHERE id = $2`,
        [amount, accountId]
      );
    });
  }

  // Release escrow funds to provider
  async releaseEscrow(
    fromAccountId: string,
    toAccountId: string,
    amount: number,
    platformFee: number,
    escrowId: string
  ): Promise<void> {
    return withTransaction(async (client) => {
      const netAmount = amount - platformFee;

      // Deduct from in_contract balance of party A
      await client.query(
        `INSERT INTO ledger_entries (account_id, amount, bucket, entry_type, reference_type, reference_id, description)
         VALUES ($1, $2, 'in_contract', 'ESCROW_RELEASE', 'escrow', $3, 'Released to provider')`,
        [fromAccountId, -amount, escrowId]
      );

      await client.query(
        `UPDATE accounts
         SET in_contract_balance = in_contract_balance - $1, updated_at = NOW()
         WHERE id = $2`,
        [amount, fromAccountId]
      );

      // Add to available balance of party B (provider)
      await client.query(
        `INSERT INTO ledger_entries (account_id, amount, bucket, entry_type, reference_type, reference_id, description)
         VALUES ($1, $2, 'available', 'ESCROW_RECEIVE', 'escrow', $3, 'Received from escrow')`,
        [toAccountId, netAmount, escrowId]
      );

      await client.query(
        `UPDATE accounts
         SET available_balance = available_balance + $1, updated_at = NOW()
         WHERE id = $2`,
        [netAmount, toAccountId]
      );

      // Record platform fee (could go to a platform account)
      if (platformFee > 0) {
        await client.query(
          `INSERT INTO ledger_entries (account_id, amount, bucket, entry_type, reference_type, reference_id, description)
           VALUES ($1, $2, 'available', 'PLATFORM_FEE', 'escrow', $3, 'Platform fee')`,
          [fromAccountId, -platformFee, escrowId]
        );
      }
    });
  }

  // Refund escrow (return from in_contract to available)
  async refundEscrow(
    accountId: string,
    amount: number,
    escrowId: string
  ): Promise<void> {
    return withTransaction(async (client) => {
      // Create ledger entries
      await client.query(
        `INSERT INTO ledger_entries (account_id, amount, bucket, entry_type, reference_type, reference_id, description)
         VALUES ($1, $2, 'in_contract', 'REFUND', 'escrow', $3, 'Escrow canceled - refund')`,
        [accountId, -amount, escrowId]
      );

      await client.query(
        `INSERT INTO ledger_entries (account_id, amount, bucket, entry_type, reference_type, reference_id, description)
         VALUES ($1, $2, 'available', 'REFUND', 'escrow', $3, 'Escrow canceled - refund')`,
        [accountId, amount, escrowId]
      );

      // Update account balances
      await client.query(
        `UPDATE accounts
         SET available_balance = available_balance + $1,
             in_contract_balance = in_contract_balance - $1,
             updated_at = NOW()
         WHERE id = $2`,
        [amount, accountId]
      );
    });
  }

  // Get ledger entries for account
  async getLedgerEntries(
    accountId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<LedgerEntry[]> {
    const result = await pool.query(
      `SELECT * FROM ledger_entries
       WHERE account_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [accountId, limit, offset]
    );

    return result.rows.map(this.mapRowToLedgerEntry);
  }

  // Get all accounts for a user (org accounts they have access to + personal accounts)
  async getAllAccountsForUser(userId: string): Promise<Array<AccountWithTotals & { accountType: 'organization' | 'personal'; organizationName?: string }>> {
    // Get all organizations the user belongs to
    const orgQuery = await pool.query(
      `SELECT
         a.id, a.user_id, a.organization_id, a.available_balance, a.in_contract_balance,
         a.currency, a.account_type, a.created_at, a.updated_at,
         o.name as organization_name
       FROM accounts a
       JOIN organizations o ON a.organization_id = o.id
       WHERE a.user_id IS NULL
         AND a.organization_id IN (
           SELECT organization_id FROM org_members WHERE user_id = $1
         )
       ORDER BY o.name`,
      [userId]
    );

    // Get all personal accounts for the user
    const personalQuery = await pool.query(
      `SELECT
         a.id, a.user_id, a.organization_id, a.available_balance, a.in_contract_balance,
         a.currency, a.account_type, a.created_at, a.updated_at,
         o.name as organization_name
       FROM accounts a
       JOIN organizations o ON a.organization_id = o.id
       WHERE a.user_id = $1
       ORDER BY o.name`,
      [userId]
    );

    const accounts: Array<AccountWithTotals & { accountType: 'organization' | 'personal'; organizationName?: string }> = [];

    // Add org accounts
    for (const row of orgQuery.rows) {
      const account = this.mapRowToAccount(row);
      accounts.push({
        ...account,
        totalBalance: account.availableBalance + account.inContractBalance,
        ownerType: 'organization',
        accountType: 'organization',
        organizationName: row.organization_name,
      });
    }

    // Add personal accounts
    for (const row of personalQuery.rows) {
      const account = this.mapRowToAccount(row);
      accounts.push({
        ...account,
        totalBalance: account.availableBalance + account.inContractBalance,
        ownerType: 'user',
        accountType: 'personal',
        organizationName: row.organization_name,
      });
    }

    return accounts;
  }

  // Get or create personal account for user within an org
  async getOrCreatePersonalAccount(userId: string, orgId: string): Promise<AccountWithTotals> {
    // Check if personal account exists
    const existing = await pool.query(
      `SELECT * FROM accounts WHERE user_id = $1 AND organization_id = $2 AND currency = 'USD'`,
      [userId, orgId]
    );

    if (existing.rows.length > 0) {
      const account = this.mapRowToAccount(existing.rows[0]);
      return {
        ...account,
        totalBalance: account.availableBalance + account.inContractBalance,
        ownerType: 'user',
      };
    }

    // Create personal account
    const result = await pool.query(
      `INSERT INTO accounts (user_id, organization_id, currency, account_type)
       VALUES ($1, $2, 'USD', 'personal')
       RETURNING *`,
      [userId, orgId]
    );

    const account = this.mapRowToAccount(result.rows[0]);
    return {
      ...account,
      totalBalance: 0,
      ownerType: 'user',
    };
  }

  // Helper: Map DB row to Account
  private mapRowToAccount(row: any): Account {
    return {
      id: row.id,
      userId: row.user_id,
      organizationId: row.organization_id,
      availableBalance: parseFloat(row.available_balance),
      inContractBalance: parseFloat(row.in_contract_balance),
      currency: row.currency,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // Helper: Map DB row to LedgerEntry
  private mapRowToLedgerEntry(row: any): LedgerEntry {
    return {
      id: row.id,
      accountId: row.account_id,
      amount: parseFloat(row.amount),
      bucket: row.bucket as LedgerBucket,
      entryType: row.entry_type as LedgerEntryType,
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      description: row.description,
      createdAt: row.created_at,
    };
  }
}

export const accountService = new AccountService();
