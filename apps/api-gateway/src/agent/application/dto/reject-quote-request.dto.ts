import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class RejectQuoteRequestDto {
  @ApiProperty({
    example: '47ad93a6-44fa-494c-88cc-7a865639e2d0',
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
