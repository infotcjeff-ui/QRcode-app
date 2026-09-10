-- =====================================================================
-- School Bus Check-in WebApp - Statistics Reports Schema
-- Migration: 20260910_statistics_reports.sql
--
-- 目的：
--   管理員可一鍵「生成進階統計表」，根據 check_logs 即時彙整出
--   進階統計數據，並保存於此表供後續瀏覽、比較與匯出。
--   所有資料來源 (check_logs, students, trips, buses, users)
--   已於 20260819_init_schema.sql 建立，本 migration 僅新增報表儲存表。
-- =====================================================================

-- =====================================================================
-- 1. STATISTICS REPORTS TABLE
-- =====================================================================
CREATE TABLE statistics_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- 報表名稱（管理員可自訂，例如「2026-09 上學月 AM_GO 進階統計」）
  title VARCHAR(200) NOT NULL,
  -- 報表類型
  report_type VARCHAR(50) NOT NULL DEFAULT 'check_log_advanced'
    CHECK (report_type IN ('check_log_advanced', 'check_log_route', 'check_log_daily', 'custom')),
  -- 報表統計區間（包含起訖）
  range_start DATE NOT NULL,
  range_end DATE NOT NULL,
  -- 產生報表的篩選條件（JSON：{ trip_type, bus_id, nanny_id, ... }）
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- 統計結果本體（JSON）：每種 metric 皆放於此欄，方便擴充
  payload JSONB NOT NULL,
  -- 重點摘要，UI 可直接顯示
  summary VARCHAR(500),
  -- 產生報表的管理員 ID
  generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 2. INDEXES
-- =====================================================================
CREATE INDEX idx_statistics_reports_generated_at
  ON statistics_reports(generated_at DESC);
CREATE INDEX idx_statistics_reports_range
  ON statistics_reports(range_start, range_end);
CREATE INDEX idx_statistics_reports_type
  ON statistics_reports(report_type);

-- =====================================================================
-- 3. ROW LEVEL SECURITY
-- =====================================================================
ALTER TABLE statistics_reports ENABLE ROW LEVEL SECURITY;

-- 開發環境寬鬆策略（生產請依實際身份收緊）
CREATE POLICY "Allow read access to all users" ON statistics_reports FOR SELECT USING (true);
CREATE POLICY "Allow insert for service role" ON statistics_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for service role" ON statistics_reports FOR UPDATE USING (true);
CREATE POLICY "Allow delete for service role" ON statistics_reports FOR DELETE USING (true);

-- =====================================================================
-- 4. REALTIME（可選：報表新增 / 更新即時推播）
-- =====================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE statistics_reports;