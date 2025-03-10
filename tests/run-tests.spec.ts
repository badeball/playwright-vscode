/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { expect, test } from '@playwright/test';
import { TestRun } from './mock/vscode';
import { activate } from './utils';

test.describe.configure({ mode: 'parallel' });

test('should run all tests', async ({}, testInfo) => {
  const { testController, renderExecLog } = await activate(testInfo.outputDir, {
    'playwright.config.js': `module.exports = { testDir: 'tests' }`,
    'tests/test-1.spec.ts': `
      import { test } from '@playwright/test';
      test('should pass', async () => {});
    `,
    'tests/test-2.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('should fail', async () => { expect(1).toBe(2); });
    `,
  });

  const testRun = await testController.run();
  expect(testRun.renderLog()).toBe(`
    should fail [2:0]
      enqueued
      started
      failed
    should pass [2:0]
      enqueued
      started
      passed
  `);

  expect(renderExecLog('  ')).toBe(`
    > playwright list-files -c playwright.config.js
    > playwright test -c playwright.config.js
  `);
});

test('should run one test', async ({}, testInfo) => {
  const { testController, renderExecLog } = await activate(testInfo.outputDir, {
    'playwright.config.js': `module.exports = { testDir: 'tests' }`,
    'tests/test.spec.ts': `
      import { test } from '@playwright/test';
      test('should pass', async () => {});
    `,
  });

  await testController.expandTestItems(/test.spec/);
  const testItems = testController.findTestItems(/pass/);
  const testRun = await testController.run(testItems);

  expect(testRun.renderLog()).toBe(`
    should pass [2:0]
      enqueued
      enqueued
      started
      passed
  `);

  expect(renderExecLog('  ')).toBe(`
    > playwright list-files -c playwright.config.js
    > playwright test -c playwright.config.js --list tests/test.spec.ts
    > playwright test -c playwright.config.js tests/test.spec.ts:3
  `);
});

test('should run describe', async ({}, testInfo) => {
  const { testController } = await activate(testInfo.outputDir, {
    'playwright.config.js': `module.exports = { testDir: 'tests' }`,
    'tests/test.spec.ts': `
      import { test } from '@playwright/test';
      test.describe('describe', () => {
        test('one', async () => {});
        test('two', async () => {});
      });
    `,
  });

  await testController.expandTestItems(/test.spec.ts/);
  const testItems = testController.findTestItems(/describe/);
  expect(testItems.length).toBe(1);
  const testRun = await testController.run(testItems);

  expect(testRun.renderLog()).toBe(`
    one [3:0]
      enqueued
      enqueued
      started
      passed
    two [4:0]
      enqueued
      enqueued
      started
      passed
  `);
});

test('should run file', async ({}, testInfo) => {
  const { testController, renderExecLog } = await activate(testInfo.outputDir, {
    'playwright.config.js': `module.exports = { testDir: 'tests' }`,
    'tests/test.spec.ts': `
      import { test } from '@playwright/test';
      test('one', async () => {});
      test('two', async () => {});
    `,
  });

  const testItems = testController.findTestItems(/test.spec.ts/);
  expect(testItems.length).toBe(1);
  const testRun = await testController.run(testItems);

  expect(testRun.renderLog()).toBe(`
    one [2:0]
      enqueued
      started
      passed
    two [3:0]
      enqueued
      started
      passed
  `);

  expect(renderExecLog('  ')).toBe(`
    > playwright list-files -c playwright.config.js
    > playwright test -c playwright.config.js tests/test.spec.ts
  `);
});

test('should run folder', async ({}, testInfo) => {
  const { testController, renderExecLog } = await activate(testInfo.outputDir, {
    'playwright.config.js': `module.exports = { testDir: 'tests' }`,
    'tests/folder/test1.spec.ts': `
      import { test } from '@playwright/test';
      test('one', async () => {});
    `,
    'tests/folder/test2.spec.ts': `
      import { test } from '@playwright/test';
      test('two', async () => {});
    `,
  });

  const testItems = testController.findTestItems(/folder/);
  expect(testItems.length).toBe(1);
  const testRun = await testController.run(testItems);

  expect(testRun.renderLog()).toBe(`
    one [2:0]
      enqueued
      started
      passed
    two [2:0]
      enqueued
      started
      passed
  `);

  expect(renderExecLog('  ')).toBe(`
    > playwright list-files -c playwright.config.js
    > playwright test -c playwright.config.js tests/folder
  `);
});

test('should show error message', async ({}, testInfo) => {
  const { testController } = await activate(testInfo.outputDir, {
    'playwright.config.js': `module.exports = { testDir: 'tests' }`,
    'tests/test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('should fail', async () => {
        expect(1).toBe(2);
      });
    `,
  });

  await testController.expandTestItems(/test.spec/);
  const testItems = testController.findTestItems(/fail/);
  const testRun = await testController.run(testItems);

  expect(testRun.renderLog({ messages: true })).toBe(`
    should fail [2:0]
      enqueued
      enqueued
      started
      failed
        test.spec.ts:[3:18 - 3:18]
        Error: <span style='color:#666;'>expect(</span><span style='color:#f14c4c;'>received</span><span style='color:#666;'>).</span>toBe<span style='color:#666;'>(</span><span style='color:#73c991;'>expected</span><span style='color:#666;'>) // Object.is equality</span>
        <br>
        
        <br>
        Expected: <span style='color:#73c991;'>2</span>
        <br>
        Received: <span style='color:#f14c4c;'>1</span>
        <br>
            at tests/test.spec.ts:4:19
        </span></br>
  `);
});

