import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateQuoteRequestDto {
  @ApiProperty({
    example: 'quiero comprar dos hamburguesas',
  })
  @IsString()
  @IsNotEmpty()
  prompt!: string;

  @ApiProperty({
    example: '11111111-1111-4111-8111-111111111111',
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
