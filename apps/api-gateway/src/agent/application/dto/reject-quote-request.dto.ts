import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RejectQuoteRequestDto {
  @ApiProperty({
    example: 'human-operator-1',
  })
  @IsString()
  @IsNotEmpty()
  rejectedBy!: string;

  @ApiPropertyOptional({
    example: 'Cliente no confirmo la compra',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
