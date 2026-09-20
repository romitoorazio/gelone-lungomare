import fs from "node:fs";

const path = new URL("../src/Admin.jsx", import.meta.url);
let source = fs.readFileSync(path, "utf8");

const before = '  const [selectedUnitId, setSelectedUnitId] = useState(UNIT_ID);';
const after = '  const [selectedUnitId, setSelectedUnitId] = useState(ALL_UNITS_ID);';

if (source.includes(after)) {
  console.log("[pms-default-all-units] vista globale già impostata come predefinita.");
} else if (!source.includes(before)) {
  throw new Error("[pms-default-all-units] stato selectedUnitId non trovato.");
} else {
  source = source.replace(before, after);
  fs.writeFileSync(path, source, "utf8");
  console.log("[pms-default-all-units] apertura PMS impostata su TUTTE LE UNITÀ.");
}
