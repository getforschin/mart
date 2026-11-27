import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { PosFacility, PosSession, UserRole } from '../../shared/types';

const DEMO_FACILITY_ID = '00000000-0000-0000-0000-000000000002';
const DEMO_CASHIER_ID = '00000000-0000-0000-0000-000000000003';
/** Must match central seed managerId — never reuse warehouse id ...0004. */
const DEMO_MANAGER_ID = '00000000-0000-0000-0000-000000000006';
const LEGACY_MANAGER_ID = '00000000-0000-0000-0000-000000000004';

export class AuthService {
  constructor(private readonly db: Database.Database) {}

  getFacilities(): PosFacility[] {
    const rows = this.db
      .prepare('SELECT id, name, type FROM pos_facilities WHERE is_active = 1 ORDER BY name')
      .all() as Array<{ id: string; name: string; type: string }>;

    return rows.map((row) => ({ id: row.id, name: row.name, type: row.type }));
  }

  login(username: string, password: string, facilityId: string): PosSession {
    const userRow = this.db
      .prepare(
        `SELECT id, username, password_hash, display_name, role, facility_id, is_active
         FROM pos_users WHERE username = @username COLLATE NOCASE`,
      )
      .get({ username: username.trim() }) as
      | {
          id: string;
          username: string;
          password_hash: string;
          display_name: string;
          role: string;
          facility_id: string;
          is_active: number;
        }
      | undefined;

    if (!userRow || userRow.is_active !== 1) {
      throw new Error('Invalid username or password');
    }

    const passwordValid = bcrypt.compareSync(password, userRow.password_hash);
    if (!passwordValid) {
      throw new Error('Invalid username or password');
    }

    const facility = this.db
      .prepare('SELECT id, name, type FROM pos_facilities WHERE id = @id AND is_active = 1')
      .get({ id: facilityId }) as { id: string; name: string; type: string } | undefined;

    if (!facility) {
      throw new Error('Selected center/facility is not available');
    }

    const session: PosSession = {
      user: {
        id: userRow.id,
        username: userRow.username,
        displayName: userRow.display_name,
        role: userRow.role as UserRole,
        facilityId: facility.id,
        facilityName: facility.name,
      },
      facility: { id: facility.id, name: facility.name, type: facility.type },
      loggedInAt: new Date().toISOString(),
    };

    this.db.prepare('DELETE FROM pos_sessions').run();
    this.db
      .prepare(
        `INSERT INTO pos_sessions (id, user_id, facility_id, logged_in_at)
         VALUES ('active', @user_id, @facility_id, @logged_in_at)`,
      )
      .run({
        user_id: userRow.id,
        facility_id: facility.id,
        logged_in_at: session.loggedInAt,
      });

    const updateConfig = this.db.transaction(() => {
      this.db.prepare(`UPDATE pos_config SET value = @value WHERE key = 'cashierId'`).run({
        value: userRow.id,
      });
      this.db.prepare(`UPDATE pos_config SET value = @value WHERE key = 'facilityId'`).run({
        value: facility.id,
      });
      this.db.prepare(`UPDATE pos_config SET value = @value WHERE key = 'facilityName'`).run({
        value: facility.name,
      });
    });
    updateConfig();

    return session;
  }

  getSession(): PosSession | null {
    const sessionRow = this.db
      .prepare(
        `SELECT s.user_id, s.facility_id, s.logged_in_at,
                u.username, u.display_name, u.role,
                f.name AS facility_name, f.type AS facility_type
         FROM pos_sessions s
         INNER JOIN pos_users u ON u.id = s.user_id
         INNER JOIN pos_facilities f ON f.id = s.facility_id
         WHERE s.id = 'active'`,
      )
      .get() as
      | {
          user_id: string;
          facility_id: string;
          logged_in_at: string;
          username: string;
          display_name: string;
          role: string;
          facility_name: string;
          facility_type: string;
        }
      | undefined;

    if (!sessionRow) {
      return null;
    }

    return {
      user: {
        id: sessionRow.user_id,
        username: sessionRow.username,
        displayName: sessionRow.display_name,
        role: sessionRow.role as UserRole,
        facilityId: sessionRow.facility_id,
        facilityName: sessionRow.facility_name,
      },
      facility: {
        id: sessionRow.facility_id,
        name: sessionRow.facility_name,
        type: sessionRow.facility_type,
      },
      loggedInAt: sessionRow.logged_in_at,
    };
  }

