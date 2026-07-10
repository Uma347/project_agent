import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class ApproveQuoteRequestDto {
  @ApiProperty({
    example: '9cc1fe5e-8b25-4e3d-908e-d9aa0d8f51f2',
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
