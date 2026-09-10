export type Bus = {
  id: string;
  plate_number: string;
  route_name: string;
  capacity: number;
};

export type UserRole = "admin" | "nanny";

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
  nanny_id: string | null;
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