test('should escape error log', async ({}, testInfo) => {
  const { testController } = await activate(testInfo.outputDir, {
    'playwright.config.js': `module.exports = { testDir: 'tests' }`,
    'tests/test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('should fail', async () => {
        throw new Error('\\n========== log ==========\\n<div class="foo bar baz"></div>\\n===============\\n');
      });
    `,
  });
  await testController.expandTestItems(/test.spec/);
  const testItems = testController.findTestItems(/fail/);
  const testRun = await testController.run(testItems);

  expect(testRun.renderLog({ messages: true })).toContain(
      `<b>&lt;</b>div class=&quot;foo bar baz&quot;<b>&gt;</b><b>&lt;</b>/div<b>&gt;`);
});

test('should show soft error messages', async ({}, testInfo) => {
  const { testController } = await activate(testInfo.outputDir, {
    'playwright.config.js': `module.exports = { testDir: 'tests' }`,
    'tests/test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('should fail', async () => {
        expect.soft(1).toBe(2);
        expect.soft(2).toBe(3);
      });
    `,
  });

  await testController.expandTestItems(/test.spec/);
  const testItems = testController.findTestItems(/fail/);
  const testRun = await testController.run(testItems);

  expect(testRun.renderLog({ messages: true })).toBe(`
    should fail [2:0]
      enqueued
      enqueued
      started
      failed
        test.spec.ts:[3:23 - 3:23]
        Error: <span style='color:#666;'>expect(</span><span style='color:#f14c4c;'>received</span><span style='color:#666;'>).</span>toBe<span style='color:#666;'>(</span><span style='color:#73c991;'>expected</span><span style='color:#666;'>) // Object.is equality</span>
        <br>
        
        <br>
        Expected: <span style='color:#73c991;'>2</span>
        <br>
        Received: <span style='color:#f14c4c;'>1</span>
        <br>
            at tests/test.spec.ts:4:24
        </span></br>
        test.spec.ts:[4:23 - 4:23]
        Error: <span style='color:#666;'>expect(</span><span style='color:#f14c4c;'>received</span><span style='color:#666;'>).</span>toBe<span style='color:#666;'>(</span><span style='color:#73c991;'>expected</span><span style='color:#666;'>) // Object.is equality</span>
        <br>
        
        <br>
        Expected: <span style='color:#73c991;'>3</span>
        <br>
        Received: <span style='color:#f14c4c;'>2</span>
        <br>
            at tests/test.spec.ts:5:24
        </span></br>
  `);
});

