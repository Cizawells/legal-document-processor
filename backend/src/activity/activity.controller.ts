import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ActivityService } from './activity.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { GetActivitiesDto } from './dto/get-activities.dto';
import { FlexibleAuthGuard } from '../auth/flexible-auth.guard';

@Controller('activity')
@UseGuards(FlexibleAuthGuard)
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Post()
  create(@Body() createActivityDto: CreateActivityDto, @Request() req) {
    // Override userId with authenticated user's ID
    createActivityDto.userId = req.user.id;
    return this.activityService.create(createActivityDto);
  }

  @Get()
  findAll(@Query() query: GetActivitiesDto, @Request() req) {
    return this.activityService.findAll(req.user.id, query);
  }

  @Get('recent-documents')
  getRecentDocuments(@Query('limit') limit: string, @Request() req) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.activityService.getRecentDocuments(req.user.id, limitNum);
  }

  @Get('stats')
  getActivityStats(@Request() req) {
    return this.activityService.getActivityStats(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.activityService.findOne(id, req.user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateActivityDto: UpdateActivityDto,
    @Request() req,
  ) {
    return this.activityService.update(id, req.user.id, updateActivityDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.activityService.remove(id, req.user.id);
  }

  // Special endpoints for tracking specific activities
  @Post('track/redaction-start')
  trackRedactionStart(
    @Body() body: { fileName: string; fileId: string; fileSize: string },
    @Request() req,
  ) {
    return this.activityService.trackRedactionStart(
      req.user.id,
      body.fileName,
      body.fileId,
      body.fileSize,
    );
  }

  @Post('track/redaction-complete')
  trackRedactionComplete(
    @Body() body: { activityId: string; redactionCount: number; duration: number },
    @Request() req,
  ) {
    return this.activityService.trackRedactionComplete(
      body.activityId,
      req.user.id,
      body.redactionCount,
      body.duration,
    );
  }

  @Post('track/redaction-error')
  trackRedactionError(
    @Body() body: { activityId: string; errorMessage: string },
    @Request() req,
  ) {
    return this.activityService.trackRedactionError(
      body.activityId,
      req.user.id,
      body.errorMessage,
    );
  }

  @Post('track/download')
  trackFileDownload(
    @Body() body: { fileName: string; fileId: string; type: string },
    @Request() req,
  ) {
    return this.activityService.trackFileDownload(
      req.user.id,
      body.fileName,
      body.fileId,
      body.type,
    );
  }
}
