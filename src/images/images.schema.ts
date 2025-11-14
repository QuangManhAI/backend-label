import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export class Annotation {
  id: number;
  label: string;
  bbox: number[];
  confidence: number;
  source?: "human" | "model" | "unknown";
  suggested?: boolean;
}

@Schema({ timestamps: true })
export class Image extends Document {
  @Prop({ required: true }) fileName: string; // quan trong
  @Prop({ required: true }) filePath: string; // quan trong
  @Prop({ default: false }) isEdited: boolean; // quan trong
  @Prop({ required: true }) dataset: string; // quan trong
  @Prop({ default: "v1" }) version: string; 
  @Prop({ type: Array, default: [] }) annotations: Annotation[]; // quan trong
  @Prop({ default: false }) isCrop: boolean;
}

export const ImageSchema = SchemaFactory.createForClass(Image);
ImageSchema.index({ fileName: 1, dataset: 1, version: 1 }, { unique: true });