test('should only create test run if file belongs to context', async ({}, testInfo) => {
  const { vscode, testController, renderExecLog } = await activate(testInfo.outputDir, {
    'tests1/playwright.config.js': `module.exports = { testDir: '.' }`,
    'tests2/playwright.config.js': `module.exports = { testDir: '.' }`,
    'tests1/test1.spec.ts': `
      import { test } from '@playwright/test';
      test('one', async () => {});
    `,
    'tests2/test2.spec.ts': `
      import { test } from '@playwright/test';
      test('two', async () => {});
    `,
  });

  const profiles = testController.runProfiles.filter(p => p.kind === vscode.TestRunProfileKind.Run);
  let testRuns: TestRun[] = [];
  testController.onDidCreateTestRun(run => testRuns.push(run));

  {
    testRuns = [];
    const items = testController.findTestItems(/test1.spec/);
    await Promise.all(profiles.map(p => p.run(items)));
    expect(testRuns).toHaveLength(1);
  }

  expect(renderExecLog('  ')).toBe(`
    tests1> playwright list-files -c playwright.config.js
    tests2> playwright list-files -c playwright.config.js
    tests1> playwright test -c playwright.config.js test1.spec.ts
  `);

  {
    testRuns = [];
    const items = testController.findTestItems(/test2.spec/);
    await Promise.all(profiles.map(p => p.run(items)));
    expect(testRuns).toHaveLength(1);
  }

  expect(renderExecLog('  ')).toBe(`
    tests1> playwright list-files -c playwright.config.js
    tests2> playwright list-files -c playwright.config.js
    tests1> playwright test -c playwright.config.js test1.spec.ts
    tests2> playwright test -c playwright.config.js test2.spec.ts
  `);
});

test('should only create test run if folder belongs to context', async ({}, testInfo) => {
  const { vscode, testController, renderExecLog } = await activate(testInfo.outputDir, {
    'tests1/playwright.config.js': `module.exports = { testDir: '.' }`,
    'tests2/playwright.config.js': `module.exports = { testDir: '.' }`,
    'tests1/foo1/bar1/test1.spec.ts': `
      import { test } from '@playwright/test';
      test('one', async () => {});
    `,
    'tests2/foo2/bar2/test2.spec.ts': `
      import { test } from '@playwright/test';
      test('two', async () => {});
    `,
  });

  const profiles = testController.runProfiles.filter(p => p.kind === vscode.TestRunProfileKind.Run);
  const testRuns: TestRun[] = [];
  testController.onDidCreateTestRun(run => testRuns.push(run));
  const items = testController.findTestItems(/foo1/);
  await Promise.all(profiles.map(p => p.run(items)));
  expect(testRuns).toHaveLength(1);
  expect(testRuns[0].request.profile).toBe(profiles[0]);

  expect(renderExecLog('  ')).toBe(`
    tests1> playwright list-files -c playwright.config.js
    tests2> playwright list-files -c playwright.config.js
    tests1> playwright test -c playwright.config.js foo1
  `);
});

test('should only create test run if test belongs to context', async ({}, testInfo) => {
  const { vscode, testController, renderExecLog } = await activate(testInfo.outputDir, {
    'tests1/playwright.config.js': `module.exports = { testDir: '.' }`,
    'tests2/playwright.config.js': `module.exports = { testDir: '.' }`,
    'tests1/foo1/bar1/test1.spec.ts': `
      import { test } from '@playwright/test';
      test('one', async () => {});
    `,
    'tests2/foo2/bar2/test2.spec.ts': `
      import { test } from '@playwright/test';
      test('two', async () => {});
    `,
  });

  await testController.expandTestItems(/test2.spec.ts/);
  const profiles = testController.runProfiles.filter(p => p.kind === vscode.TestRunProfileKind.Run);
  const testRuns: TestRun[] = [];
  testController.onDidCreateTestRun(run => testRuns.push(run));
  const items = testController.findTestItems(/two/);
  await Promise.all(profiles.map(p => p.run(items)));
  expect(testRuns).toHaveLength(1);

  expect(renderExecLog('  ')).toBe(`
    tests1> playwright list-files -c playwright.config.js
    tests2> playwright list-files -c playwright.config.js
    tests2> playwright test -c playwright.config.js --list foo2/bar2/test2.spec.ts
    tests2> playwright test -c playwright.config.js foo2/bar2/test2.spec.ts:3
  `);
});

