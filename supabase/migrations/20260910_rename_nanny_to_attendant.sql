-- =====================================================================
-- School Bus Check-in WebApp - Rename "nanny" terminology
-- Migration: 20260910_rename_nanny_to_attendant.sql
--
-- 目的：
--   統一將資料庫中的 nanny 字眼改名為 attendant，對齊應用程式程式碼。
--   1. users.role CHECK constraint: 'nanny' → 'attendant'
--   2. trips.nanny_id → trips.attendant_id
--   3. statistics_reports.filters.nanny_id → filters.attendant_id
--   4. UPDATE seed data (角色名稱 'Nanny' → 'Attendant')
--
-- 注意：
--   本檔案使用 IF EXISTS / IF NOT EXISTS，可重複執行 (idempotent)。
--   建議在 Supabase SQL Editor 直接貼上執行。
-- =====================================================================

-- =====================================================================
-- 1. USERS.ROLE: 更新 CHECK constraint
-- =====================================================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'attendant'));

-- 把現存資料中所有 'nanny' 角色升級為 'attendant'
UPDATE users SET role = 'attendant' WHERE role = 'nanny';

-- =====================================================================
-- 2. TRIPS.NANNY_ID → TRIPS.ATTENDANT_ID
-- =====================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'nanny_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'attendant_id'
  ) THEN
    ALTER TABLE trips RENAME COLUMN nanny_id TO attendant_id;
  END IF;
END
$$;

-- 更新可能的外鍵引用 (e.g. statistics、view)
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT conname, conrelid::regclass AS tbl
    FROM pg_constraint
    WHERE contype = 'f'
      AND pg_get_constraintdef(oid) LIKE '%nanny_id%'
  LOOP
    EXECUTE format('ALTER TABLE %s RENAME CONSTRAINT %I TO %I',
      rec.tbl, rec.conname, replace(rec.conname, 'nanny_id', 'attendant_id'));
  END LOOP;
END
$$;

-- 更新索引名稱 (若有)
ALTER INDEX IF EXISTS idx_trips_nanny_id RENAME TO idx_trips_attendant_id;

-- =====================================================================
-- 3. STATISTICS_REPORTS.FILTERS.JSON: nanny_id → attendant_id
--    由於是 JSONB 欄位，使用 jsonb 函數批次替換 key
-- =====================================================================
UPDATE statistics_reports
SET filters = regexp_replace(filters::text, '"nanny_id"', '"attendant_id"', 'g')::jsonb
WHERE filters::text LIKE '%"nanny_id"%';

-- =====================================================================
-- 4. SEED DATA 名稱更新（可選）
-- =====================================================================
UPDATE users
SET name = REPLACE(name, 'Nanny', 'Attendant')
WHERE name LIKE '%Nanny%';

UPDATE users
SET name = REPLACE(name, '(Nanny)', '(Attendant)')
WHERE name LIKE '%(Nanny)%';

UPDATE users
SET name = REPLACE(name, '保姆', '打卡員')
WHERE name LIKE '%保姆%';

-- =====================================================================
-- 5. (可選) 重新建立 RLS Policy 確保不影響權限
-- =====================================================================
-- users / trips / statistics_reports 的 RLS 已於既有 migration 建立，
-- 本 migration 不變更策略內容。
