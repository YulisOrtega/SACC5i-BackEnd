import ExcelJS from 'exceljs';
import archiver from 'archiver';
import { PassThrough } from 'stream';
import CcpModel from '../models/CcpModel.js';

/**
 * Asunto completo generado desde los campos estructurados
 */
const formatFechaExcel = (value) => {
  if (!value) return '';

  const str = String(value).trim();

  // Si viene como YYYY-MM-DD, se convierte directamente sin depender de zona horaria.
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${d}/${m}/${y}`;
  }

  const date = new Date(str);
  if (Number.isNaN(date.getTime())) return str;

  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
};

const buildAsunto = (row) =>
  `C.C.P. EN ATENCIÓN AL OFICIO ${row.oficio_referencia} DE FECHA ${formatFechaExcel(row.fecha_referencia)} EN EL CUAL SOLICITA ${row.tipo_solicitud || ''} EN RNPSP.`;

const formatReferenciaVolante = (value, folio, volante) => {
  const opciones = String(value || '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);

  if (opciones.length === 0) return 'Sin referencia';

  const partes = [];
  if (opciones.includes('N/A')) partes.push('N/A');
  if (opciones.includes('folio')) partes.push(folio ? `FOLIO: ${folio}` : 'FOLIO');
  if (opciones.includes('volante')) partes.push(volante ? `VOLANTE: ${volante}` : 'VOLANTE');

  return partes.join(' + ');
};

const CCP_COLUMNS = [
  { header: 'Entrada', width: 10 },
  { header: 'No. de Oficio', width: 28 },
  { header: 'Fecha', width: 14 },
  { header: 'Área', width: 40 },
  { header: 'Funcionario', width: 35 },
  { header: 'Cargo', width: 40 },
  { header: 'Asunto', width: 80 },
  { header: 'Ref. Volante', width: 24 }
];

/**
 * Crear base de workbook horizontal compartida por todas las exportaciones CCP
 */
const createWorkbookBase = (sheetName, title) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RPSP — Registro de Personal de Seguridad Publica';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName);

  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6B0F0F' } };
  const thinBorder = {
    top: { style: 'thin' }, left: { style: 'thin' },
    bottom: { style: 'thin' }, right: { style: 'thin' }
  };
  const centerAlign = { horizontal: 'center', vertical: 'middle' };

  sheet.columns = CCP_COLUMNS.map((column) => ({ width: column.width }));

  sheet.mergeCells(1, 1, 1, CCP_COLUMNS.length);
  const titleCell = sheet.getCell('A1');
  titleCell.value = title;
  titleCell.fill = headerFill;
  titleCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 13 };
  titleCell.alignment = centerAlign;
  titleCell.border = thinBorder;
  sheet.getRow(1).height = 28;

  const headerRow = sheet.getRow(2);
  CCP_COLUMNS.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.header;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8D5D5' } };
    cell.font = { bold: true, size: 10, color: { argb: 'FF4A0000' } };
    cell.alignment = centerAlign;
    cell.border = thinBorder;
  });

  headerRow.height = 18;

  return { workbook, sheet, thinBorder };
};

const appendHorizontalRows = (sheet, rows, thinBorder, startRow = 3) => {
  rows.forEach((row, rowIndex) => {
    const dataRow = sheet.getRow(startRow + rowIndex);
    const values = [
      row.id,
      row.numero_oficio,
      formatFechaExcel(row.fecha),
      row.area,
      row.funcionario,
      row.cargo,
      buildAsunto(row),
      formatReferenciaVolante(row.referencia_volante, row.folio_numero, row.volante_numero)
    ];

    values.forEach((value, columnIndex) => {
      const cell = dataRow.getCell(columnIndex + 1);
      cell.value = value ?? '';
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle', wrapText: columnIndex >= 3 };
    });

    dataRow.height = 20;
  });
};

/**
 * Crear WorkBook de Excel para un único registro CCP
 */
const buildWorkbook = async (row) => {
  const { workbook, sheet, thinBorder } = createWorkbookBase('Copia de Conocimiento', 'COPIAS DE CONOCIMIENTO — RPSP');
  appendHorizontalRows(sheet, [row], thinBorder);

  return workbook;
};

/**
 * Generar buffer Excel para un único registro
 */
export const generarExcelUnico = async (id) => {
  const row = await CcpModel.obtenerPorId(id);
  if (!row) throw new Error(`Registro CCP ${id} no encontrado`);
  const workbook = await buildWorkbook(row);
  return workbook.xlsx.writeBuffer();
};

/**
 * Generar archivo ZIP que contiene un Excel por cada registro solicitado
 * Devuelve un PassThrough stream listo para pipe a res
 */
export const generarZip = async (ids) => {
  let rows;
  if (ids && ids.length > 0) {
    rows = await CcpModel.obtenerPorIds(ids);
  } else {
    rows = await CcpModel.obtenerTodos();
  }

  if (rows.length === 0) throw new Error('No hay registros para descargar');

  const passThroughStream = new PassThrough();
  const archive = archiver('zip', { zlib: { level: 6 } });

  archive.on('error', (err) => { throw err; });
  archive.pipe(passThroughStream);

  for (const row of rows) {
    const workbook = await buildWorkbook(row);
    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `CCP_${row.numero_oficio.replace(/\//g, '-')}.xlsx`;
    archive.append(Buffer.from(buffer), { name: filename });
  }

  await archive.finalize();
  return passThroughStream;
};

/**
 * Generar buffer Excel con TODOS los registros en formato horizontal (tabla)
 */
export const generarExcelTabla = async (filtro = '') => {
  const rows = await CcpModel.obtenerTodos(filtro);

  const { workbook, sheet, thinBorder } = createWorkbookBase('Copias de Conocimiento', 'COPIAS DE CONOCIMIENTO — RPSP');
  appendHorizontalRows(sheet, rows, thinBorder);

  return workbook.xlsx.writeBuffer();
};

export { CcpModel };
