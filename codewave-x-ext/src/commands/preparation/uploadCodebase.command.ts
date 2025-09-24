import * as vscode from "vscode";
import { UploadService } from "../../services/upload.service";

export const uploadCodebase = async () => {
    await UploadService.uploadCodebase();
};
