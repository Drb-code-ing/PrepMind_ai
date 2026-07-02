import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createWrongQuestionRequestSchema,
  listWrongQuestionsQuerySchema,
  updateWrongQuestionRequestSchema,
} from '@repo/types/api/wrong-question';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { WrongQuestionsService } from './wrong-questions.service';

@Controller('wrong-questions')
@UseGuards(JwtAuthGuard)
@ApiTags('Wrong Questions')
@ApiBearerAuth('access-token')
export class WrongQuestionsController {
  constructor(private readonly wrongQuestionsService: WrongQuestionsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    const input = listWrongQuestionsQuerySchema.parse(query);
    return this.wrongQuestionsService.list(user.id, input);
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.wrongQuestionsService.getById(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const input = createWrongQuestionRequestSchema.parse(body);
    return this.wrongQuestionsService.create(user.id, input);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = updateWrongQuestionRequestSchema.parse(body);
    return this.wrongQuestionsService.update(user.id, id, input);
  }

  @Delete(':id')
  delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.wrongQuestionsService.delete(user.id, id);
  }
}
