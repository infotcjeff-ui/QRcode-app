export type Bus = {
  id: string;
  plate_number: string;
  route_name: string;
  capacity: number;
};

export type UserRole = "admin" | "attendant";

export type User = {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  assigned_bus_id: string | null;
};

export type Student = {
  id: string;
  name: string;
  student_no: string;
  photo_url: string | null;
  parent_name: string;
  parent_phone: string;
  assigned_bus_id: string | null;
};

export type TripType = "AM_GO" | "PM_BACK";
export type TripStatus = "active" | "completed";

export type Trip = {
  id: string;
  bus_id: string;
  attendant_id: string | null;
  date: string;
  type: TripType;
  status: TripStatus;
};

export type CheckLogType = "ON" | "OFF";
export type WhatsappStatus = "pending" | "sent" | "failed";

export type CheckLog = {
  id: string;
  trip_id: string;
  student_id: string;
  type: CheckLogType;
  timestamp: string;
  location_name: string | null;
  whatsapp_status: WhatsappStatus;
};

export type CheckLogWithStudent = CheckLog & {
  student: Student | null;
};

export type CheckLogRequest = {
  student_id: string;
  trip_id: string;
  type: CheckLogType;
  location_name?: string;
};

export type CheckLogResponse = {
  success: boolean;
  data?: CheckLogWithStudent;
  error?: string;
  error_code?:
    | "DUPLICATE_ON"
    | "DUPLICATE_OFF"
    | "INVALID_STUDENT"
    | "INVALID_TRIP"
    | "INVALID_PAYLOAD"
    | "CONFIG_ERROR";
};

export type WhatsappRequest = {
  student_id: string;
  trip_id: string;
  check_log_id: string;
  location_name?: string;
};

export type WhatsappResponse = {
  success: boolean;
  status: WhatsappStatus;
  message_id?: string;
  error?: string;
};

/* ── Statistics Reports ── */

export type StatisticsReportType =
  | "check_log_advanced"
  | "check_log_route"
  | "check_log_daily"
  | "custom";

export type TripTypeFilter = TripType | "ALL";

export type StatisticsReportFilters = {
  trip_type?: TripTypeFilter;
  bus_id?: string | null;
  attendant_id?: string | null;
  route_name?: string | null;
};

export type RouteStat = {
  bus_id: string | null;
  route_name: string;
  plate_number: string | null;
  total_check_logs: number;
  on_count: number;
  off_count: number;
  unique_students: number;
  whatsapp_sent: number;
  whatsapp_failed: number;
  whatsapp_pending: number;
};

export type DailyStat = {
  date: string;
  total_check_logs: number;
  on_count: number;
  off_count: number;
  unique_students: number;
  on_rate: number;
  off_rate: number;
};

export type HourBucketStat = {
  hour: number;
  on_count: number;
  off_count: number;
};

export type TripTypeStat = {
  trip_type: TripType | "UNKNOWN";
  on_count: number;
  off_count: number;
  unique_trips: number;
  unique_students: number;
};

export type StudentAttendanceStat = {
  student_id: string;
  student_name: string;
  student_no: string;
  assigned_route: string | null;
  on_count: number;
  off_count: number;
  trip_days: number;
  attendance_rate: number;
};

export type StatisticsReportPayload = {
  generated_at: string;
  range_start: string;
  range_end: string;
  total_check_logs: number;
  total_on: number;
  total_off: number;
  unique_students: number;
  unique_trips: number;
  on_rate: number;
  off_rate: number;
  whatsapp_sent: number;
  whatsapp_failed: number;
  whatsapp_pending: number;
  by_route: RouteStat[];
  by_day: DailyStat[];
  by_trip_type: TripTypeStat[];
  by_hour: HourBucketStat[];
  top_students: StudentAttendanceStat[];
  bottom_students: StudentAttendanceStat[];
};

export type StatisticsReport = {
  id: string;
  title: string;
  report_type: StatisticsReportType;
  range_start: string;
  range_end: string;
  filters: StatisticsReportFilters;
  payload: StatisticsReportPayload;
  summary: string | null;
  generated_by: string | null;
  generated_at: string;
};

export type StatisticsGenerateRequest = {
  title?: string;
  report_type?: StatisticsReportType;
  range_start: string;
  range_end: string;
  filters?: StatisticsReportFilters;
};

export type StatisticsGenerateResponse = {
  success: boolean;
  data?: StatisticsReport;
  error?: string;
};

export type StatisticsListResponse = {
  success: boolean;
  data?: StatisticsReport[];
  error?: string;
};