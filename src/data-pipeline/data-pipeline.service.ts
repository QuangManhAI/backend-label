import { Injectable, Logger } from "@nestjs/common";
import { ImagesService } from "../images/images.service";
import { R2Service } from "../r2/r2.service";

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

    for (const cls of classes) {
      const classPrefix = `${root}/${cls}`;
      const files = await this.r2.listFiles(classPrefix);

      const images = files.filter(
        (f) => f.endsWith(".jpg") || f.endsWith(".jpeg") || f.endsWith(".png"),
      );

      total += images.length;

for (const key of images) {
  const url = this.r2.publicUrl(key);

  // --- ALWAYS use key to extract fileName ---
  const fileName = key.split("/").pop();  // <--- chuẩn nhất
  if (!fileName) continue;

  try {
    const rec = await this.images.inferAndSave(url, dataset, version);

    // SAVE TEXT + JSON
    await this.images.saveAnnotation(fileName, rec.annotations, dataset, version);
    await this.images.saveAnnotationJson(fileName, rec.annotations, dataset, version);

    success++;
    this.logger.log(`✔ processed: ${fileName}`);
  } catch (err) {
    this.logger.error(`✘ failed: ${fileName} :: ${err}`);
  }
}

    }

    // ⭐⭐ Auto-generate dataset.yaml ⭐⭐
    const classList = await this.images.extractClassesFromJson(dataset, version);

    if (classList.length > 0) {
      await this.images.generateDatasetYaml(dataset, version, classList);
      this.logger.log(`📄 dataset.yaml updated for ${dataset}/${version}`);
    } else {
      this.logger.warn(`⚠ No classes found, YAML not generated.`);
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
      const r = await this.autoLabelDataset(dataset, version);
      totalFiles += r.total;
      totalSuccess += r.success;
    }

    return { totalFiles, totalSuccess, version };
  }
}
