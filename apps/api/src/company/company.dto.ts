import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Length, Max, Min } from 'class-validator';

export class UpdateCompanyDto {
  @ApiProperty({ example: 'Northstar Labs', minLength: 2, maxLength: 120 })
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiProperty({ example: 24, minimum: 0, maximum: 10000000 })
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  userCount!: number;

  @ApiProperty({ example: 7, minimum: 0, maximum: 10000000 })
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  productCount!: number;
}
