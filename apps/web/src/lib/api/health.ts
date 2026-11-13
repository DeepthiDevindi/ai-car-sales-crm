import type { HealthResponse } from '@ai-car-sales-crm/shared-types';
import { apiRequest } from './client';

export async function getHealthStatus(): Promise<HealthResponse> {
  return apiRequest<HealthResponse>('/health');
}
