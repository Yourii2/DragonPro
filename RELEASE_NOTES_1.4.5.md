# DragonPro Release Notes v1.4.5
**Release Date:** May 10, 2026

## Major Changes

### 🔄 Sales Price Management Refactoring
- **Removed:** `Dragon_sale_price_source` setting has been completely removed from the system
- **Impact:** Product selling prices are **no longer stored in the database**
- **New Behavior:** All order prices are **always sourced from the script/import data**, not from product master data

### ✂️ Product Management Updates
- Removed the "سعر البيع" (Selling Price) field from the **Product Variant Management** modal in InventoryModule
- Removed price editing field from inventory management interface
- The product cost price (سعر الشراء) remains unchanged and is still required

### 🔧 Affected Modules

#### InventoryModule.tsx
- Removed `price` property from `variantFormData` state
- Removed conditional rendering of sales price columns in product stock table
- Removed sales price input field from variant creation/editing forms
- Product history and audit features now only track cost prices

#### SalesModule.tsx  
- All price sources now default to `'order'` mode exclusively
- Removed dead code branches that referenced `saleSource === 'product'`
- Script-provided prices are always preserved without overwriting from product data
- Auto-fill logic simplified: only fills prices when order line is empty

#### SettingsModule.tsx & save_settings.php
- No sales price source setting is stored or displayed
- Settings persist for company info, delivery method, and purchase price type

### ✅ Testing Checklist
- [x] No TypeScript compilation errors
- [x] Inventory module displays correctly without sales price columns
- [x] Variant creation modal works without price field
- [x] Sales order import preserves script prices
- [x] Receiving and returns workflows function normally
- [x] Dev server compiles and runs successfully

### 📝 Technical Notes
- All price handling now assumes script/import is the single source of truth
- Database product records no longer contain sales price data
- Cost prices (procurement) are independent and unchanged
- This change simplifies price management and reduces data redundancy

### 🔗 Related Issues
- Removed unused `salePriceSource` variable references throughout codebase
- Cleaned up conditional rendering based on price source settings

---
**Build:** Vite v6.4.2  
**Platform:** Windows/XAMPP  
**Status:** ✅ Production Ready
