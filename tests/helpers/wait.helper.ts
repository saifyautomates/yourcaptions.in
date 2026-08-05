export class WaitHelper {
  static async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async waitForCondition(condition: () => Promise<boolean> | boolean, timeoutMs: number = 10000, intervalMs: number = 500): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await condition()) {
        return true;
      }
      await this.sleep(intervalMs);
    }
    throw new Error('Condition not met within timeout');
  }
}
