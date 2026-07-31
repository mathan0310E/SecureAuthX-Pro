import { describe, expect, it } from 'vitest';
import { AppError, Errors } from '../../src/utils/errors';

describe('AppError + Errors factory', () => {
  it('builds a typed operational error', () => {
    const err = Errors.forbidden('You cannot change your own role.');
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
    expect(err.message).toBe('You cannot change your own role.');
    expect(err.isOperational).toBe(true);
  });

  it('covers the full status-code surface', () => {
    expect(Errors.badRequest().statusCode).toBe(400);
    expect(Errors.unauthorized().statusCode).toBe(401);
    expect(Errors.forbidden().statusCode).toBe(403);
    expect(Errors.notFound().statusCode).toBe(404);
    expect(Errors.conflict().statusCode).toBe(409);
    expect(Errors.tooManyRequests().statusCode).toBe(429);
    expect(Errors.validation().statusCode).toBe(422);
    expect(Errors.internal().statusCode).toBe(500);
  });

  it('carries optional details', () => {
    const err = Errors.validation('Bad fields.', { field: 'email' });
    expect(err.details).toEqual({ field: 'email' });
  });
});
