import { Controller, Delete } from "@nestjs/common";
import { ResetService } from "./reset.service";

@Controller("tools")
export class ResetController {
  constructor(private readonly service: ResetService) {}

  @Delete("clear-db")
  clearDb() {
    return this.service.clearDatabase();
  }

  @Delete("clear-uploads")
  clearUploads() {
    return this.service.clearUploads();
  }

  @Delete("reset")
  resetAll() {
    return this.service.resetAll();
  }
}
