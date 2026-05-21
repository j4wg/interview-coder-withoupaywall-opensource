import { Screenshot } from './screenshots'

describe('Screenshot Interface', () => {
  it('should have the correct properties', () => {
    const mockScreenshot: Screenshot = {
      path: '/path/to/screenshot.png',
      preview: 'data:image/png;base64,iVBORw0KGgoAAAANSU'
    }

    expect(mockScreenshot).toHaveProperty('path')
    expect(mockScreenshot).toHaveProperty('preview')
  })

  it('should have correct path type', () => {
    const mockScreenshot: Screenshot = {
      path: '/path/to/screenshot.png',
      preview: 'data:image/png;base64,iVBORw0KGgoAAAANSU'
    }

    expect(typeof mockScreenshot.path).toBe('string')
    expect(mockScreenshot.path).toBe('/path/to/screenshot.png')
  })

  it('should have correct preview type', () => {
    const mockScreenshot: Screenshot = {
      path: '/path/to/screenshot.png',
      preview: 'data:image/png;base64,iVBORw0KGgoAAAANSU'
    }

    expect(typeof mockScreenshot.preview).toBe('string')
    expect(mockScreenshot.preview).toBe('data:image/png;base64,iVBORw0KGgoAAAANSU')
  })

  it('should allow different path values', () => {
    const screenshot1: Screenshot = {
      path: '/path/to/screenshot1.jpg',
      preview: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ'
    }

    const screenshot2: Screenshot = {
      path: 'relative/path/to/screenshot2.gif',
      preview: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP'
    }

    expect(screenshot1.path).toBe('/path/to/screenshot1.jpg')
    expect(screenshot2.path).toBe('relative/path/to/screenshot2.gif')
  })

  it('should allow different preview values', () => {
    const screenshotWithUrl: Screenshot = {
      path: '/path/to/screenshot.png',
      preview: 'https://example.com/image.png'
    }

    const screenshotWithDataUrl: Screenshot = {
      path: '/path/to/screenshot2.png',
      preview: 'data:image/png;base64,iVBORw0KGgoAAAANSU'
    }

    expect(screenshotWithUrl.preview).toBe('https://example.com/image.png')
    expect(screenshotWithDataUrl.preview).toBe('data:image/png;base64,iVBORw0KGgoAAAANSU')
  })

  it('should validate required properties exist', () => {
    const screenshot: Screenshot = {
      path: '/path/to/screenshot.png',
      preview: 'data:image/png;base64,iVBORw0KGgoAAAANSU'
    }

    expect(screenshot).toEqual({
      path: expect.any(String),
      preview: expect.any(String)
    })
  })
})