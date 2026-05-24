# GroupXX Design Concepts - Lab 11 PayOrder/VietQR Backend

## 1. Scope

This review/refactor covers only the PayOrder/VietQR backend payment flow.

Touched scope:
- `src/backend/src/payment/**`
- `src/backend/.env.example`
- `GoodDesign/GroupXX-DesignConcepts.md`

Intentionally not touched:
- `src/frontend/**`
- Cart use case
- Place Order use case
- Product, User, Logs, Checkout, Shipping
- Unrelated Order logic
- PayPal behavior, except shared `PaymentModule` registration needed to add VietQR providers

## 2. Coupling Review

| Coupling type | Related payment modules/classes | Old design / issue before refactor | Level before | New design / change after refactor | Level after | Reason | Improvement direction |
|---|---|---|---|---|---|---|---|
| Content Coupling | PayOrder/VietQR backend scope | Not found in PayOrder/VietQR backend scope because there was no existing VietQR code directly modifying another module's internals. | Not found | VietQR code stores payment state through payment repositories and entities only. | Avoided | No controller/service directly changes another module's private data. | Keep Order state changes outside this lab scope unless an explicit payment contract is added. |
| Common Coupling | `VietqrApiClient`, env config | No existing VietQR code. PayPal reads env variables directly, but no shared mutable global VietQR state existed. | Not found | VietQR reads immutable runtime config from environment and does not use static mutable data. | Avoided | Credentials are not stored in global mutable objects or logged. | Consider Nest `ConfigService` if the project standardizes config injection. |
| Control Coupling | Payment controller/service layer | No VietQR gateway existed. A risky design would add a generic payment method flag and switch across gateways. | Not found for VietQR | Added `VietqrController` and `VietqrPaymentService` with dedicated VietQR methods. | Avoided | No large `if/switch` dispatch based on `paymentMethod`. | Split gateway submodules if payment grows further. |
| Stamp Coupling | DTOs, service, repositories | No VietQR DTO existed. A risky design would pass whole Order/Cart objects to payment code. | Not found for VietQR | `CreateVietqrPaymentDto` contains only required `orderId`, `amount`, and `content`; callback DTO contains only required transaction-sync fields. | Data Coupling | Only needed fields cross each boundary. | Add explicit response DTOs later if public API documentation is required. |
| Data Coupling | `VietqrController`, `VietqrPaymentService`, `VietqrRepository`, `VietqrApiClient` | No existing VietQR implementation. | N/A | Controller passes validated DTOs; service passes scalar ids/amount/content; API client maps small VietQR request/response shapes. | Data Coupling | Each module communicates through necessary values only. | Keep external VietQR response shape isolated in `VietqrApiClient`. |

Official VietQR references used:
- Token API: https://api.vietqr.vn/vi/api-vietqr-callback/goi-api-get-token
- Generate QR API: https://api.vietqr.vn/vi/api-vietqr-callback/goi-api-generate-vietqr-code
- Transaction Sync callback: https://api.vietqr.vn/vi/api-vietqr-callback/api-transaction-sync

## 3. Cohesion Review

| Cohesion type | Related payment modules/classes | Old design / issue before refactor | Level before | New design / change after refactor | Level after | Reason | Improvement direction |
|---|---|---|---|---|---|---|---|
| Coincidental Cohesion | PayOrder/VietQR backend scope | Not found because there was no existing VietQR class grouping unrelated behavior. | Not found | VietQR behavior is split by responsibility. | Avoided | Each class has a clear payment-specific purpose. | Keep unrelated checkout/order/cart behavior out of payment classes. |
| Logical Cohesion | Potential gateway payment service | Not found in VietQR scope. A risky design would group all gateways in one service selected by method flags. | Not found | VietQR has its own controller/service/client/repository. | Avoided | The service does not handle PayPal alternatives. | Introduce strategy interfaces only if shared gateway orchestration becomes necessary. |
| Temporal Cohesion | VietQR callback/create flow | Not found in old VietQR scope. A risky design would group setup, API calls, and callback processing only because they happen during payment. | Not found | Create, status, callback, API, and persistence responsibilities are separated. | Avoided | Steps are grouped by purpose, not timing. | Add transaction management if create and QR generation must be atomic. |
| Procedural Cohesion | Payment flow | No VietQR implementation existed. | N/A | `VietqrPaymentService` sequences the PayOrder use case while delegating API and persistence work. | Sequential/Functional | The service coordinates a coherent business flow and each helper class has a single role. | Keep the service from accumulating low-level HTTP or TypeORM logic. |
| Communicational Cohesion | `VietqrRepository`, `VietqrTransaction` | No VietQR persistence existed. | N/A | VietQR repository methods all operate on VietQR transaction records. | Functional | The repository is centered on one data model. | Add DB unique constraints through migrations later. |
| Sequential Cohesion | `VietqrPaymentService` | No VietQR flow existed. | N/A | Create payment performs payment record creation, QR generation, and VietQR record storage in order. Callback verifies then updates status. | Sequential with functional boundary | The service owns the business sequence but delegates single-purpose work. | Add database transaction boundaries for production consistency. |
| Functional Cohesion | `VietqrController`, `VietqrApiClient`, DTOs, repository, entity | No VietQR implementation existed. | N/A | Each new VietQR class has one responsibility: HTTP, business flow, API calls, persistence, validation, or data model. | Functional Cohesion | Responsibilities are small and testable. | Keep PayPal and VietQR behavior independent. |

