-- Enable UUID generation and spatial extensions for multi-tenant retail schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Composite indexes applied at migration time; baseline grants for application role
GRANT ALL PRIVILEGES ON DATABASE mart_omnichannel TO mart_admin;
