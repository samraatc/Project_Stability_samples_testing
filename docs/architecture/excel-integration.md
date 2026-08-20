# Excel Integration Architecture

## Overview

The Enterprise Stability Management System (ESMS) provides Excel and CSV reporting capabilities. Reports present horizontal matrix layouts of stability study protocols and pull schedules across testing timepoints (3M, 6M, 9M, 12M, 15M, 18M, 21M, 24M, 27M, 30M, 33M, 36M).

## Key Features & Layout

### 1. Excel XML Format (`.xls`)
- Utilizes Microsoft Office Spreadsheet XML (`xmlns="urn:schemas-microsoft-com:office:spreadsheet"`).
- Generates structured workbooks with auto-fitted column widths based on maximum string lengths.
- Features styled header rows, company banners (`National Health care Private limited`), merged title cells, and formatted date values (`MMM/YYYY` and `DD/MM/YYYY`).

### 2. Header Layout
The standard Excel export header row includes:
- `Category`
- `Name of the Product`
- `Batch Code` (or `Batch No`)
- `Quantity`
- `Mfg Date`
- `Exp Date`
- `Charging Date`
- `3Month`, `6Month`, `9Month`, `12Month`, `15Month`, `18Month`, `21Month`, `24Month`, `27Month`, `30Month`, `33Month`, `36Month`
- `Status`
- `Remarks`

### 3. Data Mapping & Formatting
- **Batch Code Mapping**: Maps directly to `s.batch?.batchCode || (s.batch as any)?.batchNo || ''`.
- **Date Calculation**: Target pull dates are computed relative to sample charging dates (`chargingDate` + `interval months`).
- **Data Safety**: Export processes read active catalog records without altering database fields or removing underlying records.
- **Field Disabling**: Storage Conditions and Chamber Conditions are excluded from active Excel export headers and rows per system compliance requirements.