## 4. Old vs New Comparison

| File/Class | Before | After | Design improvement | Lab concept applied |
|---|---|---|---|---|
| `VietqrController` | Did not exist. | Handles only VietQR HTTP endpoints and DTO validation. | Keeps routing separate from business and API logic. | SRP, Data Coupling, Functional Cohesion |
| `VietqrPaymentService` | Did not exist. | Owns create/status/callback PayOrder business flow. | Centralizes VietQR use-case decisions without gateway switches. | SRP, DIP, avoids Control Coupling |
| `VietqrApiClient` | Did not exist. | Encapsulates VietQR token and QR generation calls. | External API mapping is isolated from service and persistence logic. | Adapter separation, Functional Cohesion |
| `VietqrRepository` | Did not exist. | Persists VietQR transaction records only. | Database operations are not mixed into controller/API client. | SRP, Data Coupling |
| `CreateVietqrPaymentDto`, `VietqrCallbackDto` | Did not exist. | Validate only fields needed by VietQR PayOrder. | Avoids passing whole Order/Cart objects. | Avoids Stamp Coupling |
| `VietqrTransaction` | Did not exist. | Stores QR metadata, references, expiry, paid time, callback snapshot. | Keeps VietQR-specific data out of shared payment record. | High Cohesion, low coupling |
| `PaymentTransaction` | Shared payment entity with PayPal relation and order foreign key. | Keeps gateway-neutral payment state shared by PayPal and VietQR. | Reuses shared payment state without adding VietQR fields to the generic entity. | Data Coupling |
| `PaymentModule` | Registered PayPal providers/entities only. | Registers VietQR providers/entities beside PayPal. | Adds integration through DI without PayPal refactor. | DIP, avoids Control Coupling |

## 5. Changed Files

| File | Reason |
|---|---|
| `src/backend/src/payment/dto/create-vietqr-payment.dto.ts` | Defines narrow creation input for VietQR PayOrder. |
| `src/backend/src/payment/dto/vietqr-callback.dto.ts` | Defines narrow transaction-sync callback input. |
| `src/backend/src/payment/entities/vietqr-transaction.entity.ts` | Stores VietQR-specific QR, reference, expiry, and callback data. |
| `src/backend/src/payment/entities/payment-transaction.entity.ts` | Keeps shared transaction fields and the order foreign key cleanly documented. |
| `src/backend/src/payment/vietqr-api.client.ts` | Encapsulates VietQR token and QR generation API calls. |
| `src/backend/src/payment/vietqr.repository.ts` | Encapsulates VietQR persistence operations. |
| `src/backend/src/payment/vietqr-payment.service.ts` | Implements VietQR PayOrder business flow and idempotent callback handling. |
| `src/backend/src/payment/vietqr.controller.ts` | Adds VietQR create/status/callback endpoints. |
| `src/backend/src/payment/payment.repository.ts` | Adds minimal shared transaction lookup and idempotent status update support. |
| `src/backend/src/payment/payment.module.ts` | Registers VietQR providers/entities/controllers. |
| `src/backend/.env.example` | Documents required VietQR sandbox placeholders. |
| `GoodDesign/GroupXX-DesignConcepts.md` | Lab 11 coupling/cohesion report for PayOrder/VietQR backend. |

## 6. Manual Testing Guidance

Manual testing is used for this Lab 11 VietQR flow because the important behavior depends on sandbox credentials and callback behavior from VietQR.

Recommended flow:
- Start the backend.
- Start ngrok with `ngrok http 3000`.
- Create a payment with `POST https://<ngrok-url>/api/vietqr/payments` and body `{ "orderId": 2, "amount": 50000, "content": "PAYORDER1" }`.
- If VietQR credentials are missing or invalid, the API should return a VietQR token/generate error and the created `payment_transactions` row should be marked `FAILED`.
- If VietQR credentials are valid, the API should create both `payment_transactions` and `vietqr_transactions`, then return QR fields and payment status.
- Send a matching callback to `POST https://<ngrok-url>/api/vietqr/payments/callback`.
- Check status with `GET https://<ngrok-url>/api/vietqr/payments/<paymentId>/status`.

PDF export was not added as a dependency. If a local PDF tool is available, this Markdown report can be exported without changing source code.
