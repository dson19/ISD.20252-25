import { ValidationException } from '../exceptions/validation.exception';
import { DeliveryInfo } from './delivery-info.entity';

describe('DeliveryInfo validation', () => {
  it('O_TC15 ValidateNameSuccess accepts valid name within 30 characters [EP]', () => {
    expect(DeliveryInfo.validateName('Son Nguyen')).toBe(true);
  });

  it('O_TC16 ValidateNameNullError throws when name is empty [BVA]', () => {
    expect(() => DeliveryInfo.validateName('')).toThrow(ValidationException);
  });

  it('O_TC17 ValidateNameTooLongError throws when name exceeds 30 characters [BVA]', () => {
    expect(() => DeliveryInfo.validateName('Son Nguyen Son Nguyen Son Nguyen S')).toThrow(
      ValidationException,
    );
  });

  it('O_TC18 ValidateNameInvalidCharError throws when name has numbers or special characters [EP]', () => {
    expect(() => DeliveryInfo.validateName('Son123!')).toThrow(
      ValidationException,
    );
  });

  it('O_TC19 ValidatePhoneSuccess accepts 10-digit phone starting with 0 [BVA]', () => {
    expect(DeliveryInfo.validatePhone('0987654321')).toBe(true);
  });

  it('O_TC20 ValidatePhoneWithSeparatorSuccess accepts phone with one separator type [EP]', () => {
    expect(DeliveryInfo.validatePhone('098.765.43.21')).toBe(true);
  });

  it('O_TC21 ValidatePhoneMixedSeparatorsError throws for mixed separators [Decision Table]', () => {
    expect(() => DeliveryInfo.validatePhone('098.765-43/21')).toThrow(
      ValidationException,
    );
  });

  it('O_TC22 ValidatePhoneNotStartWithZeroError throws when phone does not start with 0 [EP]', () => {
    expect(() => DeliveryInfo.validatePhone('1987654321')).toThrow(
      ValidationException,
    );
  });

  it('O_TC23 ValidatePhoneInvalidLengthError throws when phone has fewer than 10 digits [BVA]', () => {
    expect(() => DeliveryInfo.validatePhone('098765432')).toThrow(
      ValidationException,
    );
  });

  it('O_TC24 ValidatePhoneInvalidCharError throws when phone contains letters [EP]', () => {
    expect(() => DeliveryInfo.validatePhone('0987654ABC')).toThrow(
      ValidationException,
    );
  });

  it('O_TC25 ValidateAddressSuccess accepts letters digits and slashes within 100 characters [EP]', () => {
    expect(DeliveryInfo.validateAddress('123/45 Hanoi')).toBe(true);
  });

  it('O_TC26 ValidateAddressNullError throws when address is empty [BVA]', () => {
    expect(() => DeliveryInfo.validateAddress('')).toThrow(ValidationException);
  });

  it('O_TC27 ValidateAddressTooLongError throws when address exceeds 100 characters [BVA]', () => {
    expect(() => DeliveryInfo.validateAddress('A'.repeat(101))).toThrow(
      ValidationException,
    );
  });

  it('O_TC28 ValidateAddressInvalidCharError throws when address has disallowed special characters [EP]', () => {
    expect(() => DeliveryInfo.validateAddress('Hanoi@2026!')).toThrow(
      ValidationException,
    );
  });
});
