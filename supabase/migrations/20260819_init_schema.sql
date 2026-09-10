-- =====================================================================
-- School Bus Check-in WebApp - Initial Database Schema
-- Migration: 20260819_init_schema.sql
-- =====================================================================

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================================
-- 1. BUSES TABLE
-- =====================================================================
CREATE TABLE buses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plate_number VARCHAR(50) NOT NULL UNIQUE,
  route_name VARCHAR(100) NOT NULL,
  capacity INTEGER NOT NULL
);

-- =====================================================================
-- 2. USERS TABLE (Admin & Nannies)
-- =====================================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  role VARCHAR(20) CHECK (role IN ('admin', 'nanny')),
  assigned_bus_id UUID REFERENCES buses(id) ON DELETE SET NULL
);

-- =====================================================================
-- 3. STUDENTS TABLE
-- =====================================================================
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  student_no VARCHAR(50) NOT NULL UNIQUE,
  photo_url TEXT,
  parent_name VARCHAR(100) NOT NULL,
  parent_phone VARCHAR(50) NOT NULL,
  assigned_bus_id UUID REFERENCES buses(id) ON DELETE CASCADE
);

-- =====================================================================
-- 4. TRIPS TABLE (Session handling)
-- =====================================================================
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bus_id UUID REFERENCES buses(id) ON DELETE CASCADE,
  nanny_id UUID REFERENCES users(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type VARCHAR(20) CHECK (type IN ('AM_GO', 'PM_BACK')),
  status VARCHAR(20) CHECK (status IN ('active', 'completed')) DEFAULT 'active'
);

-- =====================================================================
-- 5. CHECK LOGS TABLE
-- =====================================================================
CREATE TABLE check_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  type VARCHAR(20) CHECK (type IN ('ON', 'OFF')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  location_name VARCHAR(250),
  whatsapp_status VARCHAR(20) CHECK (whatsapp_status IN ('pending', 'sent', 'failed')) DEFAULT 'pending'
);

-- =====================================================================
-- INDEXES for query performance
-- =====================================================================
CREATE INDEX idx_check_logs_trip_id ON check_logs(trip_id);
CREATE INDEX idx_check_logs_student_id ON check_logs(student_id);
CREATE INDEX idx_check_logs_type ON check_logs(type);
CREATE INDEX idx_students_assigned_bus ON students(assigned_bus_id);
CREATE INDEX idx_users_assigned_bus ON users(assigned_bus_id);
CREATE INDEX idx_trips_status ON trips(status);
CREATE INDEX idx_trips_date ON trips(date);

-- =====================================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================================
ALTER TABLE buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_logs ENABLE ROW LEVEL SECURITY;

-- Permissive policies for development (tighten for production)
CREATE POLICY "Allow read access to all users" ON buses FOR SELECT USING (true);
CREATE POLICY "Allow read access to all users" ON users FOR SELECT USING (true);
CREATE POLICY "Allow read access to all users" ON students FOR SELECT USING (true);
CREATE POLICY "Allow read access to all users" ON trips FOR SELECT USING (true);
CREATE POLICY "Allow read access to all users" ON check_logs FOR SELECT USING (true);

CREATE POLICY "Allow insert for service role" ON check_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for service role" ON check_logs FOR UPDATE USING (true);

-- =====================================================================
-- REALTIME SUBSCRIPTION (for parent tracking UI)
-- =====================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE check_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE trips;

-- =====================================================================
-- SEED DATA FOR INSTANT TESTING
-- =====================================================================

-- Test Bus
INSERT INTO buses (id, plate_number, route_name, capacity)
VALUES ('99999999-9999-9999-9999-999999999999', 'AM1234', '沙田A線', 24);

-- Account 1: Admin
INSERT INTO users (id, name, phone, role, assigned_bus_id)
VALUES ('11111111-1111-1111-1111-111111111111', '陳大文主管(Admin)', '+85290001111', 'admin', NULL);

-- Account 2: Nanny (Bound to Shatin Route)
INSERT INTO users (id, name, phone, role, assigned_bus_id)
VALUES ('22222222-2222-2222-2222-222222222222', '張翠蘭姐(Nanny)', '+85290002222', 'nanny', '99999999-9999-9999-9999-999999999999');

-- Test Student & QR Code Base Data
INSERT INTO students (id, name, student_no, photo_url, parent_name, parent_phone, assigned_bus_id)
VALUES (
  '88888888-8888-8888-8888-888888888888',
  '藍小明',
  'STU2026001',
  'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400',
  '藍先生',
  '+85261234567',
  '99999999-9999-9999-9999-999999999999'
);

-- Active Trip Session
INSERT INTO trips (id, bus_id, nanny_id, date, type, status)
VALUES (
  '77777777-7777-7777-7777-777777777777',
  '99999999-9999-9999-9999-999999999999',
  '22222222-2222-2222-2222-222222222222',
  CURRENT_DATE,
  'AM_GO',
  'active'
);