import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateQuoteRequestDto {
  @ApiProperty({
    example: 'quiero comprar dos hamburguesas',
  })
  @IsString()
  @IsNotEmpty()
  prompt!: string;

  @ApiPropertyOptional({
    example: 'postman-user',
  })
  @IsOptional()
  @IsString()
  requestedBy?: string;
}
