const { finishStartup } = require('../src/renderer/startupFlow');

describe('Startup splash completion', () => {
  test('dismisses the splash after successful routing', () => {
    const route = jest.fn();
    const dismiss = jest.fn();
    const onError = jest.fn();

    finishStartup({ route, dismiss, onError });

    expect(route).toHaveBeenCalledTimes(1);
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  test('dismisses the splash and reports routing errors', () => {
    const error = new Error('router failed');
    const dismiss = jest.fn();
    const onError = jest.fn();

    finishStartup({ route: () => { throw error; }, dismiss, onError });

    expect(onError).toHaveBeenCalledWith(error);
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});
