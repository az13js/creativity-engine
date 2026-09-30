import { test } from "node:test";
import assert from "node:assert/strict";
import { readXlsx, readXlsxTable, decodeXmlEntities } from "../src/core/xlsx.ts";
import { buildZip } from "../test-support/zip.ts";

const workbook = {
  "[Content_Types].xml": '<Types><Override PartName="/xl/workbook.xml"/></Types>',
  "xl/workbook.xml": '<workbook><sheets><sheet name="Sheet1" sheetId="1"/></sheets></workbook>',
  "xl/sharedStrings.xml":
    '<sst count="4"><si><t>id</t></si><si><t>item</t></si><si><r><t>box &amp; </t></r><r><t>rope</t></r></si>' +
    '<si><t>hat &lt;big&gt;</t></si></sst>',
  "xl/worksheets/sheet1.xml":
    '<worksheet><sheetData>' +
    '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>' +
    '<row r="2"><c r="A2"><v>2001</v></c><c r="B2" t="s"><v>2</v></c><c r="C2" t="inlineStr"><is><t>inline</t></is></c></row>' +
    '<row r="3"><c r="B3" t="s"><v>3</v></c></row>' +
    '<row r="4"/>' +
    '</sheetData></worksheet>'
};

function xlsxBuffer(): Buffer {
  return buildZip(Object.entries(workbook).map(([name, data]) => ({ name, data, deflate: name.endsWith("sheet1.xml") })));
}

test("xlsx reader resolves shared, rich-text, inline and numeric cells", () => {
  const sheets = readXlsx(xlsxBuffer());
  assert.equal(sheets.length, 1);
  assert.deepEqual(sheets[0]!.rows[0], ["id", "item"]);
  assert.deepEqual(sheets[0]!.rows[1], ["2001", "box & rope", "inline"]);
  // A row may omit leading cells; the reader keeps column order by cell reference.
  assert.deepEqual(sheets[0]!.rows[2], ["", "hat <big>"]);
});

test("xlsx table helper maps columns to records and skips empty rows", () => {
  const { header, records } = readXlsxTable(xlsxBuffer());
  assert.deepEqual(header, ["id", "item"]);
  assert.equal(records.length, 2);
  assert.equal(records[0]!.id, "2001");
  assert.equal(records[0]!.item, "box & rope");
  assert.equal(records[1]!.id, "");
});

test("decodeXmlEntities handles named and numeric escapes", () => {
  assert.equal(decodeXmlEntities("a&amp;b&#65;&#x42;"), "a&bAB");
  assert.equal(decodeXmlEntities("&unknown;"), "&unknown;");
});
