import { devices, expect, test } from '@playwright/test';
import { autopilotUntilOver, newPlayer, phaseOf } from './helpers';

const phone = devices['Pixel 7'];

test('5 người thật trên điện thoại cùng chơi hết một ván qua giao diện', async ({ browser }) => {
  const errors: string[] = [];
  const leaks: string[] = [];
  const names = ['Minh', 'Lan', 'Hùng', 'Thảo', 'Bảo'];
  const contexts = await Promise.all(names.map(() => browser.newContext({ ...phone })));
  const pages = await Promise.all(contexts.map((c) => newPlayer(c, errors, leaks)));

  // Chủ phòng tạo phòng, mã phòng lấy từ ô hiển thị.
  const host = pages[0]!;
  await host.goto('/');
  await host.fill('input[autocomplete="nickname"]', names[0]!);
  await host.getByRole('button', { name: 'Tạo phòng' }).last().click();
  await expect(host.getByText('Mã phòng').first()).toBeVisible();
  const code = (
    await host.locator('.font-display.tracking-\\[0\\.2em\\]').first().innerText()
  ).trim();
  expect(code).toMatch(/^[A-HJ-NP-Z]{5}$/);

  // Những người còn lại vào bằng link mời /r/CODE (kiểm tra luôn việc điền sẵn mã phòng).
  for (let i = 1; i < pages.length; i++) {
    const p = pages[i]!;
    await p.goto(`/r/${code}`);
    await expect(p.locator('input[placeholder="KH7QX"]')).toHaveValue(code);
    await p.fill('input[autocomplete="nickname"]', names[i]!);
    await p.getByRole('button', { name: 'Vào phòng' }).last().click();
    await expect(p.getByRole('button', { name: 'Sẵn sàng', exact: true })).toBeVisible();
    await p.getByRole('button', { name: 'Sẵn sàng', exact: true }).click();
  }

  await expect(host.getByText('Người chơi (5/20)').first()).toBeVisible();
  // Tên trùng bị từ chối
  const dupCtx = await browser.newContext({ ...phone });
  const dup = await dupCtx.newPage();
  await dup.goto(`/r/${code}`);
  await dup.fill('input[autocomplete="nickname"]', names[1]!.toUpperCase());
  await dup.getByRole('button', { name: 'Vào phòng' }).last().click();
  await expect(dup.getByText('Tên này đã có người dùng')).toBeVisible();
  await dupCtx.close();

  const start = host.getByRole('button', { name: 'Bắt đầu ván' });
  await expect(start).toBeEnabled();
  await start.click();

  for (const p of pages) await expect(p.locator('main[data-phase]')).toBeVisible();

  // Tải lại trang giữa ván: phải vào lại đúng ván nhờ token đã lưu.
  await pages[2]!.waitForTimeout(500);
  await pages[2]!.reload();
  await expect(pages[2]!.locator('main[data-phase]')).toBeVisible();

  await Promise.all(pages.map((p) => autopilotUntilOver(p)));

  // Mọi người thấy cùng một kết quả.
  const titles = await Promise.all(
    pages.map((p) => p.getByRole('heading', { level: 2 }).first().innerText()),
  );
  expect(new Set(titles).size).toBe(1);
  expect(titles[0]).toMatch(/thắng|Hòa/);

  // Không ai bị lộ vai khi ván đang diễn ra; không có lỗi trình duyệt.
  expect(leaks, leaks.join('\n')).toEqual([]);
  expect(
    errors.filter((e) => !e.includes('favicon')),
    errors.join('\n'),
  ).toEqual([]);

  // Chơi lại: chủ phòng về phòng chờ, mọi người theo về.
  await host.getByRole('button', { name: 'Chơi lại' }).click();
  for (const p of pages) await expect(p.getByText(/Người chơi \(5\/20\)/).first()).toBeVisible();

  await Promise.all(contexts.map((c) => c.close()));
});

test('máy tính: 1 người + bot, bố cục 3 cột, phím tắt và sổ tay', async ({ browser }) => {
  const errors: string[] = [];
  const leaks: string[] = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await newPlayer(context, errors, leaks);
  await page.goto('/');
  await page.fill('input[autocomplete="nickname"]', 'Chủ phòng');
  await page.getByRole('button', { name: 'Tạo phòng' }).last().click();
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Thêm bot' }).click();
  await expect(page.getByText('Người chơi (7/20)').first()).toBeVisible();
  // Máy tính: cột cấu hình hiện cạnh danh sách, có mã QR.
  await expect(page.getByRole('img', { name: /Mã QR/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cấu hình' })).toBeVisible();
  await page.getByRole('button', { name: 'Bắt đầu ván' }).click();

  await expect(page.locator('main[data-phase="ROLE_REVEAL"]')).toBeVisible();
  // Giữ Space để lật bài
  await page.keyboard.down('Space');
  await expect(page.getByText(/Phe (Dân làng|Ma sói)/).first()).toBeVisible();
  await page.keyboard.up('Space');
  await page.getByRole('button', { name: 'Đã hiểu', exact: true }).click();

  await expect(page.locator('main[data-phase="NIGHT"]')).toBeVisible();
  // Sổ tay luôn mở ở cột phải, danh sách người chơi ở cột trái.
  await expect(page.getByRole('heading', { name: 'Sổ tay' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Diễn biến' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Người chơi \(7\)/ })).toBeVisible();

  // Phím tắt: nhấn 1 để chọn người đầu tiên trong vòng tròn.
  if ((await page.locator('button[aria-pressed]:not([disabled])').count()) > 0) {
    await page.keyboard.press('1');
    await expect(page.locator('button[aria-pressed="true"]').first()).toBeVisible();
    await page.keyboard.press('Escape');
  }

  await autopilotUntilOver(page);
  expect(await phaseOf(page)).toBe('GAME_OVER');
  expect(leaks, leaks.join('\n')).toEqual([]);
  expect(
    errors.filter((e) => !e.includes('favicon')),
    errors.join('\n'),
  ).toEqual([]);
  await context.close();
});