test('should run all projects at once', async ({}, testInfo) => {
  const { vscode, testController, renderExecLog } = await activate(testInfo.outputDir, {
    'playwright.config.js': `module.exports = {
      testDir: './tests',
      projects: [
        { name: 'projectOne' },
        { name: 'projectTwo' },
      ]
    }`,
    'tests/test.spec.ts': `
      import { test } from '@playwright/test';
      test('one', async () => {});
    `,
  });

  const profiles = testController.runProfiles.filter(p => p.kind === vscode.TestRunProfileKind.Run);
  await Promise.all(profiles.map(p => p.run()));

  expect(renderExecLog('  ')).toBe(`
    > playwright list-files -c playwright.config.js
    > playwright test -c playwright.config.js --project=projectOne --project=projectTwo
  `);
});

test('should group projects by config', async ({}, testInfo) => {
  const { vscode, testController, renderExecLog } = await activate(testInfo.outputDir, {
    'tests1/playwright.config.js': `module.exports = {
      projects: [
        { name: 'projectOne' },
        { name: 'projectTwo' },
      ]
    }`,
    'tests2/playwright.config.js': `module.exports = {
      projects: [
        { name: 'projectOne' },
        { name: 'projectTwo' },
      ]
    }`,
    'tests1/test.spec.ts': `
      import { test } from '@playwright/test';
      test('one', async () => {});
    `,
    'tests2/test.spec.ts': `
      import { test } from '@playwright/test';
      test('one', async () => {});
    `,
  });

  const profiles = testController.runProfiles.filter(p => p.kind === vscode.TestRunProfileKind.Run);
  await Promise.all(profiles.map(p => p.run()));

  expect(renderExecLog('  ')).toBe(`
    tests1> playwright list-files -c playwright.config.js
    tests2> playwright list-files -c playwright.config.js
    tests1> playwright test -c playwright.config.js --project=projectOne --project=projectTwo
    tests2> playwright test -c playwright.config.js --project=projectOne --project=projectTwo
  `);
});

test('should stop', async ({}, testInfo) => {
  const { vscode, testController } = await activate(testInfo.outputDir, {
    'playwright.config.js': `module.exports = { testDir: 'tests' }`,
    'tests/test.spec.ts': `
      import { test } from '@playwright/test';
      test('one', async () => { await new Promise(() => {})});
    `,
  });

  const profile = testController.runProfiles.find(p => p.kind === vscode.TestRunProfileKind.Run);
  const testRunPromise = new Promise<TestRun>(f => testController.onDidCreateTestRun(f));
  const runPromise = profile.run();
  const testRun = await testRunPromise;
  await new Promise(f => setTimeout(f, 1000));
  testRun.token.cancel();
  await runPromise;
});

test('should tear down on stop', async ({}, testInfo) => {
  const { vscode, testController } = await activate(testInfo.outputDir, {
    'playwright.config.js': `module.exports = {
      testDir: 'tests',
      globalSetup: './globalSetup.js',
    }`,
    'globalSetup.js': `
      process.stdout.write('RUNNING SETUP');
      module.exports = async () => {
        return async () => {
          await new Promise(f => process.stdout.write('RUNNING TEARDOWN', f));
        }
      };
    `,
    'tests/test.spec.ts': `
      import { test } from '@playwright/test';
      test('one', async () => { await new Promise(() => {})});
    `,
  });

  const profile = testController.runProfiles.find(p => p.kind === vscode.TestRunProfileKind.Run);
  const testRunPromise = new Promise<TestRun>(f => testController.onDidCreateTestRun(f));
  const runPromise = profile.run();
  const testRun = await testRunPromise;

  let output = testRun.renderLog({ output: true });
  while (!output.includes('RUNNING SETUP')) {
    output = testRun.renderLog({ output: true });
    await new Promise(f => setTimeout(f, 100));
  }

  testRun.token.cancel();
  await runPromise;
  expect(testRun.renderLog({ output: true })).toContain('RUNNING TEARDOWN');
});

