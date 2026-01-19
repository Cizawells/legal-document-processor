import { IsString, IsOptional } from 'class-validator';

export class SplitByRangeRequest {
  @IsString()
  fileId: string;

  @IsString()
  splitByRange: string;

  @IsOptional()
  @IsString()
  outputName?: string;
}
