import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';
import { Request, Response } from 'express';

type RequestWithId = Request & { requestId?: string };

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();
    const requestId = request.requestId ?? 'unavailable';
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const details = exception instanceof HttpException ? exception.getResponse() : undefined;
    const message = this.messageFrom(details, status);

    if (!(exception instanceof HttpException)) {
      this.logger.error(`Unhandled request failure (${exception instanceof Error ? exception.name : 'unknown error'}); requestId=${requestId}`);
    }

    response.status(status).json({
      statusCode: status,
      code: this.codeFor(status),
      message,
      requestId
    });
  }

  private messageFrom(details: string | object | undefined, status: number): string {
    if (typeof details === 'string') return details;
    if (details && typeof details === 'object' && 'message' in details) {
      const message = details.message;
      if (typeof message === 'string') return message;
      if (Array.isArray(message) && message.every((part) => typeof part === 'string')) return message.join(', ');
    }
    return status >= 500 ? 'An unexpected error occurred' : 'The request could not be completed';
  }

  private codeFor(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST: return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED: return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN: return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND: return 'NOT_FOUND';
      case HttpStatus.TOO_MANY_REQUESTS: return 'RATE_LIMITED';
      case HttpStatus.SERVICE_UNAVAILABLE: return 'SERVICE_UNAVAILABLE';
      default: return status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'HTTP_ERROR';
    }
  }
}
