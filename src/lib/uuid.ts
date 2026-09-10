/**
 * 由 student_no 推導出 UUID (UUIDv5 格式)。
 *
 * 此檔案只能在 server 端使用 (API routes / build time)，
 * 因為引用了 node:crypto，無法在 client 端 bundle。
 *
 *  - 使用 SHA-1 雜湊 + 標準 UUID 格式 (8-4-4-4-12 hex)，仍為合法 UUID
 *  - 相同 student_no 永遠產生相同 UUID (deterministic)
 *  - 每位學生的 UUID 內含其獨特編碼 (由 student_no 雜湊而來)
 */

import { createHash } from "node:crypto";

export function uuidFromStudentNo(studentNo: string): string {
  if (!studentNo) {
    throw new Error("uuidFromStudentNo: studentNo 不可為空");
  }
  const hash = createHash("sha1")
    .update(`STU_NO:${studentNo}`)
    .digest("hex")
    .slice(0, 32);
  const bytes = hash.split("");
  // 設定 version 5 (位於第 13 個 hex char)
  bytes[12] = "5";
  // 設定 variant 10xx (位於第 17 個 hex char)
  bytes[16] = ((parseInt(bytes[16], 16) & 0x3) | 0x8).toString(16);
  const h = bytes.join("");
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    h.slice(12, 16),
    h.slice(16, 20),
    h.slice(20, 32),
  ].join("-");
}

/**
 * 批次產生多個學生的 UUID map。
 */
export function uuidBatchFromStudentNos(
  studentNos: string[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const sn of studentNos) {
    out[sn] = uuidFromStudentNo(sn);
  }
  return out;
}

/**
 * 列出所有已知的 student_no → UUID 對應。
 * 與 supabase/migrations/20260910_dummy_data.sql 保持一致。
 * 用於 demo 模式 (Supabase 未連線時) 的 fallback 資料。
 */
export const DEMO_STUDENT_UUIDS: Record<string, string> = {
  STU2026001: "72796632-8672-5bf2-bfe7-73e9e562eb31",
  STU2026002: "d161426a-4bd6-5f11-8f80-ebcf70863ff1",
  STU2026003: "a741ce97-4633-5053-acc2-a6a5bf8a4250",
  STU2026004: "64adc074-6206-5b62-b3c5-8b111195d6ee",
  STU2026005: "c2f74691-fdae-578c-973d-dfb86d2fbb26",
  STU2026006: "aedd575d-aa5a-5254-81c5-5a5ea2e42839",
  STU2026007: "8e341752-391e-504c-9b6f-ce041de5ba60",
  STU2026008: "d10ea2ae-4b13-5418-a824-c0275fdffaa2",
  STU2026009: "6fbac16b-ca86-5dcf-ae40-abf15b973d11",
  STU2026010: "311d99e4-61fa-5363-a96f-683c017495c5",
  STU2026011: "b9dfbc38-d7ff-5ded-981a-8a46f054a9e2",
  STU2026012: "b3c89f67-29e1-5b2e-95d5-c01d7f71177e",
  STU2026013: "99fe5496-aab3-5bdb-bb5b-052998d3400a",
  STU2026014: "2f6014e7-a703-5cda-aa89-f76cdad939b6",
  STU2026015: "91d996e5-41a5-5dee-a861-df71b7c7ef2a",
  STU2026016: "cd3fbc1c-8f7c-5528-ba66-c93ada5434d5",
  STU2026017: "c9ccb982-f7dd-5964-aba7-af1c4f6456a1",
  STU2026018: "9f59ae97-2481-57af-b80a-10e20789a292",
  STU2026019: "e1cdef71-8f31-5771-92c2-535eaf016c6e",
  STU2026020: "de0f01ef-635c-5361-8d13-f885fd594042",
};
