// Data-only ERP asset-import column schemas (design spec §3.3, scope change 2026-07-06).
// Each builder returns [{header, source, required, include}] in the ERP's OFFICIAL
// column order. `source` names the app catalogue field (a canonical CSV_HEADERS entry
// from shared/domain/csv.js) that fills the column on ISO-reproject export; 'custom'
// columns export blank. No app logic lives here.
function col(header, source, required, include){
  return { header, source: source || 'custom', required: !!required, include: include !== false };
}
function seq(out, prefix, from, to){ for(let i = from; i <= to; i++) out.push(col(prefix + i)); return out; }

// Oracle Fusion Cloud Financials 25C FBDI — FixedAssetMassAdditionsImportTemplate.xlsm,
// sheet FA_MASS_ADDITIONS (header row 4): 422 columns; the template's 7 *-required
// columns are flagged. Dates are YYYY/MM/DD per FaMassAdditions.ctl.
// Sources: docs.oracle.com/en/cloud/saas/financials/25c/oefbf/fixedassetmassadditionsimport-3081.html
//   oracle.com/webfolder/technetwork/docs/fbdi-25c/fbdi/xlsm/FixedAssetMassAdditionsImportTemplate.xlsm
//   oracle.com/webfolder/technetwork/docs/fbdi-25c/fbdi/controlfiles/FaMassAdditions.ctl
export function oracleClassicColumns(){
  const c = [];
  c.push(col('Interface Line Number', 'custom', true));            // 1
  c.push(col('Asset Book', 'custom', true));                       // 2
  c.push(col('Transaction Name'));                                 // 3
  c.push(col('Asset Number', 'ASSET NO (AUTO)'));                  // 4
  c.push(col('Asset Description', 'ASSET NAME (AUTO)', true));     // 5
  c.push(col('Tag Number', 'ASSET / TAG NAME'));                   // 6
  c.push(col('Manufacturer', 'MAKE'));                             // 7
  c.push(col('Serial Number', 'SERIAL NO.'));                      // 8
  c.push(col('Model', 'MODEL'));                                   // 9
  c.push(col('Asset Type'));                                       // 10
  c.push(col('Cost', 'custom', true));                             // 11
  c.push(col('Date Placed in Service', 'ACQUIRED DATE'));          // 12
  c.push(col('Prorate Convention'));                               // 13
  c.push(col('Asset Units', 'custom', true));                      // 14
  for(let i = 1; i <= 7; i++) c.push(col('Asset Category Segment' + i));   // 15-21
  c.push(col('Posting Status', 'custom', true));                   // 22
  c.push(col('Queue Name'));                                       // 23
  c.push(col('Feeder System'));                                    // 24
  c.push(col('Parent Asset Number', 'SELECT PARENT ASSET'));       // 25
  c.push(col('Add to Asset Number'));                              // 26
  for(let i = 1; i <= 10; i++) c.push(col('Asset Key Segment' + i));       // 27-36
  c.push(col('In physical inventory'));                            // 37
  c.push(col('Property Type'));                                    // 38
  c.push(col('Property Class'));                                   // 39
  c.push(col('In use'));                                           // 40
  c.push(col('Ownership'));                                        // 41
  c.push(col('Bought'));                                           // 42
  c.push(col('Material Indicator'));                               // 43
  c.push(col('Commitment'));                                       // 44
  c.push(col('Investment Law'));                                   // 45
  c.push(col('Amortize'));                                         // 46
  c.push(col('Amortization Start Date'));                          // 47
  c.push(col('Depreciate', 'custom', true));                       // 48
  c.push(col('Salvage Value Type'));                               // 49
  c.push(col('Salvage Value Amount'));                             // 50
  c.push(col('Salvage Value Percent'));                            // 51
  c.push(col('YTD Depreciation'));                                 // 52
  c.push(col('Depreciation Reserve'));                             // 53
  c.push(col('YTD Bonus Depreciation'));                           // 54
  c.push(col('Bonus Depreciation Reserve'));                       // 55
  c.push(col('YTD Impairment'));                                   // 56
  c.push(col('Impairment Reserve'));                               // 57
  c.push(col('Depreciation Method'));                              // 58
  c.push(col('Life in Months'));                                   // 59
  c.push(col('Basic Rate'));                                       // 60
  c.push(col('Adjusted Rate'));                                    // 61
  c.push(col('Unit of Measure'));                                  // 62
  c.push(col('Production Capacity'));                              // 63
  c.push(col('Ceiling Type'));                                     // 64
  c.push(col('Bonus Rule'));                                       // 65
  c.push(col('Cash Generating Unit'));                             // 66
  c.push(col('Depreciation Limit Type'));                          // 67
  c.push(col('Depreciation Limit Percent'));                       // 68
  c.push(col('Depreciation Limit Amount'));                        // 69
  c.push(col('Invoice Cost'));                                     // 70
  for(let i = 1; i <= 30; i++) c.push(col('Cost Clearing Account Segment' + i)); // 71-100
  seq(c, 'ATTRIBUTE', 1, 30);                                      // 101-130 asset DFF
  seq(c, 'ATTRIBUTE_NUMBER', 1, 5);                                // 131-135
  seq(c, 'ATTRIBUTE_DATE', 1, 5);                                  // 136-140
  c.push(col('ATTRIBUTE_CATEGORY_CODE'));                          // 141
  c.push(col('Context'));                                          // 142
  seq(c, 'TH_ATTRIBUTE', 1, 15);                                   // 143-157 txn-header DFF
  seq(c, 'TH_ATTRIBUTE_NUMBER', 1, 5);                             // 158-162
  seq(c, 'TH_ATTRIBUTE_DATE', 1, 5);                               // 163-167
  c.push(col('TH_ATTRIBUTE_CATEGORY_CODE'));                       // 168
  seq(c, 'TH2_ATTRIBUTE', 1, 15);                                  // 169-183
  seq(c, 'TH2_ATTRIBUTE_NUMBER', 1, 5);                            // 184-188
  seq(c, 'TH2_ATTRIBUTE_DATE', 1, 5);                              // 189-193
  c.push(col('TH2_ATTRIBUTE_CATEGORY_CODE'));                      // 194
  seq(c, 'AI_ATTRIBUTE', 1, 15);                                   // 195-209 asset-invoice DFF
  seq(c, 'AI_ATTRIBUTE_NUMBER', 1, 5);                             // 210-214
  seq(c, 'AI_ATTRIBUTE_DATE', 1, 5);                               // 215-219
  c.push(col('AI_ATTRIBUTE_CATEGORY_CODE'));                       // 220
  c.push(col('Mass Property Eligible'));                           // 221
  c.push(col('Group Asset Number'));                               // 222
  c.push(col('Reduction Rate'));                                   // 223
  c.push(col('Apply Reduction Rate to Additions'));                // 224
  c.push(col('Apply Reduction Rate to Adjustments'));              // 225
  c.push(col('Apply Reduction Rate to Retirements'));              // 226
  c.push(col('Recognize Gain or Loss'));                           // 227
  c.push(col('Recapture Excess Reserve'));                         // 228
  c.push(col('Limit Net Proceeds to Cost'));                       // 229
  c.push(col('Terminal Gain or Loss'));                            // 230
  c.push(col('Tracking Method'));                                  // 231
  c.push(col('Allocate Excess Depreciation'));                     // 232
  c.push(col('Depreciate By'));                                    // 233
  c.push(col('Member Rollup'));                                    // 234
  c.push(col('Allocate to Fully Retired and Reserved Assets'));    // 235
  c.push(col('Over Depreciate'));                                  // 236
  c.push(col('Preparer'));                                         // 237
  c.push(col('Merged Level'));                                     // 238
  c.push(col('Parent Interface Line Number'));                     // 239
  c.push(col('Sum Merged Units'));                                 // 240
  c.push(col('New Master'));                                       // 241
  c.push(col('Units to Adjust'));                                  // 242
  c.push(col('Short year'));                                       // 243
  c.push(col('Conversion Date'));                                  // 244
  c.push(col('Original Depreciation Start Date'));                 // 245
  seq(c, 'GLOBAL_ATTRIBUTE', 1, 20);                               // 246-265 global DFF
  seq(c, 'GLOBAL_ATTRIBUTE_NUMBER', 1, 5);                         // 266-270
  seq(c, 'GLOBAL_ATTRIBUTE_DATE', 1, 5);                           // 271-275
  c.push(col('GLOBAL_ATTRIBUTE_CATEGORY'));                        // 276
  c.push(col('Net Book Value at the Time of Switch'));             // 277
  c.push(col('Period Fully Reserved'));                            // 278
  c.push(col('Start Period of Extended Depreciation'));            // 279
  c.push(col('Earlier Depreciation Limit Type'));                  // 280
  c.push(col('Earlier Depreciation Limit Percent'));               // 281
  c.push(col('Earlier Depreciation Limit Amount'));                // 282
  c.push(col('Earlier Depreciation Method'));                      // 283
  c.push(col('Earlier Life in Months'));                           // 284
  c.push(col('Earlier Basic Rate'));                               // 285
  c.push(col('Earlier Adjusted Rate'));                            // 286
  c.push(col('Asset Schedule Identifier'));                        // 287
  c.push(col('Lease Number'));                                     // 288
  c.push(col('Revaluation Reserve'));                              // 289
  c.push(col('Revaluation Loss'));                                 // 290
  c.push(col('Revaluation Reserve Amortization Basis'));           // 291
  c.push(col('Impairment Loss Expense'));                          // 292
  c.push(col('Revaluation Cost Ceiling'));                         // 293
  c.push(col('Fair Value'));                                       // 294
  c.push(col('Last Used Price Index Value'));                      // 295
  seq(c, 'GLOBAL_ATTRIBUTE_NUMBER', 6, 10);                        // 296-300
  seq(c, 'GLOBAL_ATTRIBUTE_DATE', 6, 10);                          // 301-305
  seq(c, 'BK_GLOBAL_ATTRIBUTE', 1, 20);                            // 306-325 book global DFF
  seq(c, 'BK_GLOBAL_ATTRIBUTE_NUMBER', 1, 5);                      // 326-330
  seq(c, 'BK_GLOBAL_ATTRIBUTE_DATE', 1, 5);                        // 331-335
  c.push(col('BK_GLOBAL_ATTRIBUTE_CATEGORY'));                     // 336
  seq(c, 'TH_GLOBAL_ATTRIBUTE', 1, 20);                            // 337-356 txn-header global DFF
  seq(c, 'TH_GLOBAL_ATTRIBUTE_NUMBER', 1, 5);                      // 357-361
  seq(c, 'TH_GLOBAL_ATTRIBUTE_DATE', 1, 5);                        // 362-366
  c.push(col('TH_GLOBAL_ATTRIBUTE_CATEGORY'));                     // 367
  seq(c, 'AI_GLOBAL_ATTRIBUTE', 1, 20);                            // 368-387 asset-invoice global DFF
  seq(c, 'AI_GLOBAL_ATTRIBUTE_NUMBER', 1, 5);                      // 388-392
  seq(c, 'AI_GLOBAL_ATTRIBUTE_DATE', 1, 5);                        // 393-397
  c.push(col('AI_GLOBAL_ATTRIBUTE_CATEGORY'));                     // 398
  c.push(col('Supplier Name', 'SUPPLIER'));                        // 399
  c.push(col('Supplier Number'));                                  // 400
  c.push(col('Purchase Order Number'));                            // 401
  c.push(col('Invoice Number'));                                   // 402
  c.push(col('Invoice Voucher Number'));                           // 403
  c.push(col('Invoice Date'));                                     // 404
  c.push(col('Payables Units'));                                   // 405
  c.push(col('Invoice Line Number'));                              // 406
  c.push(col('Invoice Line Type'));                                // 407
  c.push(col('Invoice Line Description'));                         // 408
  c.push(col('Invoice Payment Number'));                           // 409
  c.push(col('Project Number', 'PROJECT NUMBER'));                 // 410
  c.push(col('Task Number'));                                      // 411
  c.push(col('Fully depreciate'));                                 // 412
  c.push(col('Depreciation Factor'));                              // 413
  c.push(col('Revalued Cost'));                                    // 414
  c.push(col('Backlog Depreciation Reserve'));                     // 415
  c.push(col('YTD Backlog Depreciation Reserve'));                 // 416
  c.push(col('Life-to-Date Revaluation Reserve Amortization'));    // 417
  c.push(col('YTD Revaluation Reserve Amortization'));             // 418
  c.push(col('Transaction Group'));                                // 419
  c.push(col('Annuity Interest Rate'));                            // 420
  c.push(col('LTD Annuity Interest'));                             // 421
  c.push(col('YTD Annuity Interest'));                             // 422
  return c;
}

