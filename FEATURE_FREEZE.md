# Nusantara Drink — Feature Freeze

## Status
Verified working features are considered FROZEN.

## Rule
Future feature work must be additive and must not rewrite, remove, or alter verified behavior unless the user explicitly requests a change.

## Frozen areas
- Customer authentication and account/profile flow
- Customer addresses and GPS location
- Product catalog and cart
- Checkout
- Automatic distance and shipping fee calculation
- Payment method selection
- Cash / bank transfer / QRIS / E-Wallet flows
- Customer orders and order history
- Order status flow
- Automatic stock deduction
- Stock restoration on cancellation
- Product/inventory management
- Customer management
- Payment/refund management
- Shift management
- Store location settings
- Customer order tracking map
- Courier access control and courier tracking
- Courier status flow: confirmed -> shipped -> delivered
- Owner dashboard analytics
- Wishlist / Favorit
- Promo / Voucher
- Supabase RLS and security hardening
- Xendit payment/session/webhook/refund integration

## Change protocol
1. Do not modify a frozen flow to add an unrelated feature.
2. Prefer new functions, new tables, new UI sections, or isolated modules.
3. Before changing shared code, inspect the existing implementation and preserve its behavior.
4. After every change, test the affected feature and its dependent frozen flows.
5. Never remove security/RLS protections to make a feature work.
6. If a frozen feature must change, explicitly tell the user what will change and why before applying it.

## Regression rule
A new feature is not considered complete until the previously working related flow still works.

This file is a project-level guardrail, not a substitute for GitHub branch protection or automated tests.


## Refund Manual — VERIFIED & FROZEN
- Refund otomatis Xendit tetap digunakan untuk channel yang didukung.
- Jika Xendit menolak karena channel tidak mendukung refund, Owner/Admin dapat menggunakan Refund Manual.
- Refund Manual hanya dapat dikonfirmasi untuk payment `paid` dengan `refund_status=failed`.
- Konfirmasi manual mengubah payment dan order menjadi `refunded`, mencatat nominal/alasan, dan membuat audit log.
- Refund Manual tidak mengubah atau membypass refund otomatis Xendit.
- Perubahan berikutnya harus additive dan tidak boleh mengubah alur refund yang sudah terverifikasi tanpa persetujuan eksplisit user.
