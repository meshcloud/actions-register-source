import axios, { AxiosError } from 'axios';

export interface CoreAdapter {
  error: (message: string) => void;
  debug: (message: string) => void;
}

/**
 * Formats an AxiosError into a concise, readable error message
 * Includes: HTTP method, URL, status code, and response body (typically error message)
 * Excludes verbose config details that cause thousands of lines of output
 */
export function formatAxiosError(error: AxiosError): string {
  const parts: string[] = [];

  if (error.config) {
    if (error.config.method) {
      parts.push(`Method: ${error.config.method.toUpperCase()}`);
    }
    if (error.config.url) {
      parts.push(`URL: ${error.config.url}`);
    }
  }

  if (error.response) {
    parts.push(`Status: ${error.response.status}`);
    if (error.response.data) {
      const responseData = error.response.data;
      if (typeof responseData === 'string') {
        parts.push(`Response: ${responseData}`);
      } else if (typeof responseData === 'object') {
        parts.push(`Response: ${JSON.stringify(responseData)}`);
      }
    }
  } else if (error.message) {
    parts.push(`Error: ${error.message}`);
  }

  return parts.join(' | ');
}

/**
 * Logs an AxiosError with concise formatting
 * HTTP errors are considered "expected" and are treated as fully handled
 */
export function logAxiosError(error: AxiosError, coreAdapter: CoreAdapter, context: string): void {
  const formattedError = formatAxiosError(error);
  coreAdapter.error(`${context}: ${formattedError}`);
}

/**
 * Determines if an error is an AxiosError
 */
export function isAxiosError(error: any): error is AxiosError {
  return axios.isAxiosError(error);
}
