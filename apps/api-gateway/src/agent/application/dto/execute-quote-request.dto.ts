import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ExecuteQuoteRequestDto {
  @ApiPropertyOptional({
    example: 'human-operator-1',
  })
  @IsOptional()
  @IsString()
  executedBy?: string;
}
