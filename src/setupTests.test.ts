import "@testing-library/jest-dom";

// Import the setupTests file to make sure it runs
import "./setupTests";

describe('setupTests.ts', () => {
  describe('ResizeObserver mock', () => {
    it('should mock ResizeObserver on window', () => {
      expect(window.ResizeObserver).toBeDefined();
      expect(typeof window.ResizeObserver).toBe('function');
      
      const resizeObserver = new window.ResizeObserver(() => {});
      expect(resizeObserver).toBeDefined();
      expect(typeof resizeObserver.observe).toBe('function');
      expect(typeof resizeObserver.unobserve).toBe('function');
      expect(typeof resizeObserver.disconnect).toBe('function');
    });

    it('should have working ResizeObserver methods', () => {
      const resizeObserver = new window.ResizeObserver(() => {});
      
      // These methods should not throw errors
      expect(() => resizeObserver.observe(document.createElement('div'))).not.toThrow();
      expect(() => resizeObserver.unobserve(document.createElement('div'))).not.toThrow();
      expect(() => resizeObserver.disconnect()).not.toThrow();
    });
  });

  describe('IntersectionObserver mock', () => {
    it('should mock IntersectionObserver on window', () => {
      expect(window.IntersectionObserver).toBeDefined();
      expect(typeof window.IntersectionObserver).toBe('function');
      
      const intersectionObserver = new window.IntersectionObserver(() => {});
      expect(intersectionObserver).toBeDefined();
      expect(typeof intersectionObserver.observe).toBe('function');
      expect(typeof intersectionObserver.unobserve).toBe('function');
      expect(typeof intersectionObserver.disconnect).toBe('function');
    });

    it('should have working IntersectionObserver methods', () => {
      const callback = () => {};
      const intersectionObserver = new window.IntersectionObserver(callback);
      
      // These methods should not throw errors
      expect(() => intersectionObserver.observe(document.createElement('div'))).not.toThrow();
      expect(() => intersectionObserver.unobserve(document.createElement('div'))).not.toThrow();
      expect(() => intersectionObserver.disconnect()).not.toThrow();
    });
  });

  describe('matchMedia mock', () => {
    it('should mock matchMedia on window', () => {
      expect(window.matchMedia).toBeDefined();
      expect(typeof window.matchMedia).toBe('function');
      
      const mediaQueryResult = window.matchMedia('(max-width: 768px)');
      expect(mediaQueryResult).toBeDefined();
      expect(typeof mediaQueryResult.matches).toBe('boolean');
      expect(typeof mediaQueryResult.media).toBe('string');
      expect(typeof mediaQueryResult.onchange).toBe('object');
      expect(typeof mediaQueryResult.addListener).toBe('function');
      expect(typeof mediaQueryResult.removeListener).toBe('function');
      expect(typeof mediaQueryResult.addEventListener).toBe('function');
      expect(typeof mediaQueryResult.removeEventListener).toBe('function');
      expect(typeof mediaQueryResult.dispatchEvent).toBe('function');
    });

    it('should return false for matches by default', () => {
      const mediaQueryResult = window.matchMedia('(max-width: 768px)');
      expect(mediaQueryResult.matches).toBe(false);
    });

    it('should preserve the query in the media property', () => {
      const query = '(max-width: 768px)';
      const mediaQueryResult = window.matchMedia(query);
      expect(mediaQueryResult.media).toBe(query);
    });
  });

  describe('window properties', () => {
    it('should define __CREDITS__ on window', () => {
      expect(window.__CREDITS__).toBeDefined();
      expect(window.__CREDITS__).toBe(null);
    });

    it('should define __LANGUAGE__ on window', () => {
      expect(window.__LANGUAGE__).toBeDefined();
      expect(window.__LANGUAGE__).toBe(null);
    });

    it('should define __IS_INITIALIZED__ on window', () => {
      expect(window.__IS_INITIALIZED__).toBeDefined();
      expect(window.__IS_INITIALIZED__).toBe(null);
    });
  });

  describe('jest-dom import', () => {
    it('should extend expect with jest-dom matchers', () => {
      // Create a simple DOM element and add it to the document to test the matchers
      const element = document.createElement('div');
      element.textContent = 'Hello';
      document.body.appendChild(element);

      // Test that the jest-dom matchers are available by using them
      expect(() => expect(element).toHaveTextContent('Hello')).not.toThrow();
      expect(() => expect(element).toBeInTheDocument()).not.toThrow();

      element.setAttribute('id', 'test');
      expect(() => expect(element).toHaveAttribute('id', 'test')).not.toThrow();

      // Clean up by removing the element from the document
      document.body.removeChild(element);
    });
  });
});