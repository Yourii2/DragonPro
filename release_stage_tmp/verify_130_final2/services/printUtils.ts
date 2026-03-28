import JsBarcode from 'jsbarcode';

export type PrintWindowOptions = {
	pageSize?: string;
	margin?: string;
	extraCss?: string;
	bodyStyle?: string;
	direction?: 'rtl' | 'ltr';
};

export const openPrintWindow = (title: string, bodyHtml: string, options?: PrintWindowOptions) => {
	const printWindow = window.open('', '_blank');
	if (!printWindow) return;

	const pageSize = options?.pageSize || 'A4';
	const margin = options?.margin ?? '14mm';
	const direction = options?.direction || 'rtl';
	const bodyStyle = options?.bodyStyle || '';
	const extraCss = options?.extraCss || '';

	const html = `<!doctype html>
<html>
<head>
	<meta charset="utf-8" />
	<title>${title}</title>
	<style>
		@media print { @page { size: ${pageSize}; margin: ${margin}; } }
		body { font-family: Arial, Helvetica, sans-serif; color: #111; direction: ${direction}; ${bodyStyle} }
		table { width: 100%; border-collapse: collapse; margin-top: 10px; }
		th, td { border: 1px solid #e5e7eb; padding: 6px 8px; font-size: 12px; vertical-align: top; }
		thead th { background: #f3f4f6; }
		.small { font-size: 12px; color: #6b7280; }
		.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
		${extraCss}
	</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

	printWindow.document.write(html);
	printWindow.document.close();
	printWindow.focus();
	setTimeout(() => {
		try {
			printWindow.print();
		} catch {
			// ignore
		}
	}, 400);
};

export const printBarcode = (code: string, title: string = 'طباعة باركود') => {
	const value = String(code || '').trim();
	if (!value) return;

	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	JsBarcode(svg, value, {
		format: 'CODE128',
		displayValue: true,
		fontSize: 14,
		height: 70,
		margin: 10,
	});

	openPrintWindow(
		title,
		`<div style="text-align:center">
			<h2 style="margin:0 0 8px 0">${title}</h2>
			<div class="mono" style="margin-bottom:10px">${value}</div>
			<div style="display:flex;justify-content:center">${svg.outerHTML}</div>
		</div>`
	);
};

export type BarcodeLabelItem = {
	code: string;
	title?: string;
};

export type BarcodeLabelsPrintOptions =
	| { mode: 'a4' }
	| { mode: 'thermal'; thermalType: 'paper' | 'sticker'; stickerWidthMm?: number; stickerHeightMm?: number };

const escapeHtml = (s: string) =>
	String(s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');

const makeBarcodeSvg = (value: string, opts: { height: number; fontSize: number; margin: number }) => {
	const v = String(value || '').trim();
	if (!v) return '';
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	JsBarcode(svg, v, {
		format: 'CODE128',
		displayValue: true,
		fontSize: opts.fontSize,
		height: opts.height,
		margin: opts.margin,
	});
	return svg.outerHTML;
};

export const printBarcodeLabels = (items: BarcodeLabelItem[], options: BarcodeLabelsPrintOptions) => {
	const clean = (items || [])
		.map(it => ({ code: String(it.code || '').trim(), title: String(it.title || '').trim() }))
		.filter(it => Boolean(it.code));

	if (clean.length === 0) return;

	const isA4 = options.mode === 'a4';
	const isThermal = options.mode === 'thermal';

	const barcodeSvgOpts = isA4
		? { height: 36, fontSize: 9, margin: 0 }
		: { height: 44, fontSize: 9, margin: 0 };

	const labelsHtml = clean
		.map(it => {
			const titleHtml = it.title ? `<div class="lbl-title">${escapeHtml(it.title)}</div>` : '';
			const codeHtml = `<div class="lbl-code mono">${escapeHtml(it.code)}</div>`;
			const svg = makeBarcodeSvg(it.code, barcodeSvgOpts);
			return `<div class="lbl">${titleHtml}${codeHtml}<div class="lbl-bar">${svg}</div></div>`;
		})
		.join('');

	let extraCss = '';
	let pageSize: string | undefined;
	let margin: string | undefined;
	let bodyStyle = '';

	if (isA4) {
		pageSize = 'A4';
		margin = '14mm';
		extraCss = `
			.container { text-align: center; }
			.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; }
			.lbl { border: 1px dashed #e5e7eb; padding: 3mm; min-height: 32mm; display:flex; flex-direction:column; justify-content:center; align-items:center; }
			.lbl-title { font-size: 11px; margin-bottom: 2mm; }
			.lbl-code { font-size: 10px; margin-bottom: 2mm; }
			.lbl-bar svg { max-width: 100%; height: auto; }
		`;
	} else if (isThermal) {
		margin = '0';
		bodyStyle = 'padding:0;';

		if (options.thermalType === 'sticker') {
			const w = Number(options.stickerWidthMm || 80);
			const h = Number(options.stickerHeightMm || 40);
			pageSize = `${w}mm ${h}mm`;
			extraCss = `
				* { box-sizing: border-box; }
				.container { width: ${w}mm; }
				.grid { display:block; }
				.lbl { width: ${w}mm; height: ${h}mm; padding: 2mm; overflow:hidden; display:flex; flex-direction:column; justify-content:center; align-items:center; page-break-after: always; }
				.lbl-title { font-size: 10px; margin-bottom: 1mm; text-align:center; }
				.lbl-code { font-size: 10px; margin-bottom: 1mm; }
				.lbl-bar svg { max-width: 100%; height: auto; }
			`;
		} else {
			// Thermal paper (80mm) - long page, continuous flow
			pageSize = '80mm 500mm';
			extraCss = `
				* { box-sizing: border-box; }
				.container { width: 80mm; }
				.grid { display:block; }
				.lbl { width: 80mm; padding: 2mm; display:flex; flex-direction:column; justify-content:center; align-items:center; }
				.lbl + .lbl { border-top: 1px dashed #e5e7eb; }
				.lbl-title { font-size: 10px; margin-bottom: 1mm; text-align:center; }
				.lbl-code { font-size: 10px; margin-bottom: 1mm; }
				.lbl-bar svg { max-width: 100%; height: auto; }
			`;
		}
	}

	openPrintWindow(
		'طباعة الأكواد',
		`<div class="container"><div class="grid">${labelsHtml}</div></div>`,
		{ pageSize, margin, extraCss, bodyStyle, direction: 'rtl' }
	);
};
