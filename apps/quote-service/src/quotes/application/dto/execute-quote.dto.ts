import { IsOptional, IsString, IsUUID } from 'class-validator';

export class ExecuteQuoteDto {
  @IsUUID()
  quoteId!: string;

  @IsOptional()
  @IsString()
  executedBy?: string;
}
