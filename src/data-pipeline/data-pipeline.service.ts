import { Injectable, Logger } from "@nestjs/common";
import { ImagesService } from "../images/images.service";
import * as path from "path";
import * as fs from "fs";
import * as yaml from "js-yaml";

@Injectable()
export class DataPipelineService {
  private readonly logger = new Logger(DataPipelineService.name);
  constructor(private readonly imagesService: ImagesService) {}
  
  async autoLabelDataset(dataset: string, version = "v1") {
    const rootDir = process.env.DATA_ROOT || path.join(process.cwd(), "..");
    const datasetPath = path.join(rootDir, "object_detection", dataset);
    if (!fs.existsSync(datasetPath)) throw new Error(`Dataset not found: ${dataset}`);
    const subClasses = fs
      .readdirSync(datasetPath)
      .filter(f => fs.statSync(path.join(datasetPath, f)).isDirectory());
    let total = 0; 
    let success = 0;
    const classList: string[] = [];
    for (const sub of subClasses) {
      classList.push(sub);
      const folder = path.join(datasetPath, sub);
      const images = fs.readdirSync(folder).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
      total += images.length;
      for (const img of images) {
        const absPath = path.join(folder, img);
        const uploadTarget = path.join(process.cwd(), "uploads", "images", dataset, sub);
        fs.mkdirSync(uploadTarget, { recursive: true });
        const dest = path.join(uploadTarget, img);
        if (!fs.existsSync(dest)) fs.copyFileSync(absPath, dest);
        try {
          await this.imagesService.inferAndSave(dest, dataset, version);
          success++;
          this.logger.log(`✓ ${dataset}/${sub}/${img}`);
        } catch (err: any) {
          this.logger.warn(`✗ ${img} (${sub}): ${err.message}`);
        }
      }
    }
    this.generateDatasetYaml(dataset, classList, version);
    return { dataset, version, total, success };
  }

  async autoLabelAll(version = "v1") {
    const root = path.join(process.cwd(), "object_detection");
    if (!fs.existsSync(root)) throw new Error("object_detection folder not found");
    const datasets = fs
      .readdirSync(root)
      .filter(f => fs.statSync(path.join(root, f)).isDirectory() && f.startsWith("classes-"));
    let totalFiles = 0;
    let totalSuccess = 0;
    for (const dataset of datasets) {
      const result = await this.autoLabelDataset(dataset, version);
      totalFiles += result.total;
      totalSuccess += result.success;
    }
    return { totalFiles, totalSuccess, version };
  }

  generateDatasetYaml(dataset: string, classList: string[], version = "v1") {
    const yamlObj = {
      train: `./images/${dataset}/train`,
      val: `./images/${dataset}/val`,
      nc: classList.length,
      names: classList,
    };
    const outDir = path.join(process.cwd(), "uploads", "datasets", dataset, version);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "dataset.yaml"), yaml.dump(yamlObj), "utf8");
  }
}
