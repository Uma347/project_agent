import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateQuoteRequestDto {
  @ApiProperty({
    example: 'quiero comprar dos mochilas urbanas',
  })
  @IsString()
  @IsNotEmpty()
  prompt!: string;

  @ApiProperty({
    example: 'b6fd7d2d-5e56-4b37-a761-2d69b86a9e91',
  })
  @IsUUID()
  requestedByUserId!: string;

  @ApiPropertyOptional({
    example: 3,
    minimum: 1,
    description:
      'Cantidad solicitada. Si se envia, tiene prioridad sobre la cantidad interpretada desde el prompt.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}
