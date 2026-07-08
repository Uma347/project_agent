import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class ApproveQuoteDto {
  @IsUUID()
  quoteId!: string;

  @IsString()
  @IsNotEmpty()
  approvedBy!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
