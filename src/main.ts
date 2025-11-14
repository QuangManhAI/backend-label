import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  });

app.useStaticAssets("/home/quangmanh/Documents/pineline/back-end-label/uploads", {
  prefix: "/uploads",
});

  await app.listen(process.env.PORT || 3001);
  console.log(`Server running at http://localhost:${process.env.PORT || 3001}`);
}
bootstrap();
