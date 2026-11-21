# Pokiwar Web Remake (16:9 Spine 2D Edition)

Dự án phục dựng **Pokiwar** theo phong cách **PokiGuard / Pukiwo** trên nền Web hiện đại (**React + PixiJS v7 + pixi-spine 3.7 + Fastify WebSocket**), sử dụng tài nguyên Spine 2D Pet, ảnh nền và âm thanh kéo từ CDN Aola Star (`tools/fetch_assets.py`).

## Cấu trúc dự án
- `packages/shared` (`@pokiwar/shared`): Logic bàn cờ Match-3 (6 loại ngọc chuẩn: Kiếm, Sét, Lửa, Máu, Âm Dương, Vàng), Ngũ Hành, Combat Engine, AI Bot, 8 Pet Spine & 5 ải PvE.
- `apps/client` (`@pokiwar/client`): Game Client 16:9 (`1280×720`) với Spine 2D Pet animation, Sảnh thành phố không gian, màn hình Nâng cấp & Tiến hóa, và Đấu trường đối kháng.
- `apps/server` (`@pokiwar/server`): Server Fastify + WebSocket (`/ws`) xác thực PvP thời gian thực.
- `tools/fetch_assets.py`: Script tải asset Spine 3.7 Pet, ảnh nền, icon hệ và nhạc nền vào `apps/client/public/assets/`.

## Chạy ở máy local

```bash
pnpm install
pnpm --filter @pokiwar/shared build
pnpm dev
```

- Web Client: http://localhost:5173
- Game Server & WebSocket: http://localhost:3001

## Kiểm thử & Build

```bash
pnpm test
pnpm typecheck
pnpm build
```
