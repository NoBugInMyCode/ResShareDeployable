/**
 * Centralized error handling utility
 * Provides consistent error messages across the application
 */

export const ErrorMessages = {
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  SESSION_EXPIRED: 'Your session has expired. Please login again.',
  PERMISSION_DENIED: 'You do not have permission to perform this action.',
  RESOURCE_NOT_FOUND: 'The requested resource was not found.',
  DUPLICATE_RESOURCE: 'A resource with that name already exists.',
  SERVER_ERROR: 'An unexpected server error occurred. Please try again.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  FILE_TOO_LARGE: 'File size exceeds the maximum limit.',
  INVALID_FILE_TYPE: 'This file type is not supported.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.'
};

/**
 * Get user-friendly error message from error object
 * @param {Error} error - The error object
 * @param {string} context - Optional context for more specific messages
 * @returns {string} User-friendly error message
 */
export const getErrorMessage = (error, context = '') => {
  // Handle API response errors with status codes
  if (error.response) {
    const status = error.response.status;
    switch (status) {
      case 401:
        return ErrorMessages.SESSION_EXPIRED;
      case 403:
        return ErrorMessages.PERMISSION_DENIED;
      case 404:
        return ErrorMessages.RESOURCE_NOT_FOUND;
      case 409:
        return ErrorMessages.DUPLICATE_RESOURCE;
      case 413:
        return ErrorMessages.FILE_TOO_LARGE;
      case 500:
      case 502:
      case 503:
        return ErrorMessages.SERVER_ERROR;
      default:
        break;
    }
  }

  // Handle network errors
  if (error.message === 'Network Error' || error.message === 'Failed to fetch') {
    return ErrorMessages.NETWORK_ERROR;
  }

  // Handle error messages from backend
  if (error.message) {
    // Add context if provided
    if (context) {
      return `${context}: ${error.message}`;
    }
    return error.message;
  }

  // Default fallback
  return context ? `${context}: ${ErrorMessages.UNKNOWN_ERROR}` : ErrorMessages.UNKNOWN_ERROR;
};

/**
 * Create error with context
 * @param {string} operation - The operation being performed
 * @param {string} resourceName - The resource name (file, folder, etc.)
 * @returns {Function} Error handler function
 */
export const createContextualError = (operation, resourceName = '') => {
  return (error) => {
    const resource = resourceName ? ` "${resourceName}"` : '';
    const context = `Failed to ${operation}${resource}`;
    return getErrorMessage(error, context);
  };
};

export default {
  getErrorMessage,
  createContextualError,
  ErrorMessages
};
