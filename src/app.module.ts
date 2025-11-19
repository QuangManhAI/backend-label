import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ConfigModule } from "@nestjs/config";
import { ImagesModule } from "./images/images.module";
import { DataPipelineModule } from "./data-pipeline/data-pipeline.module";
import { ToolsModule } from "./tools/tools.module";
import { R2Module } from "./r2/r2.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.MONGO_URI || "", {
      dbName: process.env.MONGO_DB,
    }),
    R2Module,
    ImagesModule,
    DataPipelineModule,
    ToolsModule,
  ],
})
export class AppModule {}
