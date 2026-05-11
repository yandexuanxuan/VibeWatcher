import { spawnProcess } from '../src/spawner';

describe('spawnProcess', () => {
  it('should spawn echo command and return output', (done) => {
    const proc = spawnProcess('echo', ['hello world']);

    let stdoutData = '';

    proc.stdout?.on('data', (data) => {
      stdoutData += data.toString();
    });

    proc.on('exit', (code) => {
      expect(code).toBe(0);
      expect(stdoutData).toContain('hello world');
      done();
    });
  });

  it('should capture stderr separately', (done) => {
    const proc = spawnProcess('sh', ['-c', 'echo error >&2']);

    let stderrData = '';

    proc.stderr?.on('data', (data) => {
      stderrData += data.toString();
    });

    proc.on('exit', (code) => {
      expect(code).toBe(0);
      expect(stderrData).toContain('error');
      done();
    });
  });
});