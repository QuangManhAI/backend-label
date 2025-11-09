import { join } from "path";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { NestExpressApplication } from "@nestjs/platform-express";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  });

  app.useStaticAssets(join(process.cwd(), "uploads/images"), {
    prefix: "/uploads/images/",
  });

  await app.listen(process.env.PORT || 3001);
  console.log(`Server running at http://localhost:${process.env.PORT || 3001}`);
}
bootstrap();
