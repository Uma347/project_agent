import { IsOptional, IsString, IsUUID } from 'class-validator';

export class RejectQuoteDto {
  @IsUUID()
  quoteId!: string;

  @IsUUID()
  rejectedByUserId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
