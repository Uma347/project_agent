import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class ApproveQuoteRequestDto {
  @ApiProperty({
    example: '22222222-2222-4222-8222-222222222222',
  })
  @IsUUID()
  approvedByUserId!: string;

  @ApiPropertyOptional({
    example: 'Aprobado desde Postman',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
