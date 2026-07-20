import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from '@playwright/test';

import { CODEGEN_CONTEXT_OPTIONS, CODEGEN_URL } from './codegen.mjs';

const CAPTURE_BINDING_NAME = '__codexCaptureAction';
const REPOSITORY_ROOT = fileURLToPath(new URL('..', import.meta.url));
export const DEFAULT_CAPTURE_ROOT = path.join(REPOSITORY_ROOT, 'playwright-captures');

const USAGE = `用法：
  npm run capture:case -- POS-16324
  npm run capture:case -- ORDER-PAGE-014 --dry-run

操作完成后请在 Playwright Inspector 中点击 Resume，采集器会保存 Trace、HAR、截图、DOM 契约和操作草稿。`;

function quote(value) {
  return `'${String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
    .replaceAll('\r', '\\r')
    .replaceAll('\n', '\\n')}'`;
}

export function normalizeCaseKey(value) {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (!normalized) {
    throw new Error('必须提供用例编号，例如 POS-16324。');
  }

  if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(normalized)) {
    throw new Error('用例编号仅支持字母、数字、点、下划线和连字符。');
  }

  return normalized;
}

export function parseCaptureArgs(args) {
  let caseKey = null;
  let dryRun = false;
  let help = false;

  for (const argument of args) {
    if (argument === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (argument === '--help' || argument === '-h') {
      help = true;
      continue;
    }

    if (argument.startsWith('-')) {
      throw new Error(`未知参数：${argument}`);
    }

    if (caseKey) {
      throw new Error(`只能提供一个用例编号，额外参数：${argument}`);
    }

    caseKey = normalizeCaseKey(argument);
  }

  if (!help && !caseKey) {
    throw new Error('必须提供用例编号，例如 POS-16324。');
  }

  return { caseKey, dryRun, help };
}

export function createCapturePaths({ caseKey, now = new Date(), outputRoot = DEFAULT_CAPTURE_ROOT }) {
  const timestamp = now.toISOString().replaceAll(':', '-').replace('.', '-');
  const outputDir = path.join(outputRoot, normalizeCaseKey(caseKey), timestamp);

  return {
    actions: path.join(outputDir, 'actions.json'),
    console: path.join(outputDir, 'console.log'),
    dom: path.join(outputDir, 'visible-dom.json'),
    evidence: path.join(outputDir, 'evidence.md'),
    finalScreenshot: path.join(outputDir, 'final.png'),
    har: path.join(outputDir, 'network.har'),
    metadata: path.join(outputDir, 'metadata.json'),
    network: path.join(outputDir, 'network-summary.json'),
    outputDir,
    recordedScript: path.join(outputDir, 'recorded.spec.ts'),
    trace: path.join(outputDir, 'trace.zip'),
  };
}

export function createCaptureContextOptions(paths) {
  return {
    ...CODEGEN_CONTEXT_OPTIONS,
    extraHTTPHeaders: { ...CODEGEN_CONTEXT_OPTIONS.extraHTTPHeaders },
    recordHar: {
      content: 'omit',
      mode: 'minimal',
      path: paths.har,
    },
  };
}

function renderScope(frameSelectors) {
  return frameSelectors.reduce(
    (scope, selector) => `${scope}.locator(${quote(selector)}).contentFrame()`,
    'page',
  );
}

function renderLocator(scope, locator) {
  if (locator.kind === 'testId') {
    return `${scope}.getByTestId(${quote(locator.value)})`;
  }

  if (locator.kind === 'label') {
    return `${scope}.getByLabel(${quote(locator.value)}, { exact: true })`;
  }

  if (locator.kind === 'role') {
    return `${scope}.getByRole(${quote(locator.role)}, { name: ${quote(locator.name)}, exact: true })`;
  }

  if (locator.kind === 'text') {
    return `${scope}.getByText(${quote(locator.value)}, { exact: true })`;
  }

  return `${scope}.locator(${quote(locator.value)})`;
}

function renderAction(action) {
  const target = renderLocator(renderScope(action.frameSelectors ?? []), action.locator);

  if (action.type === 'fill') {
    return `  await ${target}.fill(${quote(action.value ?? '')});`;
  }

  if (action.type === 'selectOption') {
    return `  await ${target}.selectOption(${quote(action.value ?? '')});`;
  }

  return `  await ${target}.click();`;
}

export function renderRecordedScript(caseKey, actions) {
  const actionLines = actions.length > 0
    ? actions.map(renderAction)
    : ['  // 未采集到操作；请检查是否在 Inspector 中点击 Resume 后结束。'];

  return [
    "import { test } from '@playwright/test';",
    '',
    `test(${quote(`${normalizeCaseKey(caseKey)}：待整理的采集脚本`)}, async ({ page }) => {`,
    `  await page.goto(${quote(CODEGEN_URL)});`,
    ...actionLines,
    '});',
    '',
  ].join('\n');
}

async function describeFrameSelectors(frame) {
  const selectors = [];
  let currentFrame = frame;

  while (currentFrame.parentFrame()) {
    const frameElement = await currentFrame.frameElement();
    const selector = await frameElement.evaluate((element) => {
      const escapeAttribute = (value) => String(value).replaceAll('"', '\\"');
      const parentId = element.parentElement?.id;
      if (parentId) {
        return `#${CSS.escape(parentId)} iframe`;
      }

      const elementId = element.id;
      if (elementId) {
        return `iframe#${CSS.escape(elementId)}`;
      }

      const wujieId = element.getAttribute('data-wujie-id');
      if (wujieId) {
        return `iframe[data-wujie-id="${escapeAttribute(wujieId)}"]`;
      }

      const name = element.getAttribute('name');
      if (name) {
        return `iframe[name="${escapeAttribute(name)}"]`;
      }

      return 'iframe';
    });

    selectors.unshift(selector);
    currentFrame = currentFrame.parentFrame();
  }

  return selectors;
}

async function installActionCapture(context, capturedActions) {
  await context.exposeBinding(CAPTURE_BINDING_NAME, async (source, action) => {
    const frameSelectors = await describeFrameSelectors(source.frame).catch(() => []);
    capturedActions.push({
      ...action,
      capturedAt: new Date().toISOString(),
      frameSelectors,
      frameUrl: source.frame.url(),
    });
  });

  await context.addInitScript((bindingName) => {
    const normalizeText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
    const roleByTagName = {
      BUTTON: 'button',
      INPUT: 'textbox',
      SELECT: 'combobox',
      TEXTAREA: 'textbox',
    };

    const findInteractiveElement = (eventTarget) => {
      if (!(eventTarget instanceof Element)) {
        return null;
      }

      return eventTarget.closest(
        '[data-testid], [data-test-id], button, input, textarea, select, [role="button"], [role="menuitem"], [role="textbox"], [role="checkbox"], [role="radio"]',
      ) ?? eventTarget;
    };

    const describeElement = (element) => {
      const testId = element.getAttribute('data-testid') ?? element.getAttribute('data-test-id');
      if (testId) {
        return { kind: 'testId', value: testId };
      }

      const labels = 'labels' in element ? Array.from(element.labels ?? []) : [];
      const label = normalizeText(labels[0]?.textContent);
      if (label) {
        return { kind: 'label', value: label };
      }

      const role = element.getAttribute('role') ?? roleByTagName[element.tagName];
      const accessibleName = normalizeText(
        element.getAttribute('aria-label') ??
          element.getAttribute('title') ??
          element.textContent ??
          element.getAttribute('placeholder'),
      );
      if (role && accessibleName) {
        return { kind: 'role', name: accessibleName.slice(0, 200), role };
      }

      if (element.id) {
        return { kind: 'css', value: `#${CSS.escape(element.id)}` };
      }

      const text = normalizeText(element.textContent);
      if (text) {
        return { kind: 'text', value: text.slice(0, 200) };
      }

      return { kind: 'css', value: element.tagName.toLowerCase() };
    };

    const emit = (payload) => {
      const binding = globalThis[bindingName];
      if (typeof binding === 'function') {
        void binding(payload);
      }
    };

    document.addEventListener(
      'click',
      (event) => {
        const element = findInteractiveElement(event.target);
        if (!element) {
          return;
        }

        emit({ locator: describeElement(element), type: 'click' });
      },
      true,
    );

    document.addEventListener(
      'change',
      (event) => {
        const element = findInteractiveElement(event.target);
        if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) {
          return;
        }

        if (element instanceof HTMLInputElement && ['checkbox', 'radio', 'button', 'submit'].includes(element.type)) {
          return;
        }

        const isPassword = element instanceof HTMLInputElement && element.type === 'password';
        emit({
          locator: describeElement(element),
          type: element instanceof HTMLSelectElement ? 'selectOption' : 'fill',
          value: isPassword ? '<MASKED>' : element.value,
        });
      },
      true,
    );
  }, CAPTURE_BINDING_NAME);
}

function sanitizeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return rawUrl;
  }
}

async function collectVisibleDom(page) {
  const frames = [];

  for (const frame of page.frames()) {
    const frameSelectors = await describeFrameSelectors(frame).catch(() => []);
    const elements = await frame
      .evaluate(() => {
        const isVisible = (element) => {
          const style = window.getComputedStyle(element);
          const box = element.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
        };

        return Array.from(document.querySelectorAll('[data-testid], [data-test-id]'))
          .filter(isVisible)
          .slice(0, 1_000)
          .map((element) => ({
            ariaLabel: element.getAttribute('aria-label'),
            role: element.getAttribute('role'),
            tagName: element.tagName.toLowerCase(),
            testId: element.getAttribute('data-testid') ?? element.getAttribute('data-test-id'),
            text: String(element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 200),
          }));
      })
      .catch(() => []);

    frames.push({ elements, frameSelectors, url: sanitizeUrl(frame.url()) });
  }

  return frames;
}

function renderEvidence({ caseKey, completedNormally, paths, actions, networkEvents, artifactErrors }) {
  return [
    `# ${caseKey} Playwright 采集证据`,
    '',
    `- 正常结束：${completedNormally ? '是' : '否；可能是直接关闭了浏览器，部分 Trace/HAR 文件可能不完整'}`,
    `- 操作数：${actions.length}`,
    `- 网络事件数：${networkEvents.length}`,
    `- 采集异常数：${artifactErrors.length}`,
    '',
    '## 文件',
    '',
    `- 操作草稿：\`${path.basename(paths.recordedScript)}\``,
    `- 原始操作：\`${path.basename(paths.actions)}\``,
    `- Trace：\`${path.basename(paths.trace)}\``,
    `- HAR：\`${path.basename(paths.har)}\`（默认不保存响应正文）`,
    `- 可见 DOM：\`${path.basename(paths.dom)}\``,
    `- 最终截图：\`${path.basename(paths.finalScreenshot)}\``,
    `- 网络摘要：\`${path.basename(paths.network)}\``,
    '',
    '将整个目录路径和主要校验点交给 Codex 即可继续整理正式 Page/Flow/Test。',
    '',
    ...(artifactErrors.length > 0
      ? ['## 采集异常', '', ...artifactErrors.map((message) => `- ${message}`), '']
      : []),
  ].join('\n');
}

