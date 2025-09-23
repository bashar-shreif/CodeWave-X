import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs/promises';

@Injectable()
export class JsonFileService {
  async readJson<T = any>(filePath: string): Promise<T> {
    const buf = await fs.readFile(filePath);
    return JSON.parse(buf.toString('utf8')) as T;
  }
}
