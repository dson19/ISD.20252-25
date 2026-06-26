import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';

/**
 * + Coupling/Cohesion level:
 *   - Data Coupling: Chỉ mang các trường nguyên thủy cần để tạo tài khoản (email, fullName, password, roles).
 *   - Functional Cohesion: Chỉ lo việc validate input tạo user ở biên HTTP.
 * + Reason why:
 *   - Validate ở DTO (như CreateProductDto/CreateVietqrPaymentDto) giúp controller mỏng và tách
 *     việc kiểm tra đầu vào khỏi business logic trong UserAdminService (SRP).
 */
export class CreateUserDto {
  @IsEmail({}, { message: 'email không hợp lệ' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'fullName không được để trống' })
  fullName: string;

  @IsString()
  @IsNotEmpty({ message: 'phoneNumber không được để trống' })
  phoneNumber: string;

  @IsString()
  @MinLength(6, { message: 'password tối thiểu 6 ký tự' })
  password: string;

  @IsArray()
  @ArrayNotEmpty({ message: 'phải chọn ít nhất một vai trò' })
  @IsString({ each: true })
  roles: string[];
}
