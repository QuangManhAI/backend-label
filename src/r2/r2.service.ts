import { Injectable } from "@nestjs/common";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { ConfigService } from "@nestjs/config";
import * as fs from "fs";

@Injectable()
export class R2Service {
  private s3: S3Client;
  private bucket: string;
  private publicHost: string;

  constructor(private readonly config: ConfigService) {
    const accountId = this.config.get<string>("R2_ACCOUNT_ID")!;
    this.bucket = this.config.get<string>("R2_BUCKET")!;
    this.publicHost = this.config.get<string>("R2_PUBLIC_HOST")!;

    this.s3 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.config.get<string>("R2_ACCESS_KEY")!,
        secretAccessKey: this.config.get<string>("R2_SECRET_KEY")!,
      },
    });
  }

  publicUrl(key: string) {
    return `https://${this.publicHost}/${key}`;
  }

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

  async uploadFile(key: string, absPath: string, mime = "application/octet-stream") {
    const buf = fs.readFileSync(absPath);
    return this.uploadBuffer(key, buf, mime);
  }

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

  async listFiles(prefix: string) {
    let allKeys: string[] = [];
    let token: string | undefined = undefined;

    do {
      const res = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix.endsWith("/") ? prefix : `${prefix}/`,
          MaxKeys: 1000, 
          ContinuationToken: token,
        }),
      );

      const keys = res.Contents?.map((o) => o.Key!).filter((k) => !k.endsWith("/")) || [];
      allKeys = allKeys.concat(keys);

      token = res.NextContinuationToken;

    } while (token);

    return allKeys;
  }

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

  async readText(key: string): Promise<string> {
    const res = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );

    const body = res.Body as any;
    if (!body) return "";

    return await body.transformToString();
  }
}