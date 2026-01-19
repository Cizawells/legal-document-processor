import { IsString, IsOptional } from 'class-validator';

export class SplitByTextPatternRequest {
  @IsString()
  fileId: string;

  @IsString()
  splitByTextPattern: string;

  @IsOptional()
  @IsString()
  outputName?: string;
}
