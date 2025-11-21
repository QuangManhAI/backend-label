import { Injectable, Logger } from "@nestjs/common";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { ConfigService } from "@nestjs/config";
import * as fs from "fs";

@Injectable()
export class MinioService {
  private readonly logger = new Logger(MinioService.name);
  private s3: S3Client;
  private bucket: string;
  private endpoint: string;

  constructor(private readonly config: ConfigService) {
    // Lấy cấu hình từ .env
    this.bucket = this.config.get<string>("MINIO_BUCKET")!;
    this.endpoint = this.config.get<string>("MINIO_ENDPOINT") || "http://localhost:9000";
    
    const accessKey = this.config.get<string>("MINIO_ACCESS_KEY")!;
    const secretKey = this.config.get<string>("MINIO_SECRET_KEY")!;

    // Khởi tạo S3 Client cho MinIO
    this.s3 = new S3Client({
      region: "us-east-1", // MinIO mặc định dùng region này
      endpoint: this.endpoint, // Trỏ về MinIO Server (VD: localhost:9000)
      forcePathStyle: true, // 🔥 BẮT BUỘC: Để URL có dạng domain/bucket/key thay vì bucket.domain/key
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
    });
    
    this.logger.log(`MinioService initialized connected to ${this.endpoint} bucket: ${this.bucket}`);
  }

  /** * Public URL 
   * Logic: Endpoint + Bucket + Key (Vì MinIO Local dùng Path Style)
   */
  publicUrl(key: string) {
    // Loại bỏ dấu gạch chéo cuối endpoint nếu có để tránh bị trùng //
    const cleanEndpoint = this.endpoint.replace(/\/$/, "");
    return `${cleanEndpoint}/${this.bucket}/${key}`;
  }

  /** Upload buffer - GIỮ NGUYÊN */
  async uploadBuffer(key: string, buffer: Buffer, mime = "application/octet-stream") {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mime,
      }),
    );
    return this.publicUrl(key);
  }

  /** Upload local file - GIỮ NGUYÊN */
  async uploadFile(key: string, absPath: string, mime = "application/octet-stream") {
    const buf = fs.readFileSync(absPath);
    return this.uploadBuffer(key, buf, mime);
  }

  /** List subfolders - GIỮ NGUYÊN */
  async listFolders(prefix: string) {
    const res = await this.s3.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix.endsWith("/") ? prefix : `${prefix}/`,
        Delimiter: "/",
      }),
    );

    return (
      res.CommonPrefixes?.map((p) =>
        p.Prefix!.replace(prefix + "/", "").replace("/", ""),
      ) || []
    );
  }

  /** List files - GIỮ NGUYÊN */
  async listFiles(prefix: string) {
    const res = await this.s3.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix.endsWith("/") ? prefix : `${prefix}/`,
      }),
    );

    return res.Contents?.map((o) => o.Key!).filter((k) => !k.endsWith("/")) || [];
  }

  /** Upload Text - GIỮ NGUYÊN */
  async uploadText(key: string, content: string) {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: content,
        ContentType: "text/plain",
      })
    );
    return this.publicUrl(key);
  }

  /** Read Text - GIỮ NGUYÊN */
  async readText(key: string): Promise<string> {
    try {
      const res = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );

      const body = res.Body as any;
      if (!body) return "";

      return await body.transformToString();
    } catch (error: any) {
      // Xử lý nhẹ nếu không tìm thấy file để tránh crash app
      if (error.name === 'NoSuchKey') {
        this.logger.warn(`File not found: ${key}`);
        throw new Error(`File not found: ${key}`);
      }
      throw error;
    }
  }
}