// src/data-pipeline/data-pipeline.service.ts

import { Injectable, Logger } from "@nestjs/common";
import { ImagesService } from "../images/images.service";
import { R2Service } from "../r2/r2.service";
import { MinioService } from "src/minio/minio.service";
import pLimit from "p-limit"; // <--- THÊM DÒNG NÀY

@Injectable()
export class DataPipelineService {
  private readonly logger = new Logger(DataPipelineService.name);

  constructor(
    private readonly images: ImagesService,
    private readonly r2: R2Service,
  ) {}

  private prefix(dataset: string) {
    return `object_detection/${dataset}`;
  }

  async autoLabelDataset(dataset: string, version = "v1") {
    const root = this.prefix(dataset);

    const classes = await this.r2.listFolders(root);
    if (classes.length === 0) throw new Error(`Dataset not found: ${dataset}`);

    let total = 0;
    let success = 0;

    // Khởi tạo bộ giới hạn đồng thời: Tùy chỉnh giới hạn này (ví dụ: 10-20)
    const MAX_CONCURRENT = 15; 
    const limit = pLimit(MAX_CONCURRENT);

    const allImageKeys: string[] = [];

    // 1. Gộp tất cả keys từ các thư mục con
    for (const cls of classes) {
      const classPrefix = `${root}/${cls}`;
      const files = await this.r2.listFiles(classPrefix);

      const images = files.filter(
        (f) => f.endsWith(".jpg") || f.endsWith(".jpeg") || f.endsWith(".png"),
      );
      allImageKeys.push(...images);
    }
    
    total = allImageKeys.length;
    this.logger.log(`Starting to process ${total} images with concurrency limit: ${MAX_CONCURRENT}`);


    // 2. Chuyển Vòng Lặp Tuần tự sang Song song có Giới hạn
    const processingPromises = allImageKeys.map(key => limit(async () => {
      const url = this.r2.publicUrl(key); // Đây là Full URL
      const fileName = key.split("/").pop();
      if (!fileName) return false;

      try {
        // Infer và lưu vào MongoDB (AN TOÀN)
        const rec = await this.images.inferAndSave(
          url,
          key,
          dataset, 
          version
        );

        // Save text annotation (.txt files) (AN TOÀN, vì mỗi ảnh là 1 file)
        await this.images.saveAnnotation(fileName, rec.annotations, dataset, version);
        
        // ❌ LOẠI BỎ saveAnnotationJson để tránh Race Condition

        this.logger.log(`✔ processed: ${fileName}`);
        return true;
      } catch (err: any) {
        this.logger.error(`✘ failed: ${fileName} :: ${err.message || err}`);
        return false;
      }
    }));

    // Chờ tất cả các tác vụ hoàn thành
    const results = await Promise.all(processingPromises);
    success = results.filter(r => r === true).length;


    // 3. THỰC HIỆN EXPORT JSON TẬP TRUNG sau khi pipeline hoàn tất
    if (success > 0) {
        this.logger.log('Starting final JSON (instances.json) export from MongoDB...');
        const exportResult = await this.images.exportJsonFromMongo(dataset, version);
        this.logger.log(`JSON export complete: ${exportResult.totalImages} records saved to R2.`);
    }

    const classList = await this.images.extractClassesFromJson(dataset, version);

    if (classList.length > 0) {
      await this.images.generateDatasetYaml(dataset, version, classList);
      this.logger.log(`dataset.yaml updated for ${dataset}/${version}`);
    } else {
      this.logger.warn(`No classes found, YAML not generated.`);
    }

    return { dataset, version, total, success };
  }

  async autoLabelAll(version = "v1") {
    const root = "object_detection";

    const datasets = await this.r2.listFolders(root);
    const filtered = datasets.filter((d) => d.startsWith("classes-"));

    let totalFiles = 0;
    let totalSuccess = 0;

    for (const dataset of filtered) {
      // Lưu ý: Vòng lặp này vẫn chạy tuần tự theo dataset, điều này là tốt để tránh xung đột lớn
      const r = await this.autoLabelDataset(dataset, version);
      totalFiles += r.total;
      totalSuccess += r.success;
    }

    return { totalFiles, totalSuccess, version };
  }
}