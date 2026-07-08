import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ApproveQuoteRequestDto {
  @ApiProperty({
    example: 'human-operator-1',
  })
  @IsString()
  @IsNotEmpty()
  approvedBy!: string;

  @ApiPropertyOptional({
    example: 'Aprobado desde Postman',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
