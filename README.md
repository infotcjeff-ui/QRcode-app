# 校巴安全打卡系統 | School Bus Check-in WebApp

Mobile-first 校巴 QR Code 打卡系統，使用 Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Supabase (PostgreSQL + Realtime)。

## 主要功能

- **🛡️ 管理員控制台** (`/system-setting/admin`)：實時監控所有校巴路線、班次狀態、學生打卡紀錄與 WhatsApp 通知進度。
- **📊 統計表** (`/system-setting/admin/statistics`)：依打卡資料（check_logs）即時彙整進階統計，支援依日期區間、班次類型、校巴路線、保姆等多維度篩選；一鍵生成報表後寫入 Supabase `statistics_reports` 表，包含 KPI、路線 / 日期 / 時段 / 班次類型分布、Top/Bottom 學生等視覺化分析。
- **📱 流動打卡** (`/scan`)：Mobile-first 介面，整合 `@html5-qrcode` 後置鏡頭掃描器、分頁切換上車/落車、即時已打卡清單與「未打卡學生」對比；listing 內顯示每位學生的掃描時間。
- **👨‍👩‍👧 家長即時追蹤**：
  - `/student` — 搜尋頁：輸入 STU No / 姓名 / 家長姓名，即時顯示學生 card
  - `/student/[id]` — 詳細頁：透過 Supabase Realtime 訂閱，子女每次打卡即時更新；包含歷史打卡紀錄
- **⚙️ API 路由**：
  - `/api/check-log` - 具冪等性 (Idempotency) 驗證的重複掃描防呆後端。
  - `/api/statistics` - 生成、列出、刪除統計表（POST/GET/DELETE）；所有資料皆寫入 Supabase `statistics_reports` 表。
  - `/api/whatsapp` - 模擬 Meta WhatsApp Cloud API 通知 pipeline stub。

## 快速開始

```bash
# 1. 安裝依賴
npm install

# 2. 設定 Supabase 環境變數
cp .env.local.example .env.local
# 然後填入 NEXT_PUBLIC_SUPABASE_URL 與 NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY

# 3. 執行 Supabase Migration
# 將以下 migration 套用到你的 Supabase 專案（依時序執行）：
#   - supabase/migrations/20260819_init_schema.sql
#   - supabase/migrations/20260910_statistics_reports.sql
#   - supabase/migrations/20260910_rename_nanny_to_attendant.sql
#   - supabase/migrations/20260910_dummy_data.sql       ← 塞入 4 條路線 / 4 位打卡員 / 20 位學生

# 4. 啟動開發伺服器
npm run dev
```

打開 [http://localhost:3000](http://localhost:3000) 即可看到角色切換面板。

## 測試帳號與 QR Code

| 角色 | 密碼 | 說明 |
|------|------|------|
| 管理員 | `admin` | 系統管理員 (陳大文主管) |
| 打卡員 | `test` | 示範打卡員 (張翠蘭姐) |
| 網站鎖 | `bus2026` | 進入任何頁面前的網站密碼 |

測試學生（STU2026001 藍小明）UUID：
```
72796632-8672-5bf2-bfe7-73e9e562eb31
```

每位學生的 UUID 都是由 `student_no` 透過 SHA-1 雜湊推導而來 (UUIDv5 格式)，仍為合法 RFC 4122 v5 UUID。

可使用任何 QR Code 產生器把此 UUID 編碼後，用手機鏡頭掃描。

## 目錄結構

```
.
├── supabase/migrations/        # Supabase 資料庫 migration
├── src/
│   ├── app/
│   │   ├── system-setting/     # 角色入口 / 管理員後台（含統計表）
│   │   ├── scan/page.tsx       # 流動打卡 (Attendant)
│   │   ├── student/            # 家長即時追蹤 (搜尋 + 詳細頁)
│   │   ├── api/check-log/      # 打卡 API (含冪等性)
│   │   ├── api/statistics/     # 統計表生成/列表/刪除 API
│   │   └── api/whatsapp/       # WhatsApp 通知 stub
│   ├── components/
│   │   ├── ui/                 # 共用 UI 元件 (含 BackButton)
│   │   ├── admin/              # 管理員頁專用元件
│   │   └── scan/               # 打卡頁專用元件
│   └── lib/
│       ├── supabase.ts         # Browser Supabase Client
│       ├── supabase-server.ts  # Server-side Admin Client
│       ├── types.ts            # 共用 TypeScript 型別
│       ├── uuid.ts             # UUIDv5 由 student_no 推導 (server-only)
│       └── utils.ts            # cn() / format / UUID 驗證
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.mjs
```

## 技術棧

| 層級 | 技術 |
|------|------|
| Framework | Next.js 14+ App Router |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS + shadcn/ui |
| UI Primitives | Radix UI |
| Database | Supabase (PostgreSQL) |
| Realtime | Supabase Realtime (Postgres Changes) |
| QR Scanner | html5-qrcode |
| Icons | lucide-react |

## 冪等性 (Idempotency) 設計

`/api/check-log` 會先在 `check_logs` 表查詢 `(trip_id, student_id)` 是否已有相同 `type` 的紀錄：

- 若 `type='ON'` 已存在 → 回傳 `400` 並附 `已於 HH:MM 完成上車打卡，請勿重複掃瞄。`
- 若 `type='OFF'` 已存在 → 回傳 `400` 並附 `已完成落車下車，請勿重複掃瞄。`
- 成功新增 `OFF` 紀錄後會以非同步方式呼叫 `/api/whatsapp` 觸發家長通知。

## WhatsApp 通知 Stub

`/api/whatsapp` 模擬 Meta WhatsApp Cloud API 請求，在伺服器 console 輸出完整追蹤日誌，可直接整合 Meta Business 帳號後上線。