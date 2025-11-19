import { Body, Controller, Get, Param, Post, Query, HttpException, HttpStatus } from "@nestjs/common";
import { ImagesService } from "./images.service";
import { R2Service } from "../r2/r2.service";

@Controller("images")
export class ImagesController {
  constructor(private readonly service: ImagesService, private readonly r2: R2Service) {}

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
  async infer(@Body() body: { fileUrl: string; dataset: string; version?: string }) {
    if (!body.fileUrl) {
      throw new HttpException("fileUrl required", HttpStatus.BAD_REQUEST);
    }
    return this.service.inferAndSave(body.fileUrl, body.dataset, body.version || "v1");
  }
    
  @Post("infer/return-only")
  async inferReturn(@Body() body: { fileUrl: string; dataset: string; version?: string }) {
    if (!body.fileUrl) {
      throw new HttpException("fileUrl required", HttpStatus.BAD_REQUEST);
    }
    return this.service.inferAndSaveReturn(body.fileUrl, body.dataset, body.version || "v1");
  }

  @Post("save")
  async save(
    @Body() body: {
      fileName: string;
      fileUrl: string;
      dataset: string;
      version?: string;
      annotations: any[];
    },
  ) {
    const version = body.version || "v1";
    return this.service.saveImageRecord(
      body.fileName,
      body.fileUrl,
      body.annotations,
      body.dataset,
      version,
    );
  }

  @Post("crop-preview")
  async cropPreview(
    @Body() body: { fileUrl: string; bbox: number[]; dataset: string }
  ) {
    if (!body.fileUrl) {
      throw new HttpException("fileUrl required", HttpStatus.BAD_REQUEST);
    }
    return this.service.cropPreview(body.fileUrl, body.bbox, body.dataset);
  }

  @Post("crop-save")
  async cropSave(
    @Body() body: { fileUrl: string; bbox: number[]; dataset: string; version?: string }
  ) {
    if (!body.fileUrl) {
      throw new HttpException("fileUrl required", HttpStatus.BAD_REQUEST);
    }
    return this.service.cropSave(body.fileUrl, body.bbox, body.dataset, body.version || "v1");
  }

  @Get("datasets")
  async listDatasets() {
    return this.service.listDatasets();
  }
}
