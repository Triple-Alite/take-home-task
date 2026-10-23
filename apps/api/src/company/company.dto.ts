import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsString, Length, Max, Min } from 'class-validator';

export class UpdateCompanyDto {
  @ApiProperty({ example: 'Northstar Labs', minLength: 1, maxLength: 120 })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(1, 120)
  companyName!: string;

  @ApiProperty({ example: 24, minimum: 0, maximum: 10000000 })
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  numberOfUsers!: number;

  @ApiProperty({ example: 7, minimum: 0, maximum: 10000000 })
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  numberOfProducts!: number;
}