test('should not remove other tests when running focused test', async ({}, testInfo) => {
  const { testController } = await activate(testInfo.outputDir, {
    'playwright.config.js': `module.exports = { testDir: 'tests' }`,
    'tests/test.spec.ts': `
      import { test } from '@playwright/test';
      test('one', async () => {});
      test('two', async () => {});
      test('three', async () => {});
    `,
  });

  await testController.expandTestItems(/test.spec/);
  const testItems = testController.findTestItems(/two/);
  await testController.run(testItems);

  expect(testController.renderTestTree()).toBe(`
    - tests
      - test.spec.ts
        - one [2:0]
        - two [3:0]
        - three [4:0]
  `);
});

test('should run all parametrized tests', async ({}, testInfo) => {
  const { testController, renderExecLog } = await activate(testInfo.outputDir, {
    'playwright.config.js': `module.exports = { testDir: 'tests' }`,
    'tests/test.spec.ts': `
      import { test } from '@playwright/test';
      for (const name of ['test-one', 'test-two', 'test-three'])
        test(name, async () => {});
    `,
  });

  await testController.expandTestItems(/test.spec/);
  const testItems = testController.findTestItems(/test-/);
  expect(testItems.length).toBe(3);
  const testRun = await testController.run(testItems);

  expect(testRun.renderLog()).toBe(`
    test-one [3:0]
      enqueued
      enqueued
      started
      passed
    test-three [3:0]
      enqueued
      enqueued
      started
      passed
    test-two [3:0]
      enqueued
      enqueued
      started
      passed
  `);

  expect(renderExecLog('  ')).toBe(`
    > playwright list-files -c playwright.config.js
    > playwright test -c playwright.config.js --list tests/test.spec.ts
    > playwright test -c playwright.config.js tests/test.spec.ts:4
  `);
});

test('should run one parametrized test', async ({}, testInfo) => {
  const { testController, renderExecLog } = await activate(testInfo.outputDir, {
    'playwright.config.js': `module.exports = { testDir: 'tests' }`,
    'tests/test.spec.ts': `
      import { test } from '@playwright/test';
      for (const name of ['test one', 'test two', 'test three'])
        test(name, async () => {});
    `,
  });

  await testController.expandTestItems(/test.spec/);
  const testItems = testController.findTestItems(/test two/);
  expect(testItems.length).toBe(1);
  const testRun = await testController.run(testItems);

  expect(testRun.renderLog()).toBe(`
    test two [3:0]
      enqueued
      enqueued
      started
      passed
  `);

  expect(renderExecLog('  ')).toBe(`
    > playwright list-files -c playwright.config.js
    > playwright test -c playwright.config.js --list tests/test.spec.ts
    > playwright test -c playwright.config.js --grep=test two tests/test.spec.ts:4
  `);
});

test('should run one parametrized groups', async ({}, testInfo) => {
  const { testController, renderExecLog } = await activate(testInfo.outputDir, {
    'playwright.config.js': `module.exports = { testDir: 'tests' }`,
    'tests/test.spec.ts': `
      import { test } from '@playwright/test';
      for (const name of ['group one', 'group two', 'group three'])
        test.describe(name, () => {
          test('test one in ' + name, async () => {});
          test('test two in ' + name, async () => {});
        });
    `,
  });

  await testController.expandTestItems(/test.spec/);
  const testItems = testController.findTestItems(/^group three$/);
  expect(testItems.length).toBe(1);
  const testRun = await testController.run(testItems);

  expect(testRun.renderLog()).toBe(`
    test one in group three [4:0]
      enqueued
      enqueued
      started
      passed
    test two in group three [5:0]
      enqueued
      enqueued
      started
      passed
  `);

  expect(renderExecLog('  ')).toBe(`
    > playwright list-files -c playwright.config.js
    > playwright test -c playwright.config.js --list tests/test.spec.ts
    > playwright test -c playwright.config.js --grep=group three tests/test.spec.ts:4
  `);
});

