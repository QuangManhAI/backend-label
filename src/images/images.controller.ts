import { Body, Controller, Get, Param, Post, Query, HttpException, HttpStatus } from "@nestjs/common";
import { ImagesService } from "./images.service";
import { globSync } from "glob";
import * as path from "path";
import * as fs from "fs";

@Controller("images")
export class ImagesController {
  constructor(private readonly service: ImagesService) {}

  @Get("list")
  async list(
    @Query("dataset") dataset: string,
    @Query("version") version: string,
    @Query("limit") limit = "100",
    @Query("skip") skip = "0",
  ) {
    return this.service.listAll(dataset, version, Number(limit), Number(skip));
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
    const datasetDir = path.join(process.cwd(), "uploads", "images", body.dataset);

    // tìm file trong mọi thư mục con
    const matches = globSync(`${datasetDir}/**/${body.fileName}`);

    if (!matches.length) {
      throw new HttpException(
        `Image not found for inference: ${body.fileName}`,
        HttpStatus.NOT_FOUND,
      );
    }

    const absPath = matches[0]; // file duy nhất

    return this.service.inferAndSave(absPath, body.dataset, body.version || "v1");
  }

  @Post("save")
  async save(
    @Body() body: {
      fileName: string;
      filePath: string;
      dataset: string;
      version?: string;
      annotations: any[];
    },
  ) {
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

  @Post("crop-preview")
  async cropPreview(@Body() body: any) {
    return this.service.cropPreview(body.fileName, body.bbox, body.dataset);
  }

  @Post("crop-save")
  async cropSave(@Body() body: any) {
    return this.service.cropSave(body.fileName, body.bbox, body.dataset, body.version);
  }
}
