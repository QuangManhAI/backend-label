import { Injectable, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ConfigService } from "@nestjs/config";
import { Model } from "mongoose";
import axios from "axios";
import sharp from "sharp";
import { Image } from "./images.schema";
import { R2Service } from "../r2/r2.service";
import * as yaml from "js-yaml";

@Injectable()
export class ImagesService {
  private readonly logger = new Logger(ImagesService.name);

  constructor(
    @InjectModel(Image.name) private readonly imageModel: Model<Image>,
    private readonly config: ConfigService,
    private readonly r2: R2Service,
  ) {}

  private async exists(fileName: string, dataset: string, version: string) {
    return this.imageModel.findOne({ fileName, dataset, version }).lean();
  }

  private format(a: any[]) {
    return a.map((x, i) => ({
      id: x.id ?? i + 1,
      label: x.label ?? "",
      bbox: Array.isArray(x.bbox) ? x.bbox.map(Number) : [],
      confidence: Number(x.confidence ?? 0),
      source: x.source ?? "model",
      suggested: !!x.suggested,
    }));
  }

  private async infer(url: string) {
    const api = this.config.get("MODEL_API_URL");
    try {
      const { data } = await axios.post(api, { image_path: url });
      console.log("MODEL RAW RESPONSE:", data);
      return data.annotations ?? [];
    } catch (err: any) {
      throw new HttpException("Inference failed: " + err.message, HttpStatus.BAD_GATEWAY);
    }
  }

  async listAll(dataset?: string, version?: string, limit = 100, skip = 0) {
    const filter: any = {};
    if (dataset) filter.dataset = dataset;
    if (version) filter.version = version;

    const imgs = await this.imageModel
      .find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return imgs.map(i => ({
      fileName: i.fileName,
      fileUrl: i.filePath,
      dataset: i.dataset,
      version: i.version,
      status: i.isEdited ? "EDITED" : "NEW",
    }));
  }

  async getByName(fileName: string, dataset: string, version = "v1") {
    const img = await this.imageModel.findOne({ fileName, dataset, version }).lean();
    if (!img) throw new HttpException("Not found", 404);
    return img;
  }

  async saveImageRecord(
    fileName: string,
    fileUrl: string,
    annotations: any[],
    dataset: string,
    version: string,
    isCrop = false,
  ) {
    const anns = this.format(annotations);
    const ex = await this.imageModel.findOne({ fileName, dataset, version });
    if (ex) {
      ex.filePath = fileUrl;
      ex.annotations = anns;
      ex.isEdited = true;
      await ex.save();
      return ex.toObject();
    }
    return this.imageModel.create({
      fileName,
      filePath: fileUrl,
      dataset,
      version,
      annotations: anns,
      isEdited: false,
      isCrop,
    });
  }

async saveAnnotation(
  fileName: string,
  annotations: any[],
  dataset: string,
  version: string,
) {
  const metaRoot = process.env.R2_DATASET_METADATA || "metadata";

  const key = `${metaRoot}/${dataset}/${version}/labels/${fileName.replace(/\.[^.]+$/, ".txt")}`;

  const lines = (annotations || []).map(a => {
    const [x1, y1, x2, y2] = a.bbox;
    const conf = Number.isFinite(a.confidence) ? a.confidence : 0;
    return `${a.label} ${x1.toFixed(6)} ${y1.toFixed(6)} ${x2.toFixed(6)} ${y2.toFixed(6)} ${conf.toFixed(4)}`;
  }).join("\n");

  await this.r2.uploadText(key, lines);

  return { key, url: this.r2.publicUrl(key) };
}


async saveAnnotationJson(
  fileName: string,
  annotations: any[],
  dataset: string,
  version: string,
) {
  const metaRoot = process.env.R2_DATASET_METADATA || "metadata";

  const key = `${metaRoot}/${dataset}/${version}/instances.json`;

  let coco;
  try {
    const existing = await this.r2.readText(key);
    coco = JSON.parse(existing);
  } catch {
    coco = { info: {}, licenses: [], images: [], annotations: [], categories: [] };
  }

  const existingCats = new Set(coco.categories.map((c: any) => c.name));
  for (const ann of annotations) {
    if (ann.label && !existingCats.has(ann.label)) {
      existingCats.add(ann.label);
      coco.categories.push({ id: ann.label, name: ann.label });
    }
  }

  const imgId = coco.images.length + 1;
  coco.images.push({
    id: imgId,
    file_name: fileName,
    width: 640,
    height: 640,
  });

  for (const ann of annotations) {
    const [x1, y1, x2, y2] = ann.bbox.map(Number);
    const w = x2 - x1;
    const h = y2 - y1;

    coco.annotations.push({
      id: coco.annotations.length + 1,
      image_id: imgId,
      label: ann.label,
      bbox: [x1, y1, w, h],
      area: w * h,
      iscrowd: 0,
      score: ann.confidence ?? 0,
    });
  }

  await this.r2.uploadText(key, JSON.stringify(coco, null, 2));

  return { key, url: this.r2.publicUrl(key) };
}


async inferAndSave(fileUrl: string, dataset: string, version = "v1") {
  const fileName = fileUrl.split("/").pop();
  if (!fileName) throw new HttpException("Invalid URL", 400);

  const existed = await this.exists(fileName, dataset, version);
  if (existed) return existed;

  const raw = await this.infer(fileUrl);
  const anns = this.format(raw);

  await this.saveImageRecord(fileName, fileUrl, anns, dataset, version);

  return { fileName, dataset, version, annotations: anns, fileUrl };
}


async inferAndSaveReturn(fileUrl: string, dataset: string, version = "v1") {
  const fileName = fileUrl.split("/").pop();
  if (!fileName) throw new HttpException("Invalid URL", 400);

  const raw = await this.infer(fileUrl);
  const anns = this.format(raw);

  await this.saveImageRecord(fileName, fileUrl, anns, dataset, version);

  return { fileName, dataset, version, annotations: anns, fileUrl };
}