test('should list tests in relative folder', async ({}, testInfo) => {
  const { testController, renderExecLog } = await activate(testInfo.outputDir, {
    'foo/bar/playwright.config.js': `module.exports = { testDir: '../../tests' }`,
    'tests/test.spec.ts': `
      import { test } from '@playwright/test';
      test('one', async () => {});
    `,
  });

  await testController.expandTestItems(/test.spec/);

  expect(renderExecLog('  ')).toBe(`
    foo/bar> playwright list-files -c playwright.config.js
    foo/bar> playwright test -c playwright.config.js --list ../../tests/test.spec.ts
  `);

  expect(testController.renderTestTree()).toBe(`
    - tests
      - test.spec.ts
        - one [2:0]
  `);
});

test('should specify project', async ({}, testInfo) => {
  const { testController, renderExecLog } = await activate(testInfo.outputDir, {
    'playwright.config.js': `module.exports = {
      projects: [
        { testDir: './tests1', name: 'project 1' },
        { testDir: './tests2', name: 'project 2' },
      ]
    }`,
    'tests1/test.spec.ts': `
      import { test } from '@playwright/test';
      test('one', async () => {});
    `,
    'tests2/test.spec.ts': `
      import { test } from '@playwright/test';
      test(two', async () => {});
    `,
  });

  const testItems = testController.findTestItems(/test.spec/);
  expect(testItems.length).toBe(2);
  const testRun = await testController.run(testItems);
  expect(testRun.renderLog()).toBe(`
    one [2:0]
      enqueued
      started
      passed
  `);

  expect(renderExecLog('  ')).toBe(`
    > playwright list-files -c playwright.config.js
    > playwright test -c playwright.config.js --project=project 1 tests1/test.spec.ts
  `);
});

test('should run tests concurrently', async ({}, testInfo) => {
  const { vscode, testController, renderExecLog } = await activate(testInfo.outputDir, {
    'playwright.config.js': `module.exports = { testDir: 'tests' }`,
    'tests/test-1.spec.ts': `
      import { test } from '@playwright/test';
      test('should pass', async () => {});
    `,
  });

  const profile = testController.runProfiles.find(p => p.kind === vscode.TestRunProfileKind.Run);
  const runs = [];
  testController.onDidCreateTestRun(run => runs.push(run));
  await Promise.all([profile.run(), profile.run(), profile.run()]);
  expect(runs).toHaveLength(1);

  expect(renderExecLog('  ')).toBe(`
    > playwright list-files -c playwright.config.js
    > playwright test -c playwright.config.js
  `);
});

test('should report project-specific failures', async ({}, testInfo) => {
  const { vscode, testController, renderExecLog } = await activate(testInfo.outputDir, {
    'playwright.config.js': `module.exports = {
      testDir: 'tests',
      projects: [
        { 'name': 'projectA' },
        { 'name': 'projectB' },
        { 'name': 'projectC' },
      ]
    }`,
    'tests/test.spec.ts': `
      import { test } from '@playwright/test';
      test('should pass', async ({}, testInfo) => {
        throw new Error(testInfo.project.name);
      });
    `,
  });

  const profile = testController.runProfiles.filter(p => p.kind === vscode.TestRunProfileKind.Run);
  const [testRun] = await Promise.all([
    new Promise<TestRun>(f => testController.onDidCreateTestRun(f)),
    ...profile.map(p => p.run()),
  ]);

  expect(renderExecLog('  ')).toBe(`
    > playwright list-files -c playwright.config.js
    > playwright test -c playwright.config.js --project=projectA --project=projectB --project=projectC
  `);

  expect(testRun.renderLog({ messages: true })).toBe(`
    should pass [2:0]
      enqueued
      enqueued
      enqueued
      started
      failed
        test.spec.ts:[3:14 - 3:14]
        Error: projectA
        <br>
            at tests/test.spec.ts:4:15
      started
      failed
        test.spec.ts:[3:14 - 3:14]
        Error: projectB
        <br>
            at tests/test.spec.ts:4:15
      started
      failed
        test.spec.ts:[3:14 - 3:14]
        Error: projectC
        <br>
            at tests/test.spec.ts:4:15
  `);
});