// Oracle Fusion — "Redwood (simplified)". No Redwood-specific fixed-asset import exists
// as of 26C (Financials What's New TOCs 24A-26C list zero Redwood FA features; Redwood
// adoption tracker raoac/rw-erp.html lists only a 23B display tweak; "Add Assets in
// Spreadsheet" remains a classic ADFdi workbook with no published column list). This
// preset is Oracle's documented simplified asset-creation set — the minimum attributes
// required to create an asset plus standard identification / source-line fields — on
// the REAL FBDI header strings so files stay 1:1 loadable into FA_MASS_ADDITIONS.
// The last two columns are distribution-level essentials (FA_MASSADD_DISTRIBUTIONS).
// Replace with the true Redwood template if/when Oracle ships one.
export function oracleRedwoodColumns(){
  return [
    col('Interface Line Number', 'custom', true),
    col('Asset Book', 'custom', true),
    col('Asset Number', 'ASSET NO (AUTO)'),
    col('Asset Description', 'ASSET NAME (AUTO)', true),
    col('Tag Number', 'ASSET / TAG NAME'),
    col('Manufacturer', 'MAKE'),
    col('Serial Number', 'SERIAL NO.'),
    col('Model', 'MODEL'),
    col('Asset Type', 'custom', true),
    col('Cost', 'custom', true),
    col('Date Placed in Service', 'ACQUIRED DATE', true),
    col('Prorate Convention'),
    col('Asset Units', 'custom', true),
    col('Asset Category Segment1', 'custom', true),
    col('Asset Category Segment2'),
    col('Posting Status', 'custom', true),
    col('Queue Name'),
    col('Parent Asset Number', 'SELECT PARENT ASSET'),
    col('Depreciate', 'custom', true),
    col('Depreciation Method'),
    col('Life in Months'),
    col('Supplier Name', 'SUPPLIER'),
    col('Supplier Number'),
    col('Purchase Order Number'),
    col('Invoice Number'),
    col('Invoice Date'),
    col('Project Number', 'PROJECT NUMBER'),
    col('Task Number'),
    col('Depreciation Expense Account', 'custom', true),   // distribution-level
    col('Location', 'LOCATION', true)                      // distribution-level
  ];
}

