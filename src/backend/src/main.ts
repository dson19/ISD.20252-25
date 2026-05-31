import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.getHttpAdapter().getInstance().set('etag', false);
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  const allowedOrigins = [
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127\.0\.0\.1:\d+$/,
    /^http:\/\/0\.0\.0\.0:\d+$/,
    /^https:\/\/.*\.vercel\.app$/,
  ];
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : [];

  app.enableCors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.some((pattern) => pattern.test(origin)) ||
        allowedOriginsEnv.includes(origin)
      ) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
  });
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`Backend API is running on http://localhost:${port}`);
}
bootstrap();