test('should discover tests after running one test', async ({}, testInfo) => {
  const { testController } = await activate(testInfo.outputDir, {
    'playwright.config.js': `module.exports = { testDir: 'tests' }`,
    'tests/test1.spec.ts': `
      import { test } from '@playwright/test';
      test('one', async () => {});
    `,
    'tests/test2.spec.ts': `
      import { test } from '@playwright/test';
      test('two', async () => {});
    `,
  });

  await testController.expandTestItems(/test1.spec.ts/);
  const testItems = testController.findTestItems(/one/);
  const testRun = await testController.run(testItems);

  expect(testRun.renderLog()).toBe(`
    one [2:0]
      enqueued
      enqueued
      started
      passed
  `);

  await testController.expandTestItems(/test2.spec.ts/);

  expect(testController.renderTestTree()).toBe(`
    - tests
      - test1.spec.ts
        - one [2:0]
      - test2.spec.ts
        - two [2:0]
  `);
});

test('should provisionally enqueue nested tests', async ({}, testInfo) => {
  const { testController } = await activate(testInfo.outputDir, {
    'playwright.config.js': `module.exports = { testDir: 'tests' }`,
    'tests/test.spec.ts': `
      import { test } from '@playwright/test';
      test('1', async () => {});
      test('2', async () => {});
      test.describe('group', () => {
        test('3', async () => {});
        test('4', async () => {});  
      });
    `,
  });

  await testController.expandTestItems(/test.spec.ts/);
  const testItems = testController.findTestItems(/test.spec.ts/);
  const testRun = await testController.run(testItems);

  expect(testRun.renderLog()).toBe(`
    1 [2:0]
      enqueued
      enqueued
      started
      passed
    2 [3:0]
      enqueued
      enqueued
      started
      passed
    3 [5:0]
      enqueued
      enqueued
      started
      passed
    4 [6:0]
      enqueued
      enqueued
      started
      passed
  `);
});

test('should run tests for folders above root', async ({}, testInfo) => {
  const { testController } = await activate(testInfo.outputDir, {
    'playwright.config.js': `module.exports = { testDir: 'builder/playwright/tests' }`,
    'builder/playwright/tests/test.spec.ts': `
      import { test } from '@playwright/test';
      test('one', async () => {});
    `,
  });

  const testItems = testController.findTestItems(/builder/);
  const testRun = await testController.run(testItems);

  expect(testRun.renderLog()).toBe(`
    one [2:0]
      enqueued
      started
      passed
  `);
});

test('should show warning when tests do not belong to projects', async ({}, testInfo) => {
  const { vscode, testController, renderExecLog } = await activate(testInfo.outputDir, {
    'tests1/playwright.config.js': `module.exports = { testDir: '.' }`,
    'tests2/playwright.config.js': `module.exports = { testDir: '.' }`,
    'tests1/test1.spec.ts': `
      import { test } from '@playwright/test';
      test('one', async () => {});
    `,
    'tests2/test2.spec.ts': `
      import { test } from '@playwright/test';
      test('two', async () => {});
    `,
  });

  const profile = testController.runProfiles.find(p => p.kind === vscode.TestRunProfileKind.Run);
  let testRuns: TestRun[] = [];
  testController.onDidCreateTestRun(run => testRuns.push(run));

  {
    testRuns = [];
    const items = testController.findTestItems(/test2.spec/);
    await profile.run(items);
  }

  expect(renderExecLog('  ')).toBe(`
    tests1> playwright list-files -c playwright.config.js
    tests2> playwright list-files -c playwright.config.js
  `);

  expect(vscode.warnings[0]).toContain('Selected test is outside of the Default Profile (config)');
});
