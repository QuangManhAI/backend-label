import { Injectable, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ConfigService } from "@nestjs/config";
import { Model } from "mongoose";
import * as path from "path";
import * as fs from "fs";
import axios from "axios";
import sharp from "sharp";
import { Image } from "./images.schema";

@Injectable()
export class ImagesService {
  private readonly logger = new Logger(ImagesService.name);

  constructor(
    @InjectModel(Image.name) private readonly imageModel: Model<Image>,
    private readonly config: ConfigService,
  ) {}

  private toPublicPath(absPath: string) {
    const base = this.config.get("PUBLIC_PREFIX") || "/uploads/images/";
    const fileName = path.basename(absPath);
    return path.posix.join(base, fileName).replace(/\\/g, "/");
  }

  async inferOne(absPath: string) {
    const modelApi = this.config.get("MODEL_API_URL");
    try {
      const { data } = await axios.post(modelApi, { image_path: absPath });
      return data.annotations ?? [];
    } catch (e: any) {
      throw new HttpException("Inference failed: " + e.message, HttpStatus.BAD_GATEWAY);
    }
  }

async saveAnnotation(fileName: string, annotations: any[], dataset: string, version: string) {
  const labelDir = path.join(process.cwd(), "uploads", "labels", dataset, version);
  fs.mkdirSync(labelDir, { recursive: true });
  const labelPath = path.join(labelDir, fileName.replace(/\.[^.]+$/, ".txt"));

  const lines = annotations.map(a => {
    const [x1, y1, x2, y2] = a.bbox;
    return `${a.label} ${x1.toFixed(6)} ${y1.toFixed(6)} ${x2.toFixed(6)} ${y2.toFixed(6)} ${a.confidence.toFixed(4)}`;
  });

  fs.writeFileSync(labelPath, lines.join("\n"), "utf8");
}


  async saveImageRecord(
    fileName: string,
    filePath: string,
    annotations: any[],
    dataset: string,
    version: string,
  ) {
    const existing = await this.imageModel.findOne({ fileName, dataset, version });
    if (existing) {
      existing.annotations = annotations;
      existing.isEdited = true;
      await existing.save();
      return existing.toObject();
    }
    return await this.imageModel.create({
      fileName,
      filePath,
      dataset,
      version,
      isEdited: false,
      annotations,
    });
  }

  async inferAndSave(absPath: string, dataset: string, version = "v1") {
    const annotations = await this.inferOne(absPath);
    const fileName = path.basename(absPath);
    const publicPath = this.toPublicPath(absPath);
    await this.saveAnnotation(fileName, annotations, dataset, version);
    await this.saveImageRecord(fileName, publicPath, annotations, dataset, version);
    return { fileName, dataset, version, annotations };
  }

  async listAll(dataset?: string, version?: string) {
    const filter: any = {};
    if (dataset) filter.dataset = dataset;
    if (version) filter.version = version;
    const imgs = await this.imageModel.find(filter).sort({ updatedAt: -1 }).lean();
    return imgs.map(i => ({
      fileName: i.fileName,
      filePath: i.filePath,
      dataset: i.dataset,
      version: i.version,
      status: i.isEdited ? "EDITED" : "NEW",
    }));
  }

  async getByName(fileName: string, dataset: string, version = "v1") {
    const img = await this.imageModel.findOne({ fileName, dataset, version }).lean();
    if (!img) throw new HttpException("Not found", HttpStatus.NOT_FOUND);
    return img;
  }

  async cropAndInfer(fileName: string, bbox: number[], dataset: string, version = "v1") {
    const uploadDir = path.join(process.cwd(), "uploads", "images", dataset);
    const absPath = path.join(uploadDir, fileName);
    const [x1, y1, x2, y2] = bbox.map(Math.round);
    const w = x2 - x1;
    const h = y2 - y1;
    const cropDir = path.join(process.cwd(), "uploads", "crops", dataset);
    fs.mkdirSync(cropDir, { recursive: true });
    const cropName = `${path.parse(fileName).name}_crop_${Date.now()}.jpg`;
    const cropPath = path.join(cropDir, cropName);
    await sharp(absPath).extract({ left: x1, top: y1, width: w, height: h }).toFile(cropPath);
    const annotations = await this.inferOne(cropPath);
    return { fileName, dataset, version, bbox, annotations };
  }
}
