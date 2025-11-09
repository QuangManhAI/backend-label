import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as fs from "fs";
import * as path from "path";
import { Image } from "../images/images.schema";

@Injectable()
export class ResetService {
  constructor(@InjectModel(Image.name) private readonly imageModel: Model<Image>) {}

  async clearDatabase() {
    await this.imageModel.deleteMany({});
    return { message: "All image records deleted" };
  }

  async clearUploads() {
    const base = path.join(process.cwd(), "uploads");
    if (fs.existsSync(base)) fs.rmSync(base, { recursive: true, force: true });

    fs.mkdirSync(path.join(base, "images"), { recursive: true });
    fs.mkdirSync(path.join(base, "labels"), { recursive: true });
    fs.mkdirSync(path.join(base, "datasets"), { recursive: true });
    fs.mkdirSync(path.join(base, "crops"), { recursive: true });

    return { message: "Uploads cleared" };
  }

  async resetAll() {
    await this.clearUploads();
    await this.clearDatabase();
    return { ok: true, message: "System reset completed" };
  }
}
