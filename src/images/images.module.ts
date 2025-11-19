import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ConfigModule } from "@nestjs/config";
import { ImagesService } from "./images.service";
import { ImagesController } from "./images.controller";
import { Image, ImageSchema } from "./images.schema";
import { R2Module } from "src/r2/r2.module";
@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([{ name: Image.name, schema: ImageSchema }]), R2Module
  ],
  controllers: [ImagesController],
  providers: [ImagesService],
  exports: [ImagesService],
})
export class ImagesModule {}