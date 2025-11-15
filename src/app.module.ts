import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ConfigModule } from "@nestjs/config";
import { ImagesModule } from "./images/images.module";
import { DataPipelineModule } from "./data-pipeline/data-pipeline.module";
import { ToolsModule } from "./tools/tools.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.MONGO_URI || "", {
      dbName: process.env.MONGO_DB,
    }),
    ImagesModule,
    DataPipelineModule,
    ToolsModule,
  ],
})
export class AppModule {}
