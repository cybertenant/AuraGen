import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks(); // lets PrismaService.onModuleDestroy run on SIGTERM
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
}
bootstrap();
