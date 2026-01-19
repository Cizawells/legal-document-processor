import { IsString, IsOptional, IsNumber, IsObject } from 'class-validator';

export class CreateActivityDto {
  @IsString()
  userId: string;

  @IsString()
  type: string; // redaction, merge, compress, convert, split, etc.

  @IsString()
  action: string; // created, completed, downloaded, failed

  @IsString()
  fileName: string;

  @IsOptional()
  @IsString()
  fileSize?: string;

  @IsOptional()
  @IsString()
  fileId?: string;

  @IsString()
  status: string; // pending, processing, completed, failed

  @IsOptional()
  @IsObject()
  metadata?: any;

  @IsOptional()
  @IsNumber()
  duration?: number;

  @IsOptional()
  @IsString()
  errorMessage?: string;
}