  async cropPreview(fileUrl: string, bbox: number[], dataset: string) {
    const { data: buffer } = await axios.get(fileUrl, { responseType: "arraybuffer" });

    const m = await sharp(buffer).metadata();
    const W = m.width ?? 640;
    const H = m.height ?? 640;

    let [x1, y1, x2, y2] = bbox.map(Number);
    if (x2 <= 1 && y2 <= 1) {
      x1 *= W;
      y1 *= H;
      x2 *= W;
      y2 *= H;
    }

    const w = Math.max(1, Math.round(x2 - x1));
    const h = Math.max(1, Math.round(y2 - y1));

    const crop = await sharp(buffer)
      .extract({ left: Math.round(x1), top: Math.round(y1), width: w, height: h })
      .toBuffer();

    const key = `${dataset}/crops/${Date.now()}_${Math.random()}.jpg`;
    const cropUrl = await this.r2.uploadBuffer(key, crop);

    const anns = await this.infer(cropUrl);

    return {
      cropUrl,
      annotations: this.format(anns),
    };
  }

  async cropSave(fileUrl: string, bbox: number[], dataset: string, version = "v1") {
    const preview = await this.cropPreview(fileUrl, bbox, dataset);

    const cropName = preview.cropUrl.split("/").pop();
    if (!cropName) throw new HttpException("Invalid crop URL", 400);

    const existed = await this.exists(cropName, dataset, version);
    if (existed) return existed;

    await this.saveImageRecord(
      cropName,
      preview.cropUrl,
      preview.annotations,
      dataset,
      version,
      true,
    );

    return preview;
  }

  async listDatasets() {
    const ds = await this.imageModel.distinct("dataset");
    return ds;
  }

  async extractClassesFromJson(dataset: string, version: string) {
    const metaRoot = process.env.R2_DATASET_METADATA || "metadata";
    const key = `${metaRoot}/${dataset}/${version}/instances.json`;

    try {
      const txt = await this.r2.readText(key);
      const coco = JSON.parse(txt);

      const classList = coco.categories.map((c: any) => c.name);
      return classList;
    } catch (err) {
      return []; // chưa có JSON → không lỗi
    }
  }

  async generateDatasetYaml(
    dataset: string,
    version: string,
    classList: string[],
  ) {
    const metaRoot = process.env.R2_DATASET_METADATA || "metadata";
    const key = `${metaRoot}/${dataset}/${version}/dataset.yaml`;

    let oldCfg: any = {};
    try {
      oldCfg = yaml.load(await this.r2.readText(key)) || {};
    } catch {}

    const yamlObj = {
      train: oldCfg.train || `./images/${dataset}/train`,
      val: oldCfg.val || `./images/${dataset}/val`,
      nc: classList.length,
      names: classList,
    };

    await this.r2.uploadText(key, yaml.dump(yamlObj));

    return { key, url: this.r2.publicUrl(key) };
  }
}
