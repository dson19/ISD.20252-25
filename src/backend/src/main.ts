import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.getHttpAdapter().getInstance().set('etag', false);
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  const allowedDevOrigins = [
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127\.0\.0\.1:\d+$/,
    /^http:\/\/0\.0\.0\.0:\d+$/,
  ];
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedDevOrigins.some((pattern) => pattern.test(origin))) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
