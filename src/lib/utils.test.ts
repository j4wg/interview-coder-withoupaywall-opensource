import { cn } from './utils';

describe('cn function', () => {
  it('should merge class names correctly', () => {
    const result = cn('class1', 'class2');
    expect(result).toBe('class1 class2');
  });

  it('should handle conditional class names', () => {
    const result = cn('class1', false && 'class2', 'class3');
    expect(result).toBe('class1 class3');
  });

  it('should handle null and undefined values', () => {
    const result = cn('class1', null, 'class2', undefined, 'class3');
    expect(result).toBe('class1 class2 class3');
  });

  it('should handle objects with boolean values', () => {
    const result = cn('class1', { 'class2': true, 'class3': false });
    expect(result).toBe('class1 class2');
  });

  it('should merge Tailwind classes with conflict resolution', () => {
    // twMerge should resolve conflicts between similar Tailwind classes
    const result = cn('text-red-500', 'text-blue-500');
    expect(result).toBe('text-blue-500');
  });

  it('should handle mixed types of class inputs', () => {
    const result = cn(
      'class1',
      { 'class2': true, 'class3': false },
      ['class4', 'class5'],
      null,
      undefined,
      0,
      false
    );
    expect(result).toBe('class1 class2 class4 class5');
  });

  it('should return empty string when no valid classes provided', () => {
    const result = cn(null, undefined, false, 0);
    expect(result).toBe('');
  });

  it('should work with array of class names', () => {
    const result = cn(['class1', 'class2'], ['class3', 'class4']);
    expect(result).toBe('class1 class2 class3 class4');
  });

  it('should handle complex conditional objects', () => {
    const isActive = true;
    const isSelected = false;
    const result = cn('base-class', {
      'active-class': isActive,
      'inactive-class': !isActive,
      'selected-class': isSelected
    });
    expect(result).toBe('base-class active-class');
  });
});