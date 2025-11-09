import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export class Annotation {
  id: number;
  label: string;
  bbox: number[];
  confidence: number;
}

@Schema({ timestamps: true })
export class Image extends Document {
  @Prop({ required: true, unique: true }) fileName: string;
  @Prop({ required: true }) filePath: string;
  @Prop({ default: false }) isEdited: boolean;
  @Prop({ required: true }) dataset: string;
  @Prop({ default: "v1" }) version: string;
  @Prop({ type: Array, default: [] }) annotations: Annotation[];
}

export const ImageSchema = SchemaFactory.createForClass(Image);
ImageSchema.index({ fileName: 1, dataset: 1, version: 1 }, { unique: true });