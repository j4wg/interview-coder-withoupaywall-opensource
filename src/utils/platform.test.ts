// Mock the window object
const originalWindow = global.window

describe('platform utilities', () => {
  beforeEach(() => {
    // Reset the window object before each test
    global.window = { ...originalWindow }
  })

  afterEach(() => {
    // Restore the original window after each test
    global.window = originalWindow
  })

  describe('COMMAND_KEY', () => {
    it('should be ⌘ when platform is darwin', () => {
      // @ts-ignore
      global.window.electronAPI = {
        getPlatform: () => 'darwin'
      }
      // Need to reload the module to use the updated getPlatform
      jest.resetModules()
      const platformModule = require('./platform')
      expect(platformModule.COMMAND_KEY).toBe('⌘')
    })

    it('should be Ctrl when platform is win32', () => {
      // @ts-ignore
      global.window.electronAPI = {
        getPlatform: () => 'win32'
      }
      // Need to reload the module to use the updated getPlatform
      jest.resetModules()
      const platformModule = require('./platform')
      expect(platformModule.COMMAND_KEY).toBe('Ctrl')
    })

    it('should be Ctrl when platform is linux', () => {
      // @ts-ignore
      global.window.electronAPI = {
        getPlatform: () => 'linux'
      }
      // Need to reload the module to use the updated getPlatform
      jest.resetModules()
      const platformModule = require('./platform')
      expect(platformModule.COMMAND_KEY).toBe('Ctrl')
    })

    it('should be Ctrl when electronAPI is not available (defaults to win32)', () => {
      // Remove electronAPI
      delete global.window.electronAPI
      // Need to reload the module to use the updated getPlatform
      jest.resetModules()
      const platformModule = require('./platform')
      expect(platformModule.COMMAND_KEY).toBe('Ctrl')
    })

    it('should be Ctrl when electronAPI.getPlatform does not exist (defaults to win32)', () => {
      // @ts-ignore
      global.window.electronAPI = {}
      // Need to reload the module to use the updated getPlatform
      jest.resetModules()
      const platformModule = require('./platform')
      expect(platformModule.COMMAND_KEY).toBe('Ctrl')
    })

    it('should be Ctrl when electronAPI.getPlatform throws an error (defaults to win32)', () => {
      // @ts-ignore
      global.window.electronAPI = {
        getPlatform: () => {
          throw new Error('API unavailable')
        }
      }
      // Need to reload the module to use the updated getPlatform
      jest.resetModules()
      const platformModule = require('./platform')
      expect(platformModule.COMMAND_KEY).toBe('Ctrl')
    })
  })

  describe('isWindows', () => {
    it('should be true when platform is win32', () => {
      // @ts-ignore
      global.window.electronAPI = {
        getPlatform: () => 'win32'
      }
      // Need to reload the module to use the updated getPlatform
      jest.resetModules()
      const platformModule = require('./platform')
      expect(platformModule.isWindows).toBe(true)
    })

    it('should be false when platform is darwin', () => {
      // @ts-ignore
      global.window.electronAPI = {
        getPlatform: () => 'darwin'
      }
      // Need to reload the module to use the updated getPlatform
      jest.resetModules()
      const platformModule = require('./platform')
      expect(platformModule.isWindows).toBe(false)
    })

    it('should be false when platform is linux', () => {
      // @ts-ignore
      global.window.electronAPI = {
        getPlatform: () => 'linux'
      }
      // Need to reload the module to use the updated getPlatform
      jest.resetModules()
      const platformModule = require('./platform')
      expect(platformModule.isWindows).toBe(false)
    })

    it('should be true when electronAPI is not available (defaults to win32)', () => {
      // Remove electronAPI
      delete global.window.electronAPI
      // Need to reload the module to use the updated getPlatform
      jest.resetModules()
      const platformModule = require('./platform')
      expect(platformModule.isWindows).toBe(true)
    })

    it('should be true when electronAPI.getPlatform does not exist (defaults to win32)', () => {
      // @ts-ignore
      global.window.electronAPI = {}
      // Need to reload the module to use the updated getPlatform
      jest.resetModules()
      const platformModule = require('./platform')
      expect(platformModule.isWindows).toBe(true)
    })

    it('should be true when electronAPI.getPlatform throws an error (defaults to win32)', () => {
      // @ts-ignore
      global.window.electronAPI = {
        getPlatform: () => {
          throw new Error('API unavailable')
        }
      }
      // Need to reload the module to use the updated getPlatform
      jest.resetModules()
      const platformModule = require('./platform')
      expect(platformModule.isWindows).toBe(true)
    })
  })

  describe('isMacOS', () => {
    it('should be true when platform is darwin', () => {
      // @ts-ignore
      global.window.electronAPI = {
        getPlatform: () => 'darwin'
      }
      // Need to reload the module to use the updated getPlatform
      jest.resetModules()
      const platformModule = require('./platform')
      expect(platformModule.isMacOS).toBe(true)
    })

    it('should be false when platform is win32', () => {
      // @ts-ignore
      global.window.electronAPI = {
        getPlatform: () => 'win32'
      }
      // Need to reload the module to use the updated getPlatform
      jest.resetModules()
      const platformModule = require('./platform')
      expect(platformModule.isMacOS).toBe(false)
    })

    it('should be false when platform is linux', () => {
      // @ts-ignore
      global.window.electronAPI = {
        getPlatform: () => 'linux'
      }
      // Need to reload the module to use the updated getPlatform
      jest.resetModules()
      const platformModule = require('./platform')
      expect(platformModule.isMacOS).toBe(false)
    })

    it('should be false when electronAPI is not available (defaults to win32)', () => {
      // Remove electronAPI
      delete global.window.electronAPI
      // Need to reload the module to use the updated getPlatform
      jest.resetModules()
      const platformModule = require('./platform')
      expect(platformModule.isMacOS).toBe(false)
    })

    it('should be false when electronAPI.getPlatform does not exist (defaults to win32)', () => {
      // @ts-ignore
      global.window.electronAPI = {}
      // Need to reload the module to use the updated getPlatform
      jest.resetModules()
      const platformModule = require('./platform')
      expect(platformModule.isMacOS).toBe(false)
    })

    it('should be false when electronAPI.getPlatform throws an error (defaults to win32)', () => {
      // @ts-ignore
      global.window.electronAPI = {
        getPlatform: () => {
          throw new Error('API unavailable')
        }
      }
      // Need to reload the module to use the updated getPlatform
      jest.resetModules()
      const platformModule = require('./platform')
      expect(platformModule.isMacOS).toBe(false)
    })
  })
})