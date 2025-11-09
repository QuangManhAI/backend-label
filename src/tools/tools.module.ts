import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ResetController } from "./reset.controller";
import { ResetService } from "./reset.service";
import { Image, ImageSchema } from "../images/images.schema";

@Module({
  imports: [MongooseModule.forFeature([{ name: Image.name, schema: ImageSchema }])],
  controllers: [ResetController],
  providers: [ResetService],
})
export class ToolsModule {}
