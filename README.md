# Ma Sói Web

Game Ma Sói nhiều người chơi trên trình duyệt. Ứng dụng đóng vai **quản trò tự động**: chia vai, điều khiển ngày/đêm, nhận hành động ban đêm, đếm giờ, kiểm phiếu và công bố kết quả.

**Không có chat và không có voice trong app.** Người chơi nói chuyện trực tiếp (chơi cùng phòng) hoặc qua một cuộc gọi bên ngoài như Discord, Zalo, Meet (chơi từ xa — chủ phòng dán link vào phòng).

- 📄 Kế hoạch chi tiết: [docs/KE_HOACH.md](docs/KE_HOACH.md)
- 🎨 Giao diện thiết kế riêng cho **điện thoại** (lưới + thanh hành động ở đáy) và **máy tính** (3 cột, người chơi xếp vòng tròn, phím tắt)

## Chạy thử

Cần Node 20+ và [pnpm](https://pnpm.io) 10.

```bash
pnpm install
pnpm dev          # web: http://localhost:5173 · server: http://localhost:3000
```

Muốn thử một mình: trong phòng chờ bấm **Thêm bot** (tự bật khi phát triển; ở production phải đặt `ALLOW_BOTS=1`).

### Chạy bản build như production

```bash
pnpm build
PORT=3000 STATIC_DIR=apps/web/dist node apps/server/dist/index.js
# hoặc bằng Docker
docker build -f docker/Dockerfile -t masoi . && docker run -p 3000:3000 masoi
```

### Biến môi trường (server)

| Biến             | Mặc định         | Ý nghĩa                                                        |
| ---------------- | ---------------- | -------------------------------------------------------------- |
| `PORT`           | `3000`           | Cổng lắng nghe                                                 |
| `STATIC_DIR`     | `apps/web/dist`  | Thư mục web đã build                                           |
| `ALLOWED_ORIGIN` | _(cùng origin)_  | Origin được phép kết nối socket khi web chạy ở domain khác     |
| `TRUST_PROXY`    | `0`              | Đặt `1` khi sau reverse proxy để lấy đúng IP (giới hạn tốc độ) |
| `ALLOW_BOTS`     | tắt ở production | Cho phép thêm bot vào phòng (chỉ để thử)                       |
| `TIME_SCALE`     | `1`              | Nhân mọi thời gian của ván (chỉ để thử/E2E, ví dụ `0.15`)      |
| `LOG_LEVEL`      | `info`           | Mức log của pino                                               |

## Cấu trúc

```
packages/shared   Kiểu, cấu hình mặc định, thước cân bằng, giao thức socket (Zod)
packages/engine   Lõi game thuần (không I/O): vai, pha, bỏ phiếu, thắng thua, projection chống lộ vai
apps/server       Fastify + Socket.IO: phòng, kết nối lại, hẹn giờ, giới hạn tốc độ, bot
apps/web          React + Vite + Tailwind: giao diện điện thoại và máy tính
e2e               Playwright: nhiều trình duyệt thật cùng chơi một ván
```

Nguyên tắc: **server quyết định tất cả**; client chỉ gửi ý định và chỉ nhận `PlayerView` đã lọc — không bao giờ nhận vai của người khác.

## Kiểm thử

```bash
pnpm test        # engine (54), server (22), web — unit, kịch bản, property test với bot ngẫu nhiên
pnpm e2e         # cần `pnpm build` trước và `pnpm exec playwright install chromium`
pnpm verify      # typecheck + lint + test + build
```

## Trạng thái

Đã xong M0–M3 của kế hoạch (khung dự án, engine, server, giao diện) cùng E2E và CI. Xem mục "Tiến độ" trong [docs/KE_HOACH.md](docs/KE_HOACH.md) để biết phần còn lại.
