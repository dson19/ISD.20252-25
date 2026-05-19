import { ValidationException } from '../exceptions/validation.exception';

export class DeliveryInfo {
  static validateName(name: string | null): true {
    if (!name) {
      throw new ValidationException('Receiver name is required');
    }

    if (name.length > 30) {
      throw new ValidationException('Receiver name must not exceed 30 characters');
    }

    if (!/^[A-Za-z ]+$/.test(name)) {
      throw new ValidationException('Receiver name can only contain letters');
    }

    return true;
  }

  static validatePhone(phone: string | null): true {
    if (!phone) {
      throw new ValidationException('Phone number is required');
    }

    const separatorMatches = phone.match(/[.\-/]/g) ?? [];
    const separatorTypes = new Set(separatorMatches);

    if (separatorTypes.size > 1) {
      throw new ValidationException('Phone number can only use one separator type');
    }

    if (!/^\d+(?:[.\-/]\d+)*$/.test(phone)) {
      throw new ValidationException('Phone number contains invalid characters');
    }

    const digits = phone.replace(/[.\-/]/g, '');

    if (digits.length !== 10 || !digits.startsWith('0')) {
      throw new ValidationException('Phone number must have 10 digits and start with 0');
    }

    return true;
  }

  static validateAddress(address: string | null): true {
    if (!address) {
      throw new ValidationException('Address is required');
    }

    if (address.length > 100) {
      throw new ValidationException('Address must not exceed 100 characters');
    }

    if (!/^[A-Za-z0-9/ ]+$/.test(address)) {
      throw new ValidationException('Address contains invalid characters');
    }

    return true;
  }
}
