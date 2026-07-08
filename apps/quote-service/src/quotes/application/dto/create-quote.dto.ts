import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateQuoteDto {
  @IsString()
  @IsNotEmpty()
  prompt!: string;

  @IsOptional()
  @IsString()
  requestedBy?: string;
}
