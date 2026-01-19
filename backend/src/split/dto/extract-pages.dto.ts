import { IsString, IsOptional } from 'class-validator';

export class ExtractPagesRequest {
  @IsString()
  fileId: string;

  @IsString()
  extractPages: string;

  @IsOptional()
  @IsString()
  outputName?: string;
}
