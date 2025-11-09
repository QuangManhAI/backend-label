import { Module } from "@nestjs/common";
import { DataPipelineService } from "./data-pipeline.service";
import { DataPipelineController } from "./data-pipeline.controller";
import { ImagesModule } from "../images/images.module";

@Module({
  imports: [ImagesModule],
  providers: [DataPipelineService],
  controllers: [DataPipelineController],
})
export class DataPipelineModule {}
