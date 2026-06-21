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
import {
  moveWrongQuestionToDeckRequestSchema,
  organizeWrongQuestionBatchRequestSchema,
  organizeWrongQuestionRequestSchema,
  updateWrongQuestionDeckRequestSchema,
  wrongQuestionDeckQuestionListQuerySchema,
} from '@repo/types/api/wrong-question-organizer';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { WrongQuestionOrganizerService } from './wrong-question-organizer.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class WrongQuestionOrganizerController {
  constructor(private readonly service: WrongQuestionOrganizerService) {}

  @Get('wrong-question-groups')
  listGroups(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listGroups(user.id);
  }

  @Get('wrong-question-groups/:subjectGroupId/decks')
  listDecks(
    @CurrentUser() user: AuthenticatedUser,
    @Param('subjectGroupId') subjectGroupId: string,
  ) {
    return this.service.listDecks(user.id, subjectGroupId);
  }

  @Get('wrong-question-decks/:deckId/questions')
  listDeckQuestions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('deckId') deckId: string,
    @Query() query: unknown,
  ) {
    return this.service.listDeckQuestions(
      user.id,
      deckId,
      wrongQuestionDeckQuestionListQuerySchema.parse(query),
    );
  }

  @Post('wrong-question-organizer/organize/:wrongQuestionId')
  organizeOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('wrongQuestionId') wrongQuestionId: string,
    @Body() body: unknown,
  ) {
    return this.service.organizeOne(
      user.id,
      wrongQuestionId,
      organizeWrongQuestionRequestSchema.parse(body ?? {}),
    );
  }

  @Post('wrong-question-organizer/organize-batch')
  organizeBatch(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.service.organizeBatch(
      user.id,
      organizeWrongQuestionBatchRequestSchema.parse(body ?? {}),
    );
  }

  @Patch('wrong-question-decks/:deckId')
  updateDeck(
    @CurrentUser() user: AuthenticatedUser,
    @Param('deckId') deckId: string,
    @Body() body: unknown,
  ) {
    return this.service.updateDeck(
      user.id,
      deckId,
      updateWrongQuestionDeckRequestSchema.parse(body),
    );
  }

  @Post('wrong-question-decks/:deckId/items')
  moveToDeck(
    @CurrentUser() user: AuthenticatedUser,
    @Param('deckId') deckId: string,
    @Body() body: unknown,
  ) {
    return this.service.moveToDeck(
      user.id,
      deckId,
      moveWrongQuestionToDeckRequestSchema.parse(body),
    );
  }

  @Delete('wrong-question-decks/:deckId/items/:wrongQuestionId')
  removeDeckItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('deckId') deckId: string,
    @Param('wrongQuestionId') wrongQuestionId: string,
  ) {
    return this.service.removeDeckItem(user.id, deckId, wrongQuestionId);
  }
}
