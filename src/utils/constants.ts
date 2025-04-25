// App constants


// Defines HTTP status codes

// and their meanings for use in the application.
// This helps to standardize the responses sent from the server and makes it easier to handle errors and success responses in a consistent manner.
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;


// User roles
export const USER_ROLES = {
  FARMER: 'FARMER',
  BUYER: 'BUYER',
  ADMIN: 'ADMIN',
} as const;

// East African countries
export const COUNTRIES = {
  KENYA: 'KENYA',
  UGANDA: 'UGANDA',
  TANZANIA: 'TANZANIA',
} as const;

// Verification status
export const VERIFICATION_STATUS = {
  NOT_VERIFIED: 'NOT_VERIFIED',
  VERIFIED: 'VERIFIED',
} as const;

// Event actions for audit logging
export const EVENT_ACTIONS = {
  USER_LOGIN: 'USER_LOGIN',
  USER_REGISTERED: 'USER_REGISTERED',
  PROFILE_UPDATED: 'PROFILE_UPDATED',
  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET: 'PASSWORD_RESET',
  FEEDBACK_SUBMITTED: 'FEEDBACK_SUBMITTED',
  RATING_SUBMITTED: 'RATING_SUBMITTED',
} as const;