import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateQuoteDto {
  @IsString()
  @IsNotEmpty()
  prompt!: string;

  @IsUUID()
  requestedByUserId!: string;
}
