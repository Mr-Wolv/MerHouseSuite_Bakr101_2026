import { registerServiceWorker } from './registerServiceWorker'

describe('registerServiceWorker', () => {
  it('does not register the mobile app service worker outside production builds', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener')

    registerServiceWorker()

    expect(addEventListenerSpy).not.toHaveBeenCalledWith('load', expect.any(Function))
  })
})
