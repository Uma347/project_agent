import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class RejectQuoteRequestDto {
  @ApiProperty({
    example: '33333333-3333-4333-8333-333333333333',
  })
  @IsUUID()
  rejectedByUserId!: string;

  @ApiPropertyOptional({
    example: 'Cliente no confirmo la compra',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
