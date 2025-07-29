export interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  old_values?: any;
  new_values?: any;
  ip_address?: string;
  user_agent?: string;
  request_data?: any;
  response_data?: any;
  status_code?: number;
  created_at: Date;
}

export interface CreateAuditLogData {
  user_id?: string | undefined;
  action: string;
  resource_type: string;
  resource_id?: string | undefined;
  old_values?: any;
  new_values?: any;
  ip_address?: string | undefined;
  user_agent?: string | undefined;
  request_data?: any;
  response_data?: any;
  status_code?: number | undefined;
  created_at?: Date;
}