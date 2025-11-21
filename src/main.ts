import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors({
    origin: 'http://localhost:3000'
  });

  await app.listen(process.env.PORT || 3001);
  console.log(`Server running at port ${process.env.PORT || 3001}`);
}
bootstrap();
