import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ImagesService } from "./images.service";
import * as path from "path";

@Controller("images")
export class ImagesController {
  constructor(private readonly service: ImagesService) {}

  @Get("list")
  async list(@Query("dataset") dataset?: string, @Query("version") version?: string) {
    return this.service.listAll(dataset, version);
  }

  @Get(":dataset/:version/:fileName")
  async getOne(
    @Param("dataset") dataset: string,
    @Param("version") version: string,
    @Param("fileName") fileName: string,
  ) {
    return this.service.getByName(fileName, dataset, version);
  }

  @Post("infer")
  async infer(@Body() body: { fileName: string; dataset: string; version?: string }) {
    const uploadDir = path.join(process.cwd(), "uploads", "images", body.dataset);
    const absPath = path.join(uploadDir, body.fileName);
    return this.service.inferAndSave(absPath, body.dataset, body.version || "v1");
  }

  @Post("crop")
  async crop(@Body() body: { fileName: string; bbox: number[]; dataset: string; version?: string }) {
    return this.service.cropAndInfer(body.fileName, body.bbox, body.dataset, body.version || "v1");
  }

  @Post("save")
  async save(@Body() body: { 
    fileName: string; 
    filePath: string; 
    dataset: string; 
    version?: string; 
    annotations: any[]; 
  }) {
    const version = body.version || "v1";

    await this.service.saveAnnotation(body.fileName, body.annotations, body.dataset, version);

    return this.service.saveImageRecord(
      body.fileName,
      body.filePath,
      body.annotations,
      body.dataset,
      version,
    );
  }

}