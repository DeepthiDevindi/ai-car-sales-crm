export type ServiceStatus = 'up' | 'down';

export interface HealthResponse {
  status: 'ok' | 'error';
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
  };
  timestamp: string;
}
