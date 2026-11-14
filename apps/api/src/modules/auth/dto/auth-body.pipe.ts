import { ValidationPipe, type Type } from '@nestjs/common';

export function authBodyPipe(expectedType: Type<unknown>): ValidationPipe {
  return new ValidationPipe({
    expectedType,
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });
}
