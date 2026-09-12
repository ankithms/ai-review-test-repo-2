import { AppError } from './errors.js';

export function authenticate(header) {
  if (!header?.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHORIZED', 'A bearer token is required');
  }

  const token = header.slice('Bearer '.length);
  const separator = token.lastIndexOf(':');
  if (separator <= 0 || separator === token.length - 1) {
    throw new AppError(401, 'UNAUTHORIZED', 'The bearer token is malformed');
  }

  const tenantId = token.slice(0, separator);
  const role = token.slice(separator + 1);
  if (!['operator', 'admin'].includes(role)) {
    throw new AppError(403, 'FORBIDDEN', 'The token role is not allowed');
  }

  return { tenantId, role };
}

