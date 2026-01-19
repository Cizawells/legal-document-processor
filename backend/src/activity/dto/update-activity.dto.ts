import { PartialType } from '@nestjs/mapped-types';
import { CreateActivityDto } from './create-activity.dto';
import { IsOptional, IsString, IsNumber, IsObject } from 'class-validator';

export class UpdateActivityDto extends PartialType(CreateActivityDto) {
  @IsOptional()
  @IsString()
  status?: string;

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
