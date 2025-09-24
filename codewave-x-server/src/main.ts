import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  const config = new DocumentBuilder()
    .setTitle('CodeWave API')
    .setDescription('REST endpoints for analysis and artifacts')
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .build();

  const doc = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, doc, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'CodeWave Docs',
  });
  if (process.env.SWAGGER_JSON === '1') {
    const fs = await import('node:fs');
    fs.writeFileSync('./openapi.json', JSON.stringify(doc, null, 2));
  }
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
