/**
 * API Index
 * Re-export all API modules for convenient imports
 */

export { api, apiClient, ApiError } from './client';
export * as authApi from './auth';
export * as journalApi from './journal';
export * as categoriesApi from './categories';
export * as behaviorsApi from './behaviors';
export * as statsApi from './stats';

