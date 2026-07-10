import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateQuoteDto {
  @IsString()
  @IsNotEmpty()
  prompt!: string;

  @IsUUID()
  requestedByUserId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}
