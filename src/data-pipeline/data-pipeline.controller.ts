import { Body, Controller, Post } from "@nestjs/common";
import { DataPipelineService } from "./data-pipeline.service";

@Controller("pipeline")
export class DataPipelineController {
  constructor(private readonly service: DataPipelineService) {}

  @Post("auto")
  async runDataset(@Body() body: { dataset?: string; version?: string }) {
    if (body.dataset)
      return this.service.autoLabelDataset(body.dataset, body.version || "v1");
    return this.service.autoLabelAll(body.version || "v1");
  }
}