// Pronto Xi — Fixed Assets register, official Asset Entry screen field set in screen
// order (Pronto Xi 750.2 help topic fa/ref_screen/asset_entry_screen.htm, corroborated
// by Pronto-Xi-780-Fixed-Assets-overview.pdf). Pronto's Excel bulk-import column spec
// is customer-portal-gated; the import populates this same asset master. Display-only
// fields (Status, Bin Location, Available Qty) ship include:false. Required flags
// follow the doc's logic: unique key, GL-driving codes, acquisition type/date, cost.
export function prontoXiColumns(){
  return [
    col('Asset', 'ASSET NO (AUTO)', true),                 // Identifier
    col('Description', 'ASSET NAME (AUTO)', true),
    col('Status', 'custom', false, false),                 // display-only
    col('Acquisition Type', 'custom', true),
    col('Item Code'),                                      // stock-acquisition details
    col('Warehouse'),
    col('Bin Location', 'custom', false, false),           // display-only
    col('Available Qty', 'custom', false, false),          // display-only
    col('Quantity'),                                       // acquisition identification
    col('Asset ID', 'ASSET / TAG NAME'),
    col('Attach To', 'SELECT PARENT ASSET'),
    col('Serial No', 'SERIAL NO.'),
    col('Location Code', 'custom', true),                  // asset grouping (drives GL)
    col('Group Category', 'custom', true),                 // (drives GL)
    col('Sub-Group Category'),
    col('Branch'),
    col('Asset Class Code'),
    col('Reporting Code'),                                 // other details
    col('Physical Location'),
    col('Current Location', 'LOCATION'),
    col('Approval Number', 'REGISTRATION / APPROVAL NUMBER'),
    col('Leased'),
    col('Acquisition Date', 'ACQUIRED DATE', true),        // acquisition details
    col('Currency Code'),
    col('Currency Rate'),
    col('Acquisition Cost (Foreign)'),
    col('Cost Local', 'custom', true)
  ];
}
