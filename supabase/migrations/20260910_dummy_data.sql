-- =====================================================================
-- School Bus Check-in WebApp - Dummy Seed Data
-- Migration: 20260910_dummy_data.sql
--
-- 目的：
--   為校巴安全打卡系統塞入完整的測試資料：
--     - 4 條校巴路線 (buses)
--     - 4 位打卡員 (users / attendants)
--     - 20 位學生 (students)
--     - 今日的班次 (trips, AM_GO + PM_BACK)
--     - 部分打卡紀錄 (check_logs)，讓統計表有真實資料可用
--
-- 學生 UUID 設計：
--   每位學生的 UUID 由其 student_no 透過 SHA-1 雜湊得出 (UUIDv5 格式)。
--   如此：
--     - 每位學生有獨一無二的 UUID (QR Code 內容)
--     - UUID 仍是合法 RFC 4122 v5 格式 (8-4-4-4-12 hex)
--     - 由 UUID 可反推回 student_no (需另行比對)
--     - 避免使用 v4 隨機 UUID，方便測試時識別所屬學生
--
-- 注意：
--   本檔案使用 ON CONFLICT，可重複執行 (idempotent)。
--   建議在 Supabase SQL Editor 直接貼上執行。
-- =====================================================================

-- =====================================================================
-- 1. BUSES (校巴)
-- =====================================================================
INSERT INTO buses (id, plate_number, route_name, capacity) VALUES
  ('99999999-9999-9999-9999-999999999999', 'AM1234', '沙田A線', 24),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'PM5678', '九龍東線', 20),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'KL3344', '將軍澳線', 28),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'TW7788', '荃灣西線', 22)
ON CONFLICT (id) DO UPDATE SET
  plate_number = EXCLUDED.plate_number,
  route_name = EXCLUDED.route_name,
  capacity = EXCLUDED.capacity;

-- =====================================================================
-- 2. USERS (管理員 + 打卡員)
-- =====================================================================
-- 既有管理員 (admin)
INSERT INTO users (id, name, phone, role, assigned_bus_id) VALUES
  ('11111111-1111-1111-1111-111111111111', '陳大文主管', '+85290001111', 'admin', NULL)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  role = EXCLUDED.role;

-- 既有測試打卡員 (張翠蘭) - 預設指派到沙田A線
INSERT INTO users (id, name, phone, role, assigned_bus_id) VALUES
  ('22222222-2222-2222-2222-222222222222', '張翠蘭姐', '+85290002222', 'attendant', '99999999-9999-9999-9999-999999999999')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  role = EXCLUDED.role,
  assigned_bus_id = EXCLUDED.assigned_bus_id;

-- 額外 3 位打卡員 (每位負責一條路線)
INSERT INTO users (id, name, phone, role, assigned_bus_id) VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001', '李秀英姐', '+85290003333', 'attendant', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '王美華姐', '+85290004444', 'attendant', 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('bbbbbbbb-0000-0000-0000-000000000003', '陳淑芬姐', '+85290005555', 'attendant', 'aaaaaaaa-0000-0000-0000-000000000003')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  role = EXCLUDED.role,
  assigned_bus_id = EXCLUDED.assigned_bus_id;

