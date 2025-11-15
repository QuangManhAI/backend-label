import { Injectable, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ConfigService } from "@nestjs/config";
import { Model } from "mongoose";
import * as path from "path";
import * as fs from "fs";
import axios from "axios";
import sharp from "sharp";
import { Image } from "./images.schema";
import glob from "glob";

@Injectable()
export class ImagesService {
  private readonly logger = new Logger(ImagesService.name);

  constructor(
    @InjectModel(Image.name) private readonly imageModel: Model<Image>,
    private readonly config: ConfigService,
  ) {}

  private toPublicPath(absPath: string) {
    const uploadsRoot = "/home/quangmanh/Documents/pineline/back-end-label/uploads";
    let rel = path.relative(uploadsRoot, absPath);
    rel = rel.split(path.sep).join("/");
    return `/uploads/${rel}`;
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
    // const labelDir = path.join(process.cwd(), "uploads", "labels", dataset, version);
    // fs.mkdirSync(labelDir, { recursive: true });
    // const labelPath = path.join(labelDir, fileName.replace(/\.[^.]+$/, ".txt"));

    // const lines = (annotations || []).map(a => {
    //   const [x1, y1, x2, y2] = a.bbox;
    //   const conf = Number.isFinite(a.confidence) ? a.confidence : 0;
    //   return `${a.label} ${x1.toFixed(6)} ${y1.toFixed(6)} ${x2.toFixed(6)} ${y2.toFixed(6)} ${conf.toFixed(4)}`;
    // });

    // fs.writeFileSync(labelPath, lines.join("\n"), "utf8");
  }

