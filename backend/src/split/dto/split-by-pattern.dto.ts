import { IsString, IsOptional, IsArray } from 'class-validator';

export class SplitByPatternRequest {
  @IsString()
  fileId: string;

  @IsString()
  splitByPattern: string;

  @IsOptional()
  @IsString()
  outputName?: string;

  options: {
    pages: [];
  };
}
