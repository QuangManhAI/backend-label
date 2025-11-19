import { Injectable, Logger } from "@nestjs/common";
import { Client } from "minio";

@Injectable()
export class MinioService {
  private readonly logger = new Logger(MinioService.name);
  private client: Client;

  constructor() {
    this.client = new Client({
      endPoint: process.env.MINIO_ENDPOINT || "localhost",
      port: Number(process.env.MINIO_PORT) || 9000,
      useSSL: false,
      accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
      secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
    });
  }

  async bucketExists(bucket: string) {
    return this.client.bucketExists(bucket);
  }

  async createBucket(bucket: string) {
    const exists = await this.bucketExists(bucket);
    if (!exists) {
      await this.client.makeBucket(bucket, "us-east-1");
      this.logger.log(`Bucket created: ${bucket}`);
    }
  }

  async upload(bucket: string, objectName: string, filePath: string) {
    await this.createBucket(bucket);
    return this.client.fPutObject(bucket, objectName, filePath);
  }

  async uploadBuffer(bucket: string, objectName: string, buffer: Buffer, mime = "image/jpeg") {
    await this.createBucket(bucket);

    return this.client.putObject(
      bucket,
      objectName,
      buffer,
      buffer.length,             // ✔ FIX
      {
        "Content-Type": mime,    // ✔ allowed metadata
      }
    );
  }

  async getSignedUrl(bucket: string, objectName: string, expiry = 3600) {
    return this.client.presignedGetObject(bucket, objectName, expiry);
  }

  async stat(bucket: string, objectName: string) {
    return this.client.statObject(bucket, objectName);
  }

  async remove(bucket: string, objectName: string) {
    return this.client.removeObject(bucket, objectName);
  }
}
