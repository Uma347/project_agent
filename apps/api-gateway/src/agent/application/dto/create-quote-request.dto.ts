import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

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
}
