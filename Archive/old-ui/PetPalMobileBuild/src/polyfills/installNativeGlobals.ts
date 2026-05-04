import 'react-native-url-polyfill/auto';

class PetPalFormData {
  private parts: [string, unknown][] = [];

  append(name: string, value: unknown) {
    this.parts.push([name, value]);
  }

  getAll(name: string) {
    return this.parts.filter(([key]) => key === name).map(([, value]) => value);
  }
}

if (typeof globalThis.FormData === 'undefined') {
  globalThis.FormData = PetPalFormData as unknown as typeof FormData;
}
