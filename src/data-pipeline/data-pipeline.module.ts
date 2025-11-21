import { Module } from "@nestjs/common";
import { DataPipelineService } from "./data-pipeline.service";
import { DataPipelineController } from "./data-pipeline.controller";
import { ImagesModule } from "../images/images.module";
import { R2Module } from "src/r2/r2.module";
import { MinioModule } from "src/minio/minio.module";

@Module({
  imports: [ImagesModule, R2Module, MinioModule],
  providers: [DataPipelineService],
  controllers: [DataPipelineController],
})
export class DataPipelineModule {}