  logout(): void {
    this.db.prepare('DELETE FROM pos_sessions').run();
  }
}

export function seedAuthData(db: Database.Database): void {
  const facilityCount = db.prepare('SELECT COUNT(*) AS count FROM pos_facilities').get() as {
    count: number;
  };

  if (facilityCount.count === 0) {
    db.prepare(
      `INSERT INTO pos_facilities (id, name, type, is_active) VALUES
       (@id, @name, 'RETAIL_STORE', 1)`,
    ).run({
      id: DEMO_FACILITY_ID,
      name: process.env.POS_FACILITY_NAME ?? 'Demo Retail Store — Main',
    });
  }

  const userCount = db.prepare('SELECT COUNT(*) AS count FROM pos_users').get() as { count: number };

  if (userCount.count === 0) {
    const passwordHash = bcrypt.hashSync('admin123', 10);
    const managerHash = bcrypt.hashSync('manager123', 10);

    const insertUser = db.prepare(
      `INSERT INTO pos_users (id, username, password_hash, display_name, role, facility_id, is_active)
       VALUES (@id, @username, @password_hash, @display_name, @role, @facility_id, 1)`,
    );

    insertUser.run({
      id: DEMO_CASHIER_ID,
      username: 'cashier',
      password_hash: passwordHash,
      display_name: 'Demo Cashier',
      role: 'CASHIER',
      facility_id: DEMO_FACILITY_ID,
    });

    insertUser.run({
      id: DEMO_MANAGER_ID,
      username: 'manager',
      password_hash: managerHash,
      display_name: 'Store Manager',
      role: 'STORE_MANAGER',
      facility_id: DEMO_FACILITY_ID,
    });
  } else {
    // Older builds seeded manager as ...0004 (central warehouse id). Remap in place.
    remapLegacyManagerId(db);
  }
}

export function remapLegacyManagerId(db: Database.Database): void {
  const legacy = db
    .prepare('SELECT id FROM pos_users WHERE id = @id')
    .get({ id: LEGACY_MANAGER_ID }) as { id: string } | undefined;
  if (!legacy) return;

  const already = db
    .prepare('SELECT id FROM pos_users WHERE id = @id')
    .get({ id: DEMO_MANAGER_ID }) as { id: string } | undefined;
  if (already) {
    db.prepare('DELETE FROM pos_users WHERE id = @id').run({ id: LEGACY_MANAGER_ID });
  } else {
    db.prepare('UPDATE pos_users SET id = @next WHERE id = @prev').run({
      next: DEMO_MANAGER_ID,
      prev: LEGACY_MANAGER_ID,
    });
  }

  db.prepare('UPDATE pos_sessions SET user_id = @next WHERE user_id = @prev').run({
    next: DEMO_MANAGER_ID,
    prev: LEGACY_MANAGER_ID,
  });
  db.prepare(
    `UPDATE pos_config SET value = @next WHERE key = 'cashierId' AND value = @prev`,
  ).run({ next: DEMO_MANAGER_ID, prev: LEGACY_MANAGER_ID });
  db.prepare(
    'UPDATE order_invoices_local SET cashier_id = @next WHERE cashier_id = @prev',
  ).run({ next: DEMO_MANAGER_ID, prev: LEGACY_MANAGER_ID });
  db.prepare(
    'UPDATE workforce_attendance_local SET user_id = @next WHERE user_id = @prev',
  ).run({ next: DEMO_MANAGER_ID, prev: LEGACY_MANAGER_ID });
}
