import 'dotenv/config';
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { SafeJsonLogger } from './common/safe-json-logger';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { randomUUID } from 'node:crypto';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: true });
  app.useLogger(new SafeJsonLogger());
  app.use((request: { headers: Record<string, string | string[] | undefined>; requestId?: string }, response: { setHeader: (name: string, value: string) => void }, next: () => void) => {
    const incomingId = request.headers['x-request-id'];
    request.requestId = typeof incomingId === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(incomingId) ? incomingId : randomUUID();
    response.setHeader('X-Request-Id', request.requestId);
    next();
  });
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: [
          "'self'",
          process.env.WEB_ORIGIN ?? 'http://localhost:3000',
          'ws://localhost:4000',
          'https://identitytoolkit.googleapis.com',
          'https://securetoken.googleapis.com',
          'https://*.googleapis.com',
          'https://*.firebaseapp.com'
        ]
      }
    }
  }));
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    credentials: false
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.setGlobalPrefix('api/v1');

  const swagger = new DocumentBuilder()
    .setTitle('Company Collaboration API')
    .setDescription('Role-restricted company collaboration endpoints. Firebase ID token required except health.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));
  await app.listen(Number(process.env.PORT ?? process.env.API_PORT ?? 4000), '0.0.0.0');
}

void bootstrap();
