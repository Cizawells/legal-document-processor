import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class SplitByBookmarkRequest {
  @IsString()
  fileId: string;

  @IsBoolean()
  splitByBookmark: boolean;

  @IsOptional()
  @IsString()
  outputName?: string;
}