  async saveImageRecord(
    fileName: string,
    filePath: string,
    annotations: any[],
    dataset: string,
    version: string,
    isCrop = false,
  ) {
    if (!filePath || !filePath.startsWith("/uploads/")) {
      const uploadsRoot = "/home/quangmanh/Documents/pineline/back-end-label/uploads";
      const imagesRoot = path.join(uploadsRoot, "images", dataset);
      const matches = glob.sync(`${imagesRoot}/**/${fileName}`);
      if (matches.length > 0) {
        const absPath = matches[0];
        const rel = path.relative(uploadsRoot, absPath).split(path.sep).join("/");
        filePath = `/uploads/${rel}`;
      } else {
        filePath = `/uploads/images/${dataset}/${fileName}`;
      }
    }

    const normalizedAnns = (annotations || []).map((a, idx) => ({
      id: a.id ?? idx + 1,
      label: a.label ?? "",
      bbox: Array.isArray(a.bbox) ? a.bbox.map(Number) : [],
      confidence: Number.isFinite(a.confidence) ? a.confidence : 0,
      source: a.source ?? "unknown",
      suggested: !!a.suggested,
    }));

    const existing = await this.imageModel.findOne({ fileName, dataset, version });
    if (existing) {
      existing.filePath = filePath;
      existing.annotations = normalizedAnns;
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
      isCrop,
      annotations: normalizedAnns,
    });
  }

  async inferAndSave(absPath: string, dataset: string, version = "v1") {
    let annotations = await this.inferOne(absPath);

    // ❗ Không lọc top-1 nữa — giữ nguyên toàn bộ detections
    const modelAnns = (annotations || []).map((a: any, i: number) => ({
      id: i + 1,
      label: a.label ?? "",
      bbox: a.bbox,
      confidence: Number(a.confidence ?? 0),
      source: "model",
      suggested: false,
    }));

    const fileName = path.basename(absPath);
    const publicPath = this.toPublicPath(absPath);

    await this.saveAnnotation(fileName, modelAnns, dataset, version);
    await this.saveAnnotationJson(fileName, modelAnns, dataset, version);
    await this.saveImageRecord(fileName, publicPath, modelAnns, dataset, version);

    return { fileName, dataset, version, annotations: modelAnns };
  }

  async listAll(dataset?: string, version?: string, limit = 300, skip = 0) {
    const filter: any = {};
    if (dataset) filter.dataset = dataset;
    if (version) filter.version = version;

    const imgs = await this.imageModel
      .find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return imgs.map((i) => ({
      fileName: i.fileName,
      filePath: i.filePath?.startsWith("/uploads/")
        ? i.filePath
        : `/uploads/images/${i.dataset}/${i.fileName}`,
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

  async saveAnnotationJson(
    fileName: string,
    annotations: any[],
    dataset: string,
    version: string,
  ) {
    // const cocoDir = path.join(process.cwd(), "uploads", "datasets", dataset, version);
    // fs.mkdirSync(cocoDir, { recursive: true });
    // const jsonPath = path.join(cocoDir, "instances.json");
    // let coco: any;

    // if (fs.existsSync(jsonPath)) {
    //   coco = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    // } else {
    //   coco = { info: {}, licenses: [], images: [], annotations: [], categories: [] };
    // }

    // const existingCats = new Set(coco.categories.map((c: any) => c.name));
    // for (const ann of annotations) {
    //   if (ann.label && !existingCats.has(ann.label)) {
    //     existingCats.add(ann.label);
    //     coco.categories.push({ id: ann.label, name: ann.label });
    //   }
    // }

    // const imgId = coco.images.length + 1;
    // coco.images.push({
    //   id: imgId,
    //   file_name: fileName,
    //   width: 640,
    //   height: 640,
    // });

    // for (const ann of annotations) {
    //   const [x1, y1, x2, y2] = ann.bbox.map(Number);
    //   const w = Math.max(0, x2 - x1);
    //   const h = Math.max(0, y2 - y1);
    //   coco.annotations.push({
    //     id: coco.annotations.length + 1,
    //     image_id: imgId,
    //     label: ann.label,
    //     bbox: [x1, y1, w, h],
    //     area: w * h,
    //     iscrowd: 0,
    //     score: ann.confidence ?? 0,
    //   });
    // }

    // fs.writeFileSync(jsonPath, JSON.stringify(coco, null, 2), "utf8");
  }

  async cropPreview(fileName: string, bbox: number[], dataset: string) {
    const baseDir = path.join(process.cwd(), "uploads", "images", dataset);
    let absPath = path.join(baseDir, fileName);

    if (!fs.existsSync(absPath)) {
      const subs = fs.readdirSync(baseDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

      for (const sub of subs) {
        const candidate = path.join(baseDir, sub, fileName);
        if (fs.existsSync(candidate)) {
          absPath = candidate;
          break;
        }
      }
    }

    if (!fs.existsSync(absPath))
      throw new HttpException(`Input file is missing: ${absPath}`, HttpStatus.NOT_FOUND);

    const meta = await sharp(absPath).metadata();
    const imgW = meta.width ?? 640;
    const imgH = meta.height ?? 640;

    let [x1, y1, x2, y2] = bbox.map(Number);

    // scale normalized to absolute if needed
    if (x2 <= 1 && y2 <= 1) {
      x1 *= imgW; y1 *= imgH; x2 *= imgW; y2 *= imgH;
    }

    x1 = Math.max(0, Math.min(imgW - 1, Math.round(x1)));
    y1 = Math.max(0, Math.min(imgH - 1, Math.round(y1)));
    x2 = Math.max(x1 + 1, Math.min(imgW, Math.round(x2)));
    y2 = Math.max(y1 + 1, Math.min(imgH, Math.round(y2)));

    const w = Math.max(1, x2 - x1);
    const h = Math.max(1, y2 - y1);

    const cropDir = path.join(baseDir, "crops");
    fs.mkdirSync(cropDir, { recursive: true });
    const tmpCrop = path.join(cropDir, `${path.parse(fileName).name}_preview_${Date.now()}.jpg`);

    await sharp(absPath).extract({ left: x1, top: y1, width: w, height: h }).toFile(tmpCrop);

    // YOLO detect on crop (MULTI-OBJECT)
    let anns = await this.inferOne(tmpCrop);

    const normalized = (v: number) => v <= 1 && v >= 0;

    const toAbsInOriginal = (bb: number[]) => {
      let [cx1, cy1, cx2, cy2] = bb.map(Number);

      const isNorm = normalized(cx2) && normalized(cy2);
      if (isNorm) {
        cx1 *= w; cy1 *= h; cx2 *= w; cy2 *= h;
      }

      cx1 = Math.round(cx1) + x1;
      cy1 = Math.round(cy1) + y1;
      cx2 = Math.round(cx2) + x1;
      cy2 = Math.round(cy2) + y1;

      cx1 = Math.max(0, Math.min(imgW - 1, cx1));
      cy1 = Math.max(0, Math.min(imgH - 1, cy1));
      cx2 = Math.max(cx1 + 1, Math.min(imgW, cx2));
      cy2 = Math.max(cy1 + 1, Math.min(imgH, cy2));

      return [cx1, cy1, cx2, cy2];
    };

    const annotations = (anns || []).map((a: any) => ({
      label: a.label ?? "",
      bbox: toAbsInOriginal(a.bbox || []),
      confidence: Number(a.confidence ?? 0),
      source: "model",
      suggested: true,
    }));

    return { annotations, cropPath: tmpCrop };
  }

  async cropSave(fileName: string, bbox: number[], dataset: string, version: string) {
    const baseDir = "/home/quangmanh/Documents/pineline/back-end-label/uploads";
    const uploadDir = path.join(baseDir, "images", dataset);
    const cropDir = path.join(uploadDir, "crops");
    fs.mkdirSync(cropDir, { recursive: true });

    let absPath = path.join(uploadDir, fileName);

    if (!fs.existsSync(absPath)) {
      const subs = fs.readdirSync(uploadDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

      for (const sub of subs) {
        const candidate = path.join(uploadDir, sub, fileName);
        if (fs.existsSync(candidate)) {
          absPath = candidate;
          break;
        }
      }
    }

    if (!fs.existsSync(absPath))
      throw new Error(`Original image not found: ${absPath}`);

    const [x1, y1, x2, y2] = bbox.map(Math.round);
    const width = Math.max(1, x2 - x1);
    const height = Math.max(1, y2 - y1);
    const cropName = `${path.parse(fileName).name}_crop_${Date.now()}.jpg`;
    const cropPath = path.join(cropDir, cropName);

    try {
      await sharp(absPath)
        .extract({ left: x1, top: y1, width, height })
        .toFile(cropPath);
    } catch (err) {
      this.logger.error("Sharp extract failed", err);
      throw new Error(`Sharp crop failed: ${err.message}`);
    }

    return {
      message: "Crop saved",
      cropPath: `/uploads/images/${dataset}/crops/${cropName}`,
    };
  }
}
