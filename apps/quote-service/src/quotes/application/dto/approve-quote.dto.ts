import { IsOptional, IsString, IsUUID } from 'class-validator';

export class ApproveQuoteDto {
  @IsUUID()
  quoteId!: string;

  @IsUUID()
  approvedByUserId!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
