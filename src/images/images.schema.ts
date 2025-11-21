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
  @Prop({ required: true }) fileName: string;
  
  @Prop({ required: true }) imageUrl: string;     // Full URL (http://...)
  @Prop({ required: true }) storagePath: string;  // Relative Path (object_detection/...)

  @Prop({ default: false }) isEdited: boolean;
  @Prop({ required: true }) dataset: string;
  @Prop({ default: "v1" }) version: string; 
  @Prop({ type: Array, default: [] }) annotations: Annotation[];
  @Prop({ default: false }) isCrop: boolean;
}

export const ImageSchema = SchemaFactory.createForClass(Image);
ImageSchema.index({ fileName: 1, dataset: 1, version: 1 }, { unique: true });