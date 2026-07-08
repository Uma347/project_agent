import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class RejectQuoteDto {
  @IsUUID()
  quoteId!: string;

  @IsString()
  @IsNotEmpty()
  rejectedBy!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
