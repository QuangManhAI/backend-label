import { Body, Controller, Get, Param, Post, Query, HttpException, HttpStatus } from "@nestjs/common";
import { ImagesService } from "./images.service";
import { R2Service } from "../r2/r2.service";

@Controller("images")
export class ImagesController {
  constructor(private readonly service: ImagesService, private readonly r2: R2Service) {}

  // Hàm phụ: Tách lấy storagePath từ Full URL (Logic giống bên Service)
  private getStoragePath(url: string): string {
    if (!url) return "";
    if (url.includes("object_detection")) {
      return "object_detection" + url.split("object_detection")[1];
    }
    return url.split("/").pop() || url;
  }

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

  // --- SỬA: Tính toán storagePath trước khi gọi Service ---
  @Post("infer")
  async infer(@Body() body: { fileUrl: string; dataset: string; version?: string }) {
    if (!body.fileUrl) {
      throw new HttpException("fileUrl required", HttpStatus.BAD_REQUEST);
    }
    
    // Tự động lấy storagePath từ fileUrl
    const storagePath = this.getStoragePath(body.fileUrl);

    return this.service.inferAndSave(
      body.fileUrl, 
      storagePath, // Truyền thêm tham số này
      body.dataset, 
      body.version || "v1"
    );
  }
    
  @Post("infer/return-only")
  async inferReturn(@Body() body: { fileUrl: string; dataset: string; version?: string }) {
    if (!body.fileUrl) {
      throw new HttpException("fileUrl required", HttpStatus.BAD_REQUEST);
    }
    // Hàm này bên Service đã tự tính storagePath nên không cần truyền
    return this.service.inferAndSaveReturn(body.fileUrl, body.dataset, body.version || "v1");
  }

  // --- SỬA: Nhận body và truyền đủ 3 tham số đường dẫn ---
  @Post("save")
  async save(
    @Body() body: {
      fileName: string;
      fileUrl: string;      // Frontend gửi Full URL
      storagePath?: string; // Frontend có thể gửi hoặc không
      dataset: string;
      version?: string;
      annotations: any[];
    },
  ) {
    const version = body.version || "v1";

    // Ưu tiên lấy storagePath frontend gửi, nếu không thì tự tính từ fileUrl
    const finalStoragePath = body.storagePath || this.getStoragePath(body.fileUrl);

    return this.service.saveImageRecord(
      body.fileName,
      body.fileUrl,      // imageUrl
      finalStoragePath,  // storagePath (Mới thêm)
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

  // Endpoint Export JSON (Dùng lại hàm Service đã sửa)
  @Post("export-json")
  async exportJson(@Body() body: { dataset: string; version?: string }) {
      const version = body.version || "v1";
      
      // Lấy tất cả ảnh để tạo lại file JSON
      const allImages = await this.service.imageModel.find({ 
        dataset: body.dataset, 
        version: version 
      });

      console.log(`Exporting ${allImages.length} images for ${body.dataset}...`);

      for (const img of allImages) {
          // img.storagePath lúc này đã chứa đường dẫn tương đối chuẩn (object_detection/...)
          await this.service.saveAnnotationJson(
            img.storagePath, 
            img.annotations, 
            body.dataset, 
            version
          );
      }

      return { 
        message: "Export JSON success", 
        total: allImages.length,
        path: `metadata/${body.dataset}/${version}/instances.json`
      };
  }
}