/**
 * i18next 設定：繁體中文 (zh-HK)、English (en)、簡體中文 (zh-CN)
 *
 * 語言循環順序：繁 → 英 → 簡 → 繁
 * 使用者切換時 reload 頁面以確保整個 UI 重新 render。
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";

export const SUPPORTED_LANGS = ["zh-HK", "en", "zh-CN"] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

export const LANG_LABELS: Record<SupportedLang, string> = {
  "zh-HK": "繁體中文",
  en: "English",
  "zh-CN": "簡體中文",
};

/** 取得下一個語言（用於 cycle） */
export function nextLang(current: SupportedLang): SupportedLang {
  const idx = SUPPORTED_LANGS.indexOf(current);
  return SUPPORTED_LANGS[(idx + 1) % SUPPORTED_LANGS.length];
}

const resources = {
  "zh-HK": {
    translation: {
      // 個人資料頁
      "profile.title": "個人資料",
      "profile.edit": "編輯",
      "profile.preferences": "偏好設定",
      "profile.preferencesDesc": "介面顯示語言",
      "profile.language": "語言",
      "profile.languageDesc": "介面顯示語言",
      "profile.account": "帳號",
      "profile.accountDesc": "登入、安全與支援",
      "profile.systemSetting": "系統設定",
      "profile.systemSettingDesc": "校巴、學生、報表、站台",
      "profile.accountInfo": "帳戶資訊",
      "profile.accountInfoDesc": "管理密碼、電話等帳戶資料",
      "profile.contactSupport": "聯絡支援",
      "profile.contactSupportDesc": "使用問題或意見回饋",
      "profile.logout": "登出",
      "profile.logoutDesc": "結束本次登入狀態",
      "profile.version": "v1.0 · 此頁面僅供授權人員使用。所有連線會被記錄。",
      "profile.langSwitched": "語言已切換",
      "profile.langPickerTitle": "選擇語言",
      "profile.langPickerDesc": "請選擇介面顯示語言",
      "profile.langConfirmTitle": "確認切換語言",
      "profile.langConfirmDesc": "確定要切換為「{{lang}}」嗎？頁面將重新整理。",
      "profile.loggedOut": "已登出",
      "profile.loggedOutDesc": "請重新輸入網站密碼以繼續使用。",
      // 編輯個人資料
      "profile.editProfile": "編輯個人資料",
      "profile.editProfileDesc": "未來可在這裡修改姓名與電話。",
      // 系統資料 section
      "profile.systemData": "系統資料",
      "profile.systemDataDesc": "站台顯示資訊",
      "profile.systemTitle": "系統標題",
      "profile.systemTitleDesc": "首頁、登入與鎖定頁顯示的標題文字",
      "profile.systemTitleDialogTitle": "更改系統標題",
      "profile.systemTitleDialogDesc": "新標題會即時顯示於首頁、登入與鎖定頁。",
      "profile.systemTitlePlaceholder": "請輸入系統標題",
      "profile.systemTitleEmptyError": "系統標題不可為空",
      "profile.systemTitleUpdated": "系統標題已更新",
      "profile.systemTitleUpdatedDesc": "新標題已套用至站台各頁面。",
      "profile.systemTitleReset": "已還原為預設標題",
      "profile.systemTitleResetDesc": "系統標題已還原為「校巴安全打卡系統」。",
      "profile.reset": "還原預設",
      // 聯絡支援 popup
      "popup.devTitle": "功能開發中",
      "popup.devDesc": "聯絡支援功能現正積極開發，敬請期待！",

      // 帳戶資訊頁
      "account.title": "帳戶資訊",
      "account.basicInfo": "基本資料",
      "account.name": "姓名",
      "account.role": "角色",
      "account.contactInfo": "聯絡資料",
      "account.phone": "電話號碼",
      "account.phonePlaceholder": "請輸入電話號碼",
      "account.phoneEmptyError": "電話號碼不可為空",
      "account.saveChanges": "儲存變更",
      "account.saving": "儲存中…",
      "account.saved": "已儲存",
      "account.savedDesc": "電話號碼已更新。",
      "account.saveFailed": "儲存失敗",
      "account.saveFailedDesc": "請稍後再試。",
      "account.security": "安全性",
      "account.changePassword": "變更密碼",
      "account.changePasswordDesc": "站台密碼（請聯絡管理員重設）",
      "account.changePasswordTitle": "變更密碼",
      "account.changePasswordMsg": "請聯絡管理員重設站台密碼。",

      // 系統設定頁
      "system.title": "系統設定",
      "system.adminCard": "管理員識別卡",
      "system.siteStatus": "站台狀態",
      "system.siteStatusDesc": "即時資訊",
      "system.sitePublicMode": "站台公開模式",
      "system.sitePublicOn": "需先輸入站台密碼",
      "system.sitePublicOff": "直接進入登入頁",
      "system.sitePassword": "站台密碼",
      "system.sitePasswordCustom": "已設定自訂密碼",
      "system.sitePasswordDefault": "使用預設密碼",
      "system.sitePasswordCustomLabel": "自訂",
      "system.sitePasswordDefaultLabel": "預設",
      "system.busManagement": "校車管理",
      "system.studentManagement": "學生管理",
      "system.reportAnalysis": "報表分析",
      "system.siteAndUsers": "站台與人員",
      "system.busData": "校巴資料管理",
      "system.busDataDesc": "新增 / 修改 / 刪除車牌、路線、載客量",
      "system.qrCodes": "QR Code 批次產生",
      "system.qrCodesDesc": "批次產生學生 QR Code，支援列印 / 下載 PNG",
      "system.studentMgmt": "學生管理",
      "system.studentMgmtDesc": "新增 / 刪除學生資料，產生 QR Code，取得家長追蹤連結",
      "system.parentTracking": "家長即時追蹤",
      "system.parentTrackingDesc": "輸入 STU No 搜尋後查看上下車狀態與通知",
      "system.statistics": "統計表",
      "system.statisticsDesc": "依打卡資料彙整班次、上落車率、路線比較等報表",
      "system.adminConsole": "管理員控制台",
      "system.adminConsoleDesc": "查看全校路線、班次狀態、學生出勤",
      "system.siteSettings": "站台設定",
      "system.siteSettingsDesc": "站台公開狀態、站台密碼",
      "system.adminUsers": "管理員與打卡員",
      "system.adminUsersDesc": "新增 / 修改 / 刪除人員帳號",
      "system.footer": "系統設定 · 僅限管理員操作",
    },
  },
  en: {
    translation: {
      // 個人資料頁
      "profile.title": "Profile",
      "profile.edit": "Edit",
      "profile.preferences": "Preferences",
      "profile.preferencesDesc": "Interface display language",
      "profile.language": "Language",
      "profile.languageDesc": "Interface display language",
      "profile.account": "Account",
      "profile.accountDesc": "Login, security & support",
      "profile.systemSetting": "System Settings",
      "profile.systemSettingDesc": "Buses, students, reports, site",
      "profile.accountInfo": "Account Info",
      "profile.accountInfoDesc": "Manage password, phone and more",
      "profile.contactSupport": "Contact Support",
      "profile.contactSupportDesc": "Usage questions or feedback",
      "profile.logout": "Log Out",
      "profile.logoutDesc": "End current session",
      "profile.version": "v1.0 · This page is for authorized personnel only. All connections are logged.",
      "profile.langSwitched": "Language Changed",
      "profile.langPickerTitle": "Select Language",
      "profile.langPickerDesc": "Choose your interface language",
      "profile.langConfirmTitle": "Confirm Language Change",
      "profile.langConfirmDesc": "Switch to 「{{lang}}」? The page will reload.",
      "profile.loggedOut": "Logged Out",
      "profile.loggedOutDesc": "Please re-enter the site password to continue.",
      "profile.editProfile": "Edit Profile",
      "profile.editProfileDesc": "Coming soon: edit name and phone here.",
      // 系統資料 section
      "profile.systemData": "System Data",
      "profile.systemDataDesc": "Site display info",
      "profile.systemTitle": "System Title",
      "profile.systemTitleDesc": "Title text shown on home, login and lock pages",
      "profile.systemTitleDialogTitle": "Change System Title",
      "profile.systemTitleDialogDesc": "The new title will be applied to the home, login and lock pages.",
      "profile.systemTitlePlaceholder": "Enter system title",
      "profile.systemTitleEmptyError": "System title cannot be empty",
      "profile.systemTitleUpdated": "System Title Updated",
      "profile.systemTitleUpdatedDesc": "The new title has been applied across the site.",
      "profile.systemTitleReset": "Restored to default title",
      "profile.systemTitleResetDesc": "The system title has been restored to 「校巴安全打卡系統」.",
      "profile.reset": "Reset to Default",
      "popup.devTitle": "Under Development",
      "popup.devDesc": "Contact support is under active development. Stay tuned!",

      // 帳戶資訊頁
      "account.title": "Account Info",
      "account.basicInfo": "Basic Info",
      "account.name": "Name",
      "account.role": "Role",
      "account.contactInfo": "Contact Info",
      "account.phone": "Phone Number",
      "account.phonePlaceholder": "Enter phone number",
      "account.phoneEmptyError": "Phone number cannot be empty",
      "account.saveChanges": "Save Changes",
      "account.saving": "Saving…",
      "account.saved": "Saved",
      "account.savedDesc": "Phone number updated.",
      "account.saveFailed": "Save Failed",
      "account.saveFailedDesc": "Please try again later.",
      "account.security": "Security",
      "account.changePassword": "Change Password",
      "account.changePasswordDesc": "Site password (contact admin to reset)",
      "account.changePasswordTitle": "Change Password",
      "account.changePasswordMsg": "Please contact admin to reset site password.",

      // 系統設定頁
      "system.title": "System Settings",
      "system.adminCard": "Admin Card",
      "system.siteStatus": "Site Status",
      "system.siteStatusDesc": "Real-time info",
      "system.sitePublicMode": "Site Public Mode",
      "system.sitePublicOn": "Requires site password first",
      "system.sitePublicOff": "Go directly to login",
      "system.sitePassword": "Site Password",
      "system.sitePasswordCustom": "Custom password set",
      "system.sitePasswordDefault": "Using default password",
      "system.sitePasswordCustomLabel": "Custom",
      "system.sitePasswordDefaultLabel": "Default",
      "system.busManagement": "Bus Management",
      "system.studentManagement": "Student Management",
      "system.reportAnalysis": "Reports & Analysis",
      "system.siteAndUsers": "Site & Users",
      "system.busData": "Bus Data Management",
      "system.busDataDesc": "Add / edit / delete license plates, routes, capacity",
      "system.qrCodes": "Batch QR Code Generation",
      "system.qrCodesDesc": "Generate student QR codes in batch, support print / download PNG",
      "system.studentMgmt": "Student Management",
      "system.studentMgmtDesc": "Add / delete students, generate QR codes, get parent tracking links",
      "system.parentTracking": "Parent Real-time Tracking",
      "system.parentTrackingDesc": "Search by STU No to view boarding/alighting status",
      "system.statistics": "Statistics",
      "system.statisticsDesc": "Summarize trips, boarding rates, route comparisons from check-in data",
      "system.adminConsole": "Admin Console",
      "system.adminConsoleDesc": "View all routes, trip status, student attendance",
      "system.siteSettings": "Site Settings",
      "system.siteSettingsDesc": "Site public status, site password",
      "system.adminUsers": "Admins & Operators",
      "system.adminUsersDesc": "Add / edit / delete user accounts",
      "system.footer": "System Settings · Admin only",
    },
  },
  "zh-CN": {
    translation: {
      // 個人資料頁
      "profile.title": "个人资料",
      "profile.edit": "编辑",
      "profile.preferences": "偏好设定",
      "profile.preferencesDesc": "界面显示语言",
      "profile.language": "语言",
      "profile.languageDesc": "界面显示语言",
      "profile.account": "帐号",
      "profile.accountDesc": "登入、安全与支援",
      "profile.systemSetting": "系统设定",
      "profile.systemSettingDesc": "校巴、学生、报表、站台",
      "profile.accountInfo": "帐户资讯",
      "profile.accountInfoDesc": "管理密码、电话等帐户资料",
      "profile.contactSupport": "联络支援",
      "profile.contactSupportDesc": "使用问题或意见回馈",
      "profile.logout": "登出",
      "profile.logoutDesc": "结束本次登入状态",
      "profile.version": "v1.0 · 此页面仅供授权人员使用。所有连线会被记录。",
      "profile.langSwitched": "语言已切换",
      "profile.langPickerTitle": "选择语言",
      "profile.langPickerDesc": "请选择界面显示语言",
      "profile.langConfirmTitle": "确认切换语言",
      "profile.langConfirmDesc": "确定要切换为「{{lang}}」吗？页面将重新整理。",
      "profile.loggedOut": "已登出",
      "profile.loggedOutDesc": "请重新输入网站密码以继续使用。",
      "profile.editProfile": "编辑个人资料",
      "profile.editProfileDesc": "未来可在这里修改姓名与电话。",
      // 系統資料 section
      "profile.systemData": "系统资料",
      "profile.systemDataDesc": "站台显示资讯",
      "profile.systemTitle": "系统标题",
      "profile.systemTitleDesc": "首页、登入与锁定页显示的标题文字",
      "profile.systemTitleDialogTitle": "更改系统标题",
      "profile.systemTitleDialogDesc": "新标题会即时显示于首页、登入与锁定页。",
      "profile.systemTitlePlaceholder": "请输入系统标题",
      "profile.systemTitleEmptyError": "系统标题不可为空",
      "profile.systemTitleUpdated": "系统标题已更新",
      "profile.systemTitleUpdatedDesc": "新标题已套用至站台各页面。",
      "profile.systemTitleReset": "已还原为预设标题",
      "profile.systemTitleResetDesc": "系统标题已还原为「校巴安全打卡系统」。",
      "profile.reset": "还原预设",
      "popup.devTitle": "功能开发中",
      "popup.devDesc": "联络支援功能正积极开发，敬请期待！",

      // 帐户资讯页
      "account.title": "帐户资讯",
      "account.basicInfo": "基本资料",
      "account.name": "姓名",
      "account.role": "角色",
      "account.contactInfo": "联络资料",
      "account.phone": "电话号码",
      "account.phonePlaceholder": "请输入电话号码",
      "account.phoneEmptyError": "电话号码不可为空",
      "account.saveChanges": "储存变更",
      "account.saving": "储存中…",
      "account.saved": "已储存",
      "account.savedDesc": "电话号码已更新。",
      "account.saveFailed": "储存失败",
      "account.saveFailedDesc": "请稍后再试。",
      "account.security": "安全性",
      "account.changePassword": "变更密码",
      "account.changePasswordDesc": "网站密码（请联络管理员重设）",
      "account.changePasswordTitle": "变更密码",
      "account.changePasswordMsg": "请联络管理员重设网站密码。",

      // 系统设定页
      "system.title": "系统设定",
      "system.adminCard": "管理员识别卡",
      "system.siteStatus": "站台状态",
      "system.siteStatusDesc": "即时资讯",
      "system.sitePublicMode": "站台公开模式",
      "system.sitePublicOn": "需先输入站台密码",
      "system.sitePublicOff": "直接进入登入页",
      "system.sitePassword": "站台密码",
      "system.sitePasswordCustom": "已设定自订密码",
      "system.sitePasswordDefault": "使用预设密码",
      "system.sitePasswordCustomLabel": "自订",
      "system.sitePasswordDefaultLabel": "预设",
      "system.busManagement": "校车管理",
      "system.studentManagement": "学生管理",
      "system.reportAnalysis": "报表分析",
      "system.siteAndUsers": "站台与人员",
      "system.busData": "校巴资料管理",
      "system.busDataDesc": "新增 / 修改 / 删除车牌、路线、载客量",
      "system.qrCodes": "QR Code 批次产生",
      "system.qrCodesDesc": "批次产生学生 QR Code，支援列印 / 下载 PNG",
      "system.studentMgmt": "学生管理",
      "system.studentMgmtDesc": "新增 / 删除学生资料，产生 QR Code，取得家长追踪连结",
      "system.parentTracking": "家长即时追踪",
      "system.parentTrackingDesc": "输入 STU No 搜寻后查看上下车状态与通知",
      "system.statistics": "统计表",
      "system.statisticsDesc": "依打卡资料彙整班次、上下车率、路线比较等报表",
      "system.adminConsole": "管理员控制台",
      "system.adminConsoleDesc": "查看全校路线、班次状态、学生出勤",
      "system.siteSettings": "站台设定",
      "system.siteSettingsDesc": "站台公开状态、站台密码",
      "system.adminUsers": "管理员与打卡员",
      "system.adminUsersDesc": "新增 / 修改 / 删除人员帐号",
      "system.footer": "系统设定 · 仅限管理员操作",
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: "zh-HK", // 預設語言
  fallbackLng: "zh-HK",
  interpolation: {
    escapeValue: false, // React 已防護 XSS
  },
});

export default i18n;

/** 取得目前儲存的語言，若無則回傳預設 */
export function getSavedLang(): SupportedLang {
  if (typeof window === "undefined") return "zh-HK";
  try {
    const stored = window.localStorage.getItem("bus-profile-lang");
    if (stored && SUPPORTED_LANGS.includes(stored as SupportedLang)) {
      return stored as SupportedLang;
    }
  } catch {
    /* ignore */
  }
  return "zh-HK";
}