-- =====================================================================
-- 3. STUDENTS (學生)
--    UUID 由 student_no 透過 SHA-1 雜湊得出 (UUIDv5 格式)
-- =====================================================================
-- 沙田A線 (AM1234) - 6 位學生
INSERT INTO students (id, name, student_no, photo_url, parent_name, parent_phone, assigned_bus_id) VALUES
  ('72796632-8672-5bf2-bfe7-73e9e562eb31', '藍小明', 'STU2026001', 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400', '藍先生', '+85261234567', '99999999-9999-9999-9999-999999999999'),
  ('d161426a-4bd6-5f11-8f80-ebcf70863ff1', '陳小強', 'STU2026002', 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400', '陳先生', '+85261234568', '99999999-9999-9999-9999-999999999999'),
  ('a741ce97-4633-5053-acc2-a6a5bf8a4250', '黃小美', 'STU2026003', 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400', '黃太太', '+85261234569', '99999999-9999-9999-9999-999999999999'),
  ('64adc074-6206-5b62-b3c5-8b111195d6ee', '李小龍', 'STU2026004', 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400', '李先生', '+85261234570', '99999999-9999-9999-9999-999999999999'),
  ('c2f74691-fdae-578c-973d-dfb86d2fbb26', '王小玲', 'STU2026005', 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400', '王太太', '+85261234571', '99999999-9999-9999-9999-999999999999'),
  ('aedd575d-aa5a-5254-81c5-5a5ea2e42839', '張志明', 'STU2026006', 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400', '張先生', '+85261234572', '99999999-9999-9999-9999-999999999999')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  student_no = EXCLUDED.student_no,
  parent_name = EXCLUDED.parent_name,
  parent_phone = EXCLUDED.parent_phone,
  assigned_bus_id = EXCLUDED.assigned_bus_id;

-- 九龍東線 (PM5678) - 5 位學生
INSERT INTO students (id, name, student_no, photo_url, parent_name, parent_phone, assigned_bus_id) VALUES
  ('8e341752-391e-504c-9b6f-ce041de5ba60', '林曉芳', 'STU2026007', 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400', '林太太', '+85261234573', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d10ea2ae-4b13-5418-a824-c0275fdffaa2', '趙嘉樂', 'STU2026008', 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400', '趙先生', '+85261234574', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('6fbac16b-ca86-5dcf-ae40-abf15b973d11', '孫文迪', 'STU2026009', 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400', '孫先生', '+85261234575', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('311d99e4-61fa-5363-a96f-683c017495c5', '周慧珊', 'STU2026010', 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400', '周太太', '+85261234576', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('b9dfbc38-d7ff-5ded-981a-8a46f054a9e2', '吳梓豪', 'STU2026011', 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400', '吳先生', '+85261234577', 'aaaaaaaa-0000-0000-0000-000000000001')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  student_no = EXCLUDED.student_no,
  parent_name = EXCLUDED.parent_name,
  parent_phone = EXCLUDED.parent_phone,
  assigned_bus_id = EXCLUDED.assigned_bus_id;

-- 將軍澳線 (KL3344) - 5 位學生
INSERT INTO students (id, name, student_no, photo_url, parent_name, parent_phone, assigned_bus_id) VALUES
  ('b3c89f67-29e1-5b2e-95d5-c01d7f71177e', '鄭美玲', 'STU2026012', 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400', '鄭太太', '+85261234578', 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('99fe5496-aab3-5bdb-bb5b-052998d3400a', '馮浩然', 'STU2026013', 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400', '馮先生', '+85261234579', 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('2f6014e7-a703-5cda-aa89-f76cdad939b6', '鄧嘉文', 'STU2026014', 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400', '鄧太太', '+85261234580', 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('91d996e5-41a5-5dee-a861-df71b7c7ef2a', '馬子聰', 'STU2026015', 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400', '馬先生', '+85261234581', 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('cd3fbc1c-8f7c-5528-ba66-c93ada5434d5', '蕭曉怡', 'STU2026016', 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400', '蕭太太', '+85261234582', 'aaaaaaaa-0000-0000-0000-000000000002')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  student_no = EXCLUDED.student_no,
  parent_name = EXCLUDED.parent_name,
  parent_phone = EXCLUDED.parent_phone,
  assigned_bus_id = EXCLUDED.assigned_bus_id;

-- 荃灣西線 (TW7788) - 4 位學生
INSERT INTO students (id, name, student_no, photo_url, parent_name, parent_phone, assigned_bus_id) VALUES
  ('c9ccb982-f7dd-5964-aba7-af1c4f6456a1', '謝嘉寶', 'STU2026017', 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400', '謝太太', '+85261234583', 'aaaaaaaa-0000-0000-0000-000000000003'),
  ('9f59ae97-2481-57af-b80a-10e20789a292', '韓志偉', 'STU2026018', 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400', '韓先生', '+85261234584', 'aaaaaaaa-0000-0000-0000-000000000003'),
  ('e1cdef71-8f31-5771-92c2-535eaf016c6e', '梁詠詩', 'STU2026019', 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400', '梁太太', '+85261234585', 'aaaaaaaa-0000-0000-0000-000000000003'),
  ('de0f01ef-635c-5361-8d13-f885fd594042', '何俊熙', 'STU2026020', 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400', '何先生', '+85261234586', 'aaaaaaaa-0000-0000-0000-000000000003')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  student_no = EXCLUDED.student_no,
  parent_name = EXCLUDED.parent_name,
  parent_phone = EXCLUDED.parent_phone,
  assigned_bus_id = EXCLUDED.assigned_bus_id;

-- =====================================================================
-- 4. TRIPS (今日班次 + 昨日/前日歷史班次)
--    每條校巴各建立 3 個班次：今日 AM_GO、今日 PM_BACK、昨日 AM_GO (completed)
-- =====================================================================

-- 沙田A線 (AM1234) - 既有測試班次保留
INSERT INTO trips (id, bus_id, attendant_id, date, type, status) VALUES
  ('77777777-7777-7777-7777-777777777777', '99999999-9999-9999-9999-999999999999', '22222222-2222-2222-2222-222222222222', CURRENT_DATE, 'AM_GO', 'active')
ON CONFLICT (id) DO UPDATE SET
  bus_id = EXCLUDED.bus_id,
  attendant_id = EXCLUDED.attendant_id,
  date = EXCLUDED.date,
  type = EXCLUDED.type,
  status = EXCLUDED.status;

INSERT INTO trips (id, bus_id, attendant_id, date, type, status) VALUES
  ('cccccccc-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999', '22222222-2222-2222-2222-222222222222', CURRENT_DATE, 'PM_BACK', 'active'),
  ('cccccccc-0000-0000-0000-000000000002', '99999999-9999-9999-9999-999999999999', '22222222-2222-2222-2222-222222222222', CURRENT_DATE - INTERVAL '1 day', 'AM_GO', 'completed'),
  ('cccccccc-0000-0000-0000-000000000003', '99999999-9999-9999-9999-999999999999', '22222222-2222-2222-2222-222222222222', CURRENT_DATE - INTERVAL '2 day', 'PM_BACK', 'completed')
ON CONFLICT (id) DO NOTHING;

-- 九龍東線 (PM5678)
INSERT INTO trips (id, bus_id, attendant_id, date, type, status) VALUES
  ('cccccccc-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', CURRENT_DATE, 'AM_GO', 'active'),
  ('cccccccc-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', CURRENT_DATE, 'PM_BACK', 'active'),
  ('cccccccc-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', CURRENT_DATE - INTERVAL '1 day', 'AM_GO', 'completed')
ON CONFLICT (id) DO NOTHING;

-- 將軍澳線 (KL3344)
INSERT INTO trips (id, bus_id, attendant_id, date, type, status) VALUES
  ('cccccccc-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', CURRENT_DATE, 'AM_GO', 'active'),
  ('cccccccc-0000-0000-0000-000000000008', 'aaaaaaaa-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', CURRENT_DATE, 'PM_BACK', 'active'),
  ('cccccccc-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', CURRENT_DATE - INTERVAL '1 day', 'AM_GO', 'completed')
ON CONFLICT (id) DO NOTHING;

-- 荃灣西線 (TW7788)
INSERT INTO trips (id, bus_id, attendant_id, date, type, status) VALUES
  ('cccccccc-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000003', CURRENT_DATE, 'AM_GO', 'active'),
  ('cccccccc-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000003', CURRENT_DATE, 'PM_BACK', 'active'),
  ('cccccccc-0000-0000-0000-00000000000c', 'aaaaaaaa-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000003', CURRENT_DATE - INTERVAL '1 day', 'AM_GO', 'completed')
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 5. CHECK LOGS (打卡紀錄) - 為昨日已完成的班次塞入模擬資料
--    讓統計表有真實數據可用
-- =====================================================================

-- 沙田A線昨日 AM_GO (completed)
INSERT INTO check_logs (trip_id, student_id, type, timestamp, location_name, whatsapp_status) VALUES
  ('cccccccc-0000-0000-0000-000000000002', '72796632-8672-5bf2-bfe7-73e9e562eb31', 'ON',  (CURRENT_DATE - INTERVAL '1 day' + TIME '07:15:00') AT TIME ZONE 'Asia/Hong_Kong', '沙田A線 · 首站', 'sent'),
  ('cccccccc-0000-0000-0000-000000000002', 'd161426a-4bd6-5f11-8f80-ebcf70863ff1', 'ON',  (CURRENT_DATE - INTERVAL '1 day' + TIME '07:18:00') AT TIME ZONE 'Asia/Hong_Kong', '沙田A線 · 首站', 'sent'),
  ('cccccccc-0000-0000-0000-000000000002', 'a741ce97-4633-5053-acc2-a6a5bf8a4250', 'ON',  (CURRENT_DATE - INTERVAL '1 day' + TIME '07:20:00') AT TIME ZONE 'Asia/Hong_Kong', '沙田A線 · 首站', 'sent'),
  ('cccccccc-0000-0000-0000-000000000002', '64adc074-6206-5b62-b3c5-8b111195d6ee', 'ON',  (CURRENT_DATE - INTERVAL '1 day' + TIME '07:22:00') AT TIME ZONE 'Asia/Hong_Kong', '沙田A線 · 首站', 'sent'),
  ('cccccccc-0000-0000-0000-000000000002', 'c2f74691-fdae-578c-973d-dfb86d2fbb26', 'ON',  (CURRENT_DATE - INTERVAL '1 day' + TIME '07:25:00') AT TIME ZONE 'Asia/Hong_Kong', '沙田A線 · 首站', 'sent'),
  ('cccccccc-0000-0000-0000-000000000002', '72796632-8672-5bf2-bfe7-73e9e562eb31', 'OFF', (CURRENT_DATE - INTERVAL '1 day' + TIME '07:55:00') AT TIME ZONE 'Asia/Hong_Kong', '學校', 'sent'),
  ('cccccccc-0000-0000-0000-000000000002', 'd161426a-4bd6-5f11-8f80-ebcf70863ff1', 'OFF', (CURRENT_DATE - INTERVAL '1 day' + TIME '07:58:00') AT TIME ZONE 'Asia/Hong_Kong', '學校', 'sent'),
  ('cccccccc-0000-0000-0000-000000000002', 'a741ce97-4633-5053-acc2-a6a5bf8a4250', 'OFF', (CURRENT_DATE - INTERVAL '1 day' + TIME '07:59:00') AT TIME ZONE 'Asia/Hong_Kong', '學校', 'sent')
ON CONFLICT DO NOTHING;

-- 九龍東線昨日 AM_GO (completed)
INSERT INTO check_logs (trip_id, student_id, type, timestamp, location_name, whatsapp_status) VALUES
  ('cccccccc-0000-0000-0000-000000000006', '8e341752-391e-504c-9b6f-ce041de5ba60', 'ON',  (CURRENT_DATE - INTERVAL '1 day' + TIME '07:30:00') AT TIME ZONE 'Asia/Hong_Kong', '九龍東線 · 首站', 'sent'),
  ('cccccccc-0000-0000-0000-000000000006', 'd10ea2ae-4b13-5418-a824-c0275fdffaa2', 'ON',  (CURRENT_DATE - INTERVAL '1 day' + TIME '07:32:00') AT TIME ZONE 'Asia/Hong_Kong', '九龍東線 · 首站', 'sent'),
  ('cccccccc-0000-0000-0000-000000000006', '6fbac16b-ca86-5dcf-ae40-abf15b973d11', 'ON',  (CURRENT_DATE - INTERVAL '1 day' + TIME '07:35:00') AT TIME ZONE 'Asia/Hong_Kong', '九龍東線 · 首站', 'sent'),
  ('cccccccc-0000-0000-0000-000000000006', '311d99e4-61fa-5363-a96f-683c017495c5', 'ON',  (CURRENT_DATE - INTERVAL '1 day' + TIME '07:38:00') AT TIME ZONE 'Asia/Hong_Kong', '九龍東線 · 首站', 'sent'),
  ('cccccccc-0000-0000-0000-000000000006', '8e341752-391e-504c-9b6f-ce041de5ba60', 'OFF', (CURRENT_DATE - INTERVAL '1 day' + TIME '08:00:00') AT TIME ZONE 'Asia/Hong_Kong', '學校', 'sent'),
  ('cccccccc-0000-0000-0000-000000000006', 'd10ea2ae-4b13-5418-a824-c0275fdffaa2', 'OFF', (CURRENT_DATE - INTERVAL '1 day' + TIME '08:02:00') AT TIME ZONE 'Asia/Hong_Kong', '學校', 'sent'),
  ('cccccccc-0000-0000-0000-000000000006', '311d99e4-61fa-5363-a96f-683c017495c5', 'OFF', (CURRENT_DATE - INTERVAL '1 day' + TIME '08:05:00') AT TIME ZONE 'Asia/Hong_Kong', '學校', 'sent')
ON CONFLICT DO NOTHING;

-- 將軍澳線昨日 AM_GO (completed)
INSERT INTO check_logs (trip_id, student_id, type, timestamp, location_name, whatsapp_status) VALUES
  ('cccccccc-0000-0000-0000-000000000009', 'b3c89f67-29e1-5b2e-95d5-c01d7f71177e', 'ON',  (CURRENT_DATE - INTERVAL '1 day' + TIME '07:10:00') AT TIME ZONE 'Asia/Hong_Kong', '將軍澳線 · 首站', 'sent'),
  ('cccccccc-0000-0000-0000-000000000009', '99fe5496-aab3-5bdb-bb5b-052998d3400a', 'ON',  (CURRENT_DATE - INTERVAL '1 day' + TIME '07:13:00') AT TIME ZONE 'Asia/Hong_Kong', '將軍澳線 · 首站', 'sent'),
  ('cccccccc-0000-0000-0000-000000000009', '2f6014e7-a703-5cda-aa89-f76cdad939b6', 'ON',  (CURRENT_DATE - INTERVAL '1 day' + TIME '07:16:00') AT TIME ZONE 'Asia/Hong_Kong', '將軍澳線 · 首站', 'sent'),
  ('cccccccc-0000-0000-0000-000000000009', 'b3c89f67-29e1-5b2e-95d5-c01d7f71177e', 'OFF', (CURRENT_DATE - INTERVAL '1 day' + TIME '07:50:00') AT TIME ZONE 'Asia/Hong_Kong', '學校', 'sent'),
  ('cccccccc-0000-0000-0000-000000000009', '99fe5496-aab3-5bdb-bb5b-052998d3400a', 'OFF', (CURRENT_DATE - INTERVAL '1 day' + TIME '07:53:00') AT TIME ZONE 'Asia/Hong_Kong', '學校', 'sent')
ON CONFLICT DO NOTHING;

-- 荃灣西線昨日 AM_GO (completed)
INSERT INTO check_logs (trip_id, student_id, type, timestamp, location_name, whatsapp_status) VALUES
  ('cccccccc-0000-0000-0000-00000000000c', 'c9ccb982-f7dd-5964-aba7-af1c4f6456a1', 'ON',  (CURRENT_DATE - INTERVAL '1 day' + TIME '07:25:00') AT TIME ZONE 'Asia/Hong_Kong', '荃灣西線 · 首站', 'sent'),
  ('cccccccc-0000-0000-0000-00000000000c', '9f59ae97-2481-57af-b80a-10e20789a292', 'ON',  (CURRENT_DATE - INTERVAL '1 day' + TIME '07:28:00') AT TIME ZONE 'Asia/Hong_Kong', '荃灣西線 · 首站', 'sent'),
  ('cccccccc-0000-0000-0000-00000000000c', 'e1cdef71-8f31-5771-92c2-535eaf016c6e', 'ON',  (CURRENT_DATE - INTERVAL '1 day' + TIME '07:30:00') AT TIME ZONE 'Asia/Hong_Kong', '荃灣西線 · 首站', 'sent'),
  ('cccccccc-0000-0000-0000-00000000000c', 'c9ccb982-f7dd-5964-aba7-af1c4f6456a1', 'OFF', (CURRENT_DATE - INTERVAL '1 day' + TIME '08:00:00') AT TIME ZONE 'Asia/Hong_Kong', '學校', 'sent'),
  ('cccccccc-0000-0000-0000-00000000000c', 'e1cdef71-8f31-5771-92c2-535eaf016c6e', 'OFF', (CURRENT_DATE - INTERVAL '1 day' + TIME '08:03:00') AT TIME ZONE 'Asia/Hong_Kong', '學校', 'sent')
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 6. (可選) 同步現有測試學生 UUID
--    若 DB 裡仍有 STU2026001 的舊 UUID (88888888-...)，
--    將其 ID 與相關紀錄更新為新 UUID，避免衝突。
-- =====================================================================
DO $$
DECLARE
  old_id UUID := '88888888-8888-8888-8888-888888888888';
  new_id UUID := '72796632-8672-5bf2-bfe7-73e9e562eb31';
BEGIN
  IF EXISTS (SELECT 1 FROM students WHERE id = old_id) THEN
    -- 將該學生改名為佔位，避免 UNIQUE(student_no) 衝突
    UPDATE students SET student_no = 'STU_LEGACY_001' WHERE id = old_id;
    -- 更新 check_logs 引用
    UPDATE check_logs SET student_id = new_id WHERE student_id = old_id;
    -- 刪除舊記錄
    DELETE FROM students WHERE id = old_id;
    RAISE NOTICE '已將舊測試學生 UUID (%) 遷移至新 UUID (%)', old_id, new_id;
  END IF;
END
$$;

-- =====================================================================
-- 7. 測試提示
-- =====================================================================
--   - 預設網站密碼：bus2026
--   - 管理員登入密碼：admin
--   - 打卡員登入密碼：test
--   - 任何學生的 QR Code 內容 = 該學生的 UUID (例如 STU2026001 → 72796632-8672-5bf2-bfe7-73e9e562eb31)
--   - UUID 與 student_no 對應：可用 SHA-1('STU_NO:STU2026001') 的前 32 個 hex 反推