export async function runCaseCapture(
  { caseKey, now = new Date(), outputRoot = DEFAULT_CAPTURE_ROOT },
  browserType = chromium,
) {
  const normalizedCaseKey = normalizeCaseKey(caseKey);
  const paths = createCapturePaths({ caseKey: normalizedCaseKey, now, outputRoot });
  await mkdir(paths.outputDir, { recursive: true });

  const actions = [];
  const consoleEvents = [];
  const networkEvents = [];
  const artifactErrors = [];
  const browser = await browserType.launch({ headless: false });
  let context;
  let page;
  let pauseReached = false;
  let completedNormally = false;
  let captureError;

  try {
    context = await browser.newContext(createCaptureContextOptions(paths));
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    await installActionCapture(context, actions);
    page = await context.newPage();

    page.on('console', (message) => {
      consoleEvents.push(`[${new Date().toISOString()}] ${message.type()}: ${message.text()}`);
    });
    page.on('pageerror', (error) => {
      consoleEvents.push(`[${new Date().toISOString()}] pageerror: ${error.message}`);
    });
    page.on('requestfailed', (request) => {
      networkEvents.push({
        error: request.failure()?.errorText ?? 'unknown',
        method: request.method(),
        type: 'requestfailed',
        url: sanitizeUrl(request.url()),
      });
    });
    page.on('response', (response) => {
      const request = response.request();
      if (!['fetch', 'xhr'].includes(request.resourceType()) && response.status() < 400) {
        return;
      }

      networkEvents.push({
        method: request.method(),
        resourceType: request.resourceType(),
        status: response.status(),
        type: 'response',
        url: sanitizeUrl(response.url()),
      });
    });

    await page.goto(CODEGEN_URL);
    console.log(`\n采集目录：${paths.outputDir}`);
    console.log('请操作目标业务步骤；结束时在 Playwright Inspector 中点击 Resume。\n');
    pauseReached = true;
    await page.pause();
    completedNormally = true;
  } catch (error) {
    if (!pauseReached || browser.isConnected()) {
      captureError = error;
    }
  } finally {
    let visibleDom = [];

    if (page && !page.isClosed()) {
      visibleDom = await collectVisibleDom(page).catch((error) => {
        artifactErrors.push(`可见 DOM 保存失败：${error.message}`);
        return [];
      });
      await page.screenshot({ fullPage: true, path: paths.finalScreenshot }).catch((error) => {
        artifactErrors.push(`最终截图保存失败：${error.message}`);
      });
    }

    if (context && browser.isConnected()) {
      await context.tracing.stop({ path: paths.trace }).catch((error) => {
        artifactErrors.push(`Trace 保存失败：${error.message}`);
      });
      await context.close().catch((error) => {
        artifactErrors.push(`浏览器上下文关闭失败：${error.message}`);
      });
    } else if (context) {
      artifactErrors.push('浏览器被直接关闭，Trace 或 HAR 可能没有完整写入。');
    }

    await writeFile(paths.actions, `${JSON.stringify(actions, null, 2)}\n`, 'utf8');
    await writeFile(paths.console, `${consoleEvents.join('\n')}\n`, 'utf8');
    await writeFile(paths.dom, `${JSON.stringify(visibleDom, null, 2)}\n`, 'utf8');
    await writeFile(paths.network, `${JSON.stringify(networkEvents, null, 2)}\n`, 'utf8');
    await writeFile(paths.recordedScript, renderRecordedScript(normalizedCaseKey, actions), 'utf8');
    await writeFile(
      paths.metadata,
      `${JSON.stringify({
        caseKey: normalizedCaseKey,
        completedNormally,
        createdAt: now.toISOString(),
        url: CODEGEN_URL,
      }, null, 2)}\n`,
      'utf8',
    );
    await writeFile(
      paths.evidence,
      `${renderEvidence({
        actions,
        artifactErrors,
        caseKey: normalizedCaseKey,
        completedNormally,
        networkEvents,
        paths,
      })}\n`,
      'utf8',
    );

    if (browser.isConnected()) {
      await browser.close();
    }
  }

  if (captureError) {
    throw captureError;
  }

  console.log(`采集完成：${paths.outputDir}`);
  return paths;
}

async function main() {
  const options = parseCaptureArgs(process.argv.slice(2));
  if (options.help) {
    console.log(USAGE);
    return;
  }

  const paths = createCapturePaths({ caseKey: options.caseKey });
  if (options.dryRun) {
    console.log(JSON.stringify({ caseKey: options.caseKey, outputDir: paths.outputDir }, null, 2));
    return;
  }

  await runCaseCapture({ caseKey: options.caseKey });
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';

if (import.meta.url === entryUrl) {
  try {
    await main();
  } catch (error) {
    console.error('用例证据采集失败：', error.message);
    console.error(USAGE);
    process.exitCode = 1;
  }
}
