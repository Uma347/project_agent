import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsOptional()
  @IsIn(['development', 'test', 'production'])
  NODE_ENV?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  PORT?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  API_GLOBAL_PREFIX?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  SWAGGER_TITLE?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  SWAGGER_DESCRIPTION?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  SWAGGER_VERSION?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  SWAGGER_PATH?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  NATS_SERVERS?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  NATS_REQUEST_TIMEOUT_MS?: number;
}

export function validateEnvironment(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